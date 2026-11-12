// Filling the local message index from this account's other sessions.
//
// A phone that was off for days has holes in its index, and walking the
// server's history to fill them is the expensive way. Another session of the
// same account usually has those messages already, so:
//   - after connecting, a session works out which time ranges of its encrypted
//     rooms it has not indexed (eventIndex.getMissingRanges) and asks the
//     account's other verified sessions for them, over Olm to-device messages;
//   - each of those answers with the entries it holds for the ranges it has
//     fully indexed, in chunks small enough for a to-device message;
//   - the asker merges them, and only then counts the range as covered;
//   - the crawler is held back meanwhile (eventIndex.holdBackfill), and fetches
//     from the server only what no session supplied.
//
// Only sessions of our own account are ever asked or answered, and only
// verified ones that pass the "who gets keys" settings, because what travels
// is decrypted message text.

import { ClientEvent } from "matrix-js-sdk";
import type { MatrixClient } from "matrix-js-sdk";
import {
    INDEX_SYNC_BLOCK,
    INDEX_SYNC_REQUEST,
    entriesInRange,
    intersectRanges,
    packEntries,
    parseSyncBlock,
    parseSyncRequest,
    rangesCover,
    peerRefusal,
    unpackBlock,
    windowRanges,
    type IndexSyncBlock,
    type Range,
} from "$lib/utils/eventIndexSync";
import type { IndexEntry } from "$lib/utils/eventIndex";
import {
    deviceAllowed,
    createRateLimit,
    type ReceivedToDevice,
} from "./keyBackfill";
import { isRoomEncrypted } from "./crypto";
import { isSyncStale } from "./client";
import {
    getCoverage,
    getMissingRanges,
    holdBackfill,
    importPeerEntries,
    readEntriesInRanges,
} from "./eventIndex";

/** First ask this long after start, and again if the connection wasn't up. */
const FIRST_ASK_DELAY_MS = 8_000;
/** Server crawling waits this long for peers to answer. */
const HOLD_MS = 2 * 60_000;
/** Asking again after an answer arrived, to collect what was cut off. */
const FOLLOW_UP_MS = 90_000;
/** How long an unanswered request is remembered. */
const REQUEST_TTL_MS = 30 * 60_000;
/** Chunks one answer may carry, so a huge index can't flood the homeserver. */
const MAX_CHUNKS_PER_ANSWER = 400;
const CHUNK_PAUSE_MS = 120;
/** Entries per answered window; a window is all-or-nothing for coverage. */
const WINDOW_ENTRIES = 1_000;
const MAX_ASSEMBLIES = 64;
const MAX_ENTRIES_PER_WINDOW = 5_000;

function log(message: string): void {
    console.info(`[index-sync] ${message}`);
}

interface Assembly {
    roomId: string;
    range: Range;
    total: number;
    parts: Map<number, IndexSyncBlock>;
}

/** Start syncing the index with the account's other sessions. Returns the
 *  teardown. Call once the index is running. */
export function attachIndexSync(client: MatrixClient): () => void {
    const crypto = client.getCrypto();
    const ownUserId = client.getUserId();
    const ownDeviceId = client.getDeviceId();
    if (!crypto || !ownUserId || !ownDeviceId) return () => {};

    const requests = new Map<
        string,
        { missing: Map<string, Range[]>; at: number }
    >();
    const assemblies = new Map<string, Assembly>();
    const canAnswer = createRateLimit(10);
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let stopped = false;
    let importedSinceAsk = false;

    async function check(
        payload: ReceivedToDevice,
    ): Promise<{ deviceId: string } | null> {
        const info = payload.encryptionInfo;
        const status =
            info?.senderDevice && info.sender === ownUserId
                ? await crypto!.getDeviceVerificationStatus(
                      info.sender,
                      info.senderDevice,
                  )
                : null;
        const refusal = peerRefusal({
            encrypted: !!info,
            fromUser: info?.sender,
            ownUserId: ownUserId!,
            fromDevice: info?.senderDevice,
            ownDeviceId: ownDeviceId!,
            verified: !!status?.isVerified(),
            allowed: deviceAllowed(crypto!, ownUserId!, status),
        });
        if (refusal) {
            log(`ignoring ${payload.message.type}: ${refusal}`);
            return null;
        }
        return { deviceId: info!.senderDevice! };
    }

    async function send(
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

    /** Other sessions of ours that we'd trade index entries with. */
    async function peers(): Promise<{ userId: string; deviceId: string }[]> {
        const known = (await crypto!.getUserDeviceInfo([ownUserId!])).get(
            ownUserId!,
        );
        const out: { userId: string; deviceId: string }[] = [];
        for (const id of known?.keys() ?? []) {
            if (id === ownDeviceId) continue;
            const status = await crypto!.getDeviceVerificationStatus(
                ownUserId!,
                id,
            );
            if (
                status?.isVerified() &&
                deviceAllowed(crypto!, ownUserId!, status)
            )
                out.push({ userId: ownUserId!, deviceId: id });
        }
        return out;
    }

    function later(fn: () => void, ms: number): void {
        const timer = setTimeout(() => {
            timers.delete(timer);
            if (!stopped) fn();
        }, ms);
        timers.add(timer);
    }

    async function ask(): Promise<void> {
        if (isSyncStale()) return later(() => void ask().catch(warn), 30_000);
        const targets = await peers();
        if (targets.length === 0) return;
        const missing = (await getMissingRanges()).slice(0, 200);
        if (missing.length === 0) return;
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        const now = Date.now();
        for (const [k, v] of requests)
            if (now - v.at > REQUEST_TTL_MS) requests.delete(k);
        requests.set(id, {
            missing: new Map(
                missing.map((m) => [m.roomId, m.missing.slice(0, 50)]),
            ),
            at: now,
        });
        // The server crawl is the costly way: give the answers time to land.
        holdBackfill(now + HOLD_MS);
        importedSinceAsk = false;
        log(`asking ${targets.length} sessions about ${missing.length} rooms`);
        await send(INDEX_SYNC_REQUEST, targets, { id, rooms: missing });
        // A capped answer leaves some missing: ask again while answers help.
        later(() => {
            if (importedSinceAsk) void ask().catch(warn);
        }, FOLLOW_UP_MS);
    }

    function warn(err: unknown): void {
        console.warn("[index-sync] failed", err);
    }

    async function answer(payload: ReceivedToDevice): Promise<void> {
        const peer = await check(payload);
        if (!peer) return;
        const request = parseSyncRequest(payload.message.content);
        if (!request || !canAnswer()) return;
        const target = [{ userId: ownUserId!, deviceId: peer.deviceId }];
        let chunks = 0;
        for (const { roomId, missing } of request.rooms) {
            const room = client.getRoom(roomId);
            if (!room || !isRoomEncrypted(room)) continue;
            const give = intersectRanges(await getCoverage(roomId), missing);
            if (give.length === 0) continue;
            const entries = await readEntriesInRanges(roomId, give);
            // Newest first, a window at a time: each is all or nothing.
            const windows = give
                .flatMap((r) =>
                    windowRanges(
                        entriesInRange(entries, [r]),
                        r,
                        WINDOW_ENTRIES,
                    ),
                )
                .sort((a, b) => b[1] - a[1]);
            for (const range of windows) {
                if (stopped) return;
                const blocks = await packEntries(
                    roomId,
                    request.id,
                    range,
                    entriesInRange(entries, [range]),
                );
                if (chunks + blocks.length > MAX_CHUNKS_PER_ANSWER) return;
                for (const block of blocks) {
                    await send(INDEX_SYNC_BLOCK, target, { ...block });
                    chunks++;
                    await new Promise((r) => setTimeout(r, CHUNK_PAUSE_MS));
                }
            }
        }
        log(`answered ${peer.deviceId} with ${chunks} chunks`);
    }

    async function receive(payload: ReceivedToDevice): Promise<void> {
        const block = parseSyncBlock(payload.message.content);
        if (!block) return;
        const asked = requests.get(block.id);
        const wanted = asked?.missing.get(block.roomId);
        // Only answers to a request we made, for a range we asked about.
        if (!wanted || !rangesCover(wanted, block.range)) return;
        if (!(await check(payload))) return;
        const key = `${block.id}|${block.roomId}|${block.range[0]}-${block.range[1]}`;
        let asm = assemblies.get(key);
        if (!asm) {
            if (assemblies.size >= MAX_ASSEMBLIES)
                assemblies.delete(assemblies.keys().next().value as string);
            asm = {
                roomId: block.roomId,
                range: block.range,
                total: block.total,
                parts: new Map(),
            };
            assemblies.set(key, asm);
        }
        if (block.total !== asm.total) return;
        asm.parts.set(block.seq, block);
        if (asm.parts.size < asm.total) return;
        assemblies.delete(key);
        const entries: IndexEntry[] = [];
        for (const part of asm.parts.values())
            entries.push(...(await unpackBlock(part)));
        const inRange = entriesInRange(entries, [asm.range]).slice(
            0,
            MAX_ENTRIES_PER_WINDOW,
        );
        const added = await importPeerEntries(asm.roomId, asm.range, inRange);
        importedSinceAsk = true;
        log(`merged ${added} new entries for ${asm.roomId}`);
    }

    const onToDevice = (payload: ReceivedToDevice): void => {
        const type = payload.message.type;
        const run =
            type === INDEX_SYNC_REQUEST
                ? answer
                : type === INDEX_SYNC_BLOCK
                  ? receive
                  : null;
        run?.(payload).catch(warn);
    };

    client.on(
        ClientEvent.ReceivedToDeviceMessage as never,
        onToDevice as never,
    );
    // The crawler starts at once; let the first question go out before it
    // spends a server request on something a peer may hold.
    holdBackfill(Date.now() + FIRST_ASK_DELAY_MS + 5_000);
    later(() => void ask().catch(warn), FIRST_ASK_DELAY_MS);
    return () => {
        stopped = true;
        client.off(
            ClientEvent.ReceivedToDeviceMessage as never,
            onToDevice as never,
        );
        for (const timer of timers) clearTimeout(timer);
        timers.clear();
        requests.clear();
        assemblies.clear();
    };
}
