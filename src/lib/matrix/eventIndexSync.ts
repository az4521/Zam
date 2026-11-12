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

/** What the debug panel shows: counters since the sync attached, plus the
 *  last few log lines. Plain data, read by polling. */
export interface IndexSyncStatus {
    attached: boolean;
    /** Our other sessions, those verified, those we'd also trade with. */
    otherSessions: number;
    verifiedSessions: number;
    eligibleSessions: number;
    asks: number;
    lastAskAt: number | null;
    /** Rooms with holes at the last ask. */
    roomsMissing: number;
    requestsReceived: number;
    chunksSent: number;
    chunksReceived: number;
    entriesMerged: number;
    lastMergeAt: number | null;
    log: string[];
}

const LOG_LINES = 40;

function freshStatus(): IndexSyncStatus {
    return {
        attached: false,
        otherSessions: 0,
        verifiedSessions: 0,
        eligibleSessions: 0,
        asks: 0,
        lastAskAt: null,
        roomsMissing: 0,
        requestsReceived: 0,
        chunksSent: 0,
        chunksReceived: 0,
        entriesMerged: 0,
        lastMergeAt: null,
        log: [],
    };
}

let status = freshStatus();
let askNow: (() => Promise<void>) | null = null;

export function getIndexSyncStatus(): IndexSyncStatus {
    return { ...status, log: [...status.log] };
}

/** Ask the other sessions again right now. False when the sync isn't running. */
export function requestIndexSyncNow(): boolean {
    if (!askNow) return false;
    void askNow().catch((e) => log(`ask failed: ${e}`));
    return true;
}

function log(message: string): void {
    console.info(`[index-sync] ${message}`);
    status.log.push(`${new Date().toISOString().slice(11, 19)} ${message}`);
    if (status.log.length > LOG_LINES) status.log.shift();
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
        let others = 0;
        let verified = 0;
        for (const id of known?.keys() ?? []) {
            if (id === ownDeviceId) continue;
            others++;
            const trust = await crypto!.getDeviceVerificationStatus(
                ownUserId!,
                id,
            );
            if (trust?.isVerified()) verified++;
            if (
                trust?.isVerified() &&
                deviceAllowed(crypto!, ownUserId!, trust)
            )
                out.push({ userId: ownUserId!, deviceId: id });
        }
        status.otherSessions = others;
        status.verifiedSessions = verified;
        status.eligibleSessions = out.length;
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
        status.lastAskAt = Date.now();
        if (targets.length === 0) {
            log(
                `not asking: ${status.otherSessions} other sessions, ${status.verifiedSessions} verified, none eligible`,
            );
            return;
        }
        const all = await getMissingRanges();
        status.roomsMissing = all.length;
        const missing = all.slice(0, 200);
        if (missing.length === 0) {
            log("not asking: no holes in the index");
            return;
        }
        status.asks++;
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
        if (!request) return log(`bad request from ${peer.deviceId}`);
        status.requestsReceived++;
        if (!canAnswer()) return log(`rate limited ${peer.deviceId}`);
        log(`${peer.deviceId} asks about ${request.rooms.length} rooms`);
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
                    status.chunksSent++;
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
        if (!wanted || !rangesCover(wanted, block.range))
            return log(`dropped a chunk nobody asked for (${block.roomId})`);
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
        status.chunksReceived++;
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
        status.entriesMerged += added;
        status.lastMergeAt = Date.now();
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
    status = { ...freshStatus(), attached: true };
    askNow = ask;
    // The crawler starts at once; let the first question go out before it
    // spends a server request on something a peer may hold.
    holdBackfill(Date.now() + FIRST_ASK_DELAY_MS + 5_000);
    later(() => void ask().catch(warn), FIRST_ASK_DELAY_MS);
    return () => {
        stopped = true;
        askNow = null;
        status.attached = false;
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
