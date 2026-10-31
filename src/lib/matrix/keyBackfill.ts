// Getting back a room key that never arrived, from the session that made it.
//
// A sender shares each room key (megolm session) with every recipient session
// once, when it creates it, and then keeps using it for up to a week or 100
// messages. If that one share is lost (the recipient's encryption wasn't
// running when it arrived, say), the recipient can't read anything that
// sender session sends until the key rotates. The SDK's own key requests
// can't help: matrix-js-sdk turns them off, they only ever go to the
// requester's own sessions, and rust-crypto only accepts forwarded keys from
// the user's own verified sessions.
//
// So Zam sessions ask each other directly, over Olm-encrypted to-device
// messages:
//   - a session that can't find the key for a message waits a moment (the
//     key often lands just after the message), then asks the sender's
//     sessions for that session id;
//   - the sender session that created that key re-sends it, if the requester
//     is in the room and could have read those messages anyway (see
//     answerRefusal);
//   - the requester imports it, but only if it asked for that session and the
//     key came from the very device that created it (see responseRefusal),
//     which is what an original m.room_key share proves too.

import { ClientEvent, MatrixEventEvent } from "matrix-js-sdk";
import type { MatrixClient, MatrixEvent } from "matrix-js-sdk";
import type { CryptoApi } from "matrix-js-sdk/lib/crypto-api";
import { isUserBlocked } from "$lib/stores/ignoredUsers.svelte";
import { readScoped } from "$lib/utils/scopedStorage";

export const KEY_REQUEST_TYPE = "moe.crafty.room_key_request";
export const KEY_RESPONSE_TYPE = "moe.crafty.room_key";

/** A room key as exported by the crypto store. */
type ExportedRoomKey = Parameters<CryptoApi["importRoomKeys"]>[0][number];

/** What ClientEvent.ReceivedToDeviceMessage hands us. */
export interface ReceivedToDevice {
    message: {
        type: string;
        content: Record<string, unknown>;
    };
    encryptionInfo: {
        sender: string;
        senderDevice?: string;
        senderCurve25519KeyBase64: string;
    } | null;
}

/** How long a missing key gets to arrive on its own before we ask. */
export const REQUEST_DELAY_MS = 10_000;
/** How long before the same session is asked about again. */
export const REQUEST_RETRY_MS = 60 * 60_000;
/** Requests (or answers) per minute, so a long scroll can't flood anyone. */
export const PER_MINUTE_LIMIT = 20;

const MISSING_KEY = "MEGOLM_UNKNOWN_INBOUND_SESSION_ID";

/** Whether our encryption settings allow sending secrets to this device. */
export function deviceAllowed(
    crypto: CryptoApi,
    ownUserId: string,
    status: Awaited<
        ReturnType<CryptoApi["getDeviceVerificationStatus"]>
    > | null,
): boolean {
    if (!status) return false;
    if (crypto.globalBlacklistUnverifiedDevices && !status.isVerified())
        return false;
    const excludeInsecure =
        readScoped("settings:excludeInsecureDevices", ownUserId) === "true";
    return !excludeInsecure || status.signedByOwner;
}

/** Whether a decryption failure is one a re-share can fix. */
export function isMissingRoomKey(event: MatrixEvent): boolean {
    return (
        event.isDecryptionFailure() &&
        event.decryptionFailureReason === MISSING_KEY
    );
}

/**
 * Why we won't re-send one of our room keys to the device asking, or null to
 * send it. The export starts at the key's first message, so the requester
 * must be someone who may read the room's history anyway: joined, and the
 * room's history shared with members.
 */
export function answerRefusal(input: {
    /** The request arrived Olm-encrypted from a device we know. */
    fromKnownDevice: boolean;
    requesterBlocked: boolean;
    requesterJoined: boolean;
    historyVisibility: string | null;
    /** We created this key ourselves (it isn't one we received). */
    ownKey: boolean;
    /** The requesting device passes our "who gets keys" settings. */
    deviceAllowed: boolean;
}): string | null {
    if (!input.fromKnownDevice) return "not from a known device";
    if (input.requesterBlocked) return "requester is blocked";
    if (!input.requesterJoined) return "requester is not in the room";
    if (
        input.historyVisibility !== "shared" &&
        input.historyVisibility !== "world_readable"
    )
        return `history visibility is ${input.historyVisibility}`;
    if (!input.ownKey) return "not a key this session created";
    if (!input.deviceAllowed) return "device excluded by our settings";
    return null;
}

/**
 * Why we won't import a re-sent key, or null to import it. The key must be
 * one we asked for, from the user we asked, and created by the device that
 * sent it: its sender_key is the Olm identity the message came from.
 */
export function responseRefusal(input: {
    asked: { roomId: string; sender: string } | undefined;
    roomId: unknown;
    fromUser: string;
    fromDevice: string | undefined;
    fromCurve25519: string;
    key: Partial<ExportedRoomKey> | undefined;
    sessionId: unknown;
}): string | null {
    const { asked, key } = input;
    if (!asked) return "not a key we asked for";
    if (!input.fromDevice) return "not from a known device";
    if (input.fromUser !== asked.sender) return "not from the sender we asked";
    if (!key || typeof key !== "object") return "no key";
    if (key.session_id !== input.sessionId) return "session id mismatch";
    if (key.room_id !== asked.roomId || input.roomId !== asked.roomId)
        return "room mismatch";
    if (key.sender_key !== input.fromCurve25519)
        return "key was not created by the device that sent it";
    return null;
}

/** A sliding one-minute budget. */
export function createRateLimit(perMinute: number, now = () => Date.now()) {
    const stamps: number[] = [];
    return (): boolean => {
        const t = now();
        while (stamps.length && t - stamps[0] >= 60_000) stamps.shift();
        if (stamps.length >= perMinute) return false;
        stamps.push(t);
        return true;
    };
}

/** RustCrypto internals: exporting just the keys we need. */
interface ExportHooks {
    olmMachine?: {
        exportRoomKeys(
            predicate: (session: {
                sessionId: string;
                roomId: { toString(): string };
                senderKey: { toBase64(): string };
                hasBeenImported(): boolean;
            }) => boolean,
        ): Promise<string>;
    };
}

function log(message: string): void {
    console.info(`[key-backfill] ${message}`);
}

/**
 * Start answering and making key requests for `client`. Returns the
 * teardown. Call once crypto is running.
 */
export function attachKeyBackfill(client: MatrixClient): () => void {
    const crypto = client.getCrypto();
    if (!crypto) return () => {};
    const ownUserId = client.getUserId();
    const ownDeviceId = client.getDeviceId();
    if (!ownUserId || !ownDeviceId) return () => {};

    // Session id -> what we asked, and the events waiting on it.
    const asked = new Map<
        string,
        { roomId: string; sender: string; at: number; events: MatrixEvent[] }
    >();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const canRequest = createRateLimit(PER_MINUTE_LIMIT);
    const canAnswer = createRateLimit(PER_MINUTE_LIMIT);

    async function sendEncrypted(
        type: string,
        devices: { userId: string; deviceId: string }[],
        content: Record<string, unknown>,
    ): Promise<void> {
        if (devices.length === 0) return;
        const batch = await crypto!.encryptToDeviceMessages(
            type,
            devices,
            content,
        );
        if (batch.batch.length > 0) await client.queueToDevice(batch);
    }

    async function request(event: MatrixEvent): Promise<void> {
        const content = event.getWireContent();
        const sessionId = content.session_id;
        const roomId = event.getRoomId();
        const sender = event.getSender();
        if (typeof sessionId !== "string" || !roomId || !sender) return;
        const previous = asked.get(sessionId);
        if (previous && Date.now() - previous.at < REQUEST_RETRY_MS) {
            if (!previous.events.includes(event)) previous.events.push(event);
            return;
        }
        if (!canRequest()) return;
        // Older senders name the device; otherwise ask all of theirs.
        const named =
            typeof content.device_id === "string" ? content.device_id : null;
        const known = (await crypto!.getUserDeviceInfo([sender])).get(sender);
        const deviceIds = named
            ? [named]
            : [...(known?.keys() ?? [])].filter(
                  (id) => !(sender === ownUserId && id === ownDeviceId),
              );
        asked.set(sessionId, {
            roomId,
            sender,
            at: Date.now(),
            events: [event],
        });
        log(`asking ${sender} (${deviceIds.length} sessions) for ${sessionId}`);
        await sendEncrypted(
            KEY_REQUEST_TYPE,
            deviceIds.map((deviceId) => ({ userId: sender, deviceId })),
            { room_id: roomId, session_id: sessionId },
        );
    }

    async function answer(payload: ReceivedToDevice): Promise<void> {
        const { message, encryptionInfo } = payload;
        const roomId = message.content.room_id;
        const sessionId = message.content.session_id;
        if (typeof roomId !== "string" || typeof sessionId !== "string") return;
        // Who Olm says sent it, not what the message claims.
        const requester = encryptionInfo!.sender;
        const deviceId = encryptionInfo!.senderDevice;
        const room = client.getRoom(roomId);
        const own = await crypto!.getOwnDeviceKeys();
        let keys: ExportedRoomKey[] = [];
        const machine = (crypto as unknown as ExportHooks).olmMachine;
        if (room && machine) {
            keys = JSON.parse(
                await machine.exportRoomKeys(
                    (s) =>
                        s.sessionId === sessionId &&
                        s.roomId.toString() === roomId &&
                        s.senderKey.toBase64() === own.curve25519 &&
                        !s.hasBeenImported(),
                ),
            ) as ExportedRoomKey[];
        }
        const status = deviceId
            ? await crypto!.getDeviceVerificationStatus(requester, deviceId)
            : null;
        const refusal = answerRefusal({
            fromKnownDevice: !!deviceId,
            requesterBlocked: isUserBlocked(requester),
            requesterJoined: room?.getMember(requester)?.membership === "join",
            historyVisibility: room?.getHistoryVisibility() ?? null,
            ownKey: keys.length === 1,
            deviceAllowed: deviceAllowed(crypto!, ownUserId!, status),
        });
        if (refusal) {
            log(`not re-sending ${sessionId} to ${requester}: ${refusal}`);
            return;
        }
        if (!canAnswer()) return;
        log(`re-sending ${sessionId} to ${requester} ${deviceId}`);
        await sendEncrypted(
            KEY_RESPONSE_TYPE,
            [{ userId: requester, deviceId: deviceId! }],
            { room_id: roomId, session_id: sessionId, key: keys[0] },
        );
    }

    async function receive(payload: ReceivedToDevice): Promise<void> {
        const { message, encryptionInfo } = payload;
        const sessionId = message.content.session_id;
        if (typeof sessionId !== "string" || !encryptionInfo) return;
        const pending = asked.get(sessionId);
        const key = message.content.key as Partial<ExportedRoomKey> | undefined;
        const refusal = responseRefusal({
            asked: pending,
            roomId: message.content.room_id,
            fromUser: encryptionInfo.sender,
            fromDevice: encryptionInfo.senderDevice,
            fromCurve25519: encryptionInfo.senderCurve25519KeyBase64,
            key,
            sessionId,
        });
        if (refusal) {
            log(`ignoring a key for ${sessionId}: ${refusal}`);
            return;
        }
        await crypto!.importRoomKeys([key as ExportedRoomKey]);
        asked.delete(sessionId);
        log(`got ${sessionId} back from ${encryptionInfo.sender}`);
        for (const event of pending!.events) {
            if (!event.isDecryptionFailure()) continue;
            event
                .attemptDecryption(crypto as never, { isRetry: true })
                .catch(() => {});
        }
    }

    const onToDevice = (payload: ReceivedToDevice): void => {
        // Only Olm-encrypted messages: the plaintext ones carry no proof of
        // who sent them.
        if (!payload.encryptionInfo) return;
        const run =
            payload.message.type === KEY_REQUEST_TYPE
                ? answer
                : payload.message.type === KEY_RESPONSE_TYPE
                  ? receive
                  : null;
        run?.(payload).catch((err) =>
            console.warn(`[key-backfill] ${payload.message.type} failed`, err),
        );
    };

    const onDecrypted = (event: MatrixEvent): void => {
        if (!isMissingRoomKey(event)) return;
        const timer = setTimeout(() => {
            timers.delete(timer);
            if (!isMissingRoomKey(event)) return;
            request(event).catch((err) =>
                console.warn("[key-backfill] request failed", err),
            );
        }, REQUEST_DELAY_MS);
        timers.add(timer);
    };

    client.on(
        ClientEvent.ReceivedToDeviceMessage as never,
        onToDevice as never,
    );
    client.on(MatrixEventEvent.Decrypted as never, onDecrypted as never);
    return () => {
        client.off(
            ClientEvent.ReceivedToDeviceMessage as never,
            onToDevice as never,
        );
        client.off(MatrixEventEvent.Decrypted as never, onDecrypted as never);
        for (const timer of timers) clearTimeout(timer);
        timers.clear();
    };
}
