// Prefetches messages for rooms visible in the room list, where the user will
// land when opening one, so a slow connection shows its text at once. An
// unread room whose read position is not loaded opens in a window at that
// position, so that window is built ahead (prefetchContextWindow, handed over
// by createContextWindow); any other room opens at its newest messages, which
// prefetchRoomTimeline pages into the live timeline the room view reads.
// Pure rules live in utils/roomPrefetch.ts.
//
// Not reactive: nothing renders from this state, so plain module state is used.

import type { MatrixClient } from "matrix-js-sdk";
import {
    getLoadedEventCount,
    getPrefetchedAnchor,
    getUnreadAnchor,
    isInitialSyncComplete,
    prefetchContextWindow,
    prefetchRoomTimeline,
} from "$lib/matrix/client";
import { captureClient, ownedClient } from "$lib/matrix/runtime";
import type { ClientOwnership } from "$lib/utils/clientGeneration";
import { roomsState } from "$lib/stores/rooms.svelte";
import {
    PREFETCH_SETTLE_MS,
    pickPrefetchRooms,
    prefetchKey,
    prefetchPageSize,
    type PrefetchPick,
} from "$lib/utils/roomPrefetch";

// Row element -> room id. The same room can render in more than one place, so
// each element is tracked on its own.
const rowRooms = new Map<Element, string>();
// Row elements currently on screen (reported by the shared observer).
const visibleRows = new Set<Element>();
// Room id -> the client that started its prefetch. A room is in flight while
// its entry exists; the owner check stops a stale client's finish from
// clearing a newer prefetch of the same room.
const inFlight = new Map<string, MatrixClient>();
const lastPrefetchAt = new Map<string, number>();
let trackedClient: MatrixClient | null = null;

let running = false;
let observer: IntersectionObserver | null = null;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let visibilityListener: (() => void) | null = null;

function onIntersect(entries: IntersectionObserverEntry[]): void {
    let changed = false;
    for (const entry of entries) {
        if (!rowRooms.has(entry.target)) continue;
        if (entry.isIntersecting) {
            if (!visibleRows.has(entry.target)) {
                visibleRows.add(entry.target);
                changed = true;
            }
        } else if (visibleRows.delete(entry.target)) {
            changed = true;
        }
    }
    if (changed) scheduleRun();
}

/**
 * Track a room row for visibility. Returns the release function. Called from
 * the roomPrefetchRow action; safe before startRoomPrefetch (the row is
 * observed once the store starts).
 */
export function observeRoomRow(el: Element, roomId: string): () => void {
    rowRooms.set(el, roomId);
    observer?.observe(el);
    return () => {
        rowRooms.delete(el);
        visibleRows.delete(el);
        observer?.unobserve(el);
    };
}

/** Visible room ids in list (DOM) order, each room once. */
function orderedVisibleRoomIds(): string[] {
    const rows = [...visibleRows].sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
            ? -1
            : 1,
    );
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const el of rows) {
        const id = rowRooms.get(el);
        if (id && !seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    }
    return ids;
}

function saveDataEnabled(): boolean {
    const conn = (
        navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    return conn?.saveData === true;
}

/** Restart the settle timer. Each call pushes the run back, so it runs once the visible set is still. */
function scheduleRun(delay = PREFETCH_SETTLE_MS): void {
    if (!running) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(run, delay);
}

function run(): void {
    settleTimer = undefined;
    if (!running) return;
    // Before the first sync the room list and live timelines are still being
    // built; paging them now races the sync and stamps the cooldown for nothing.
    if (!isInitialSyncComplete()) {
        scheduleRun(2000);
        return;
    }
    let owner: ClientOwnership<MatrixClient>;
    try {
        owner = captureClient();
    } catch {
        return;
    }
    if (owner.client !== trackedClient) {
        // A new account or session: nothing from the old one carries over.
        trackedClient = owner.client;
        lastPrefetchAt.clear();
    }
    const visibleRoomIds = orderedVisibleRoomIds();
    const loadedCounts = new Map<string, number>();
    const unreadAnchors = new Map<string, string>();
    const preparedAnchors = new Map<string, string>();
    for (const roomId of visibleRoomIds) {
        loadedCounts.set(roomId, getLoadedEventCount(roomId));
        const anchor = getUnreadAnchor(roomId);
        if (anchor) unreadAnchors.set(roomId, anchor);
        const prepared = getPrefetchedAnchor(roomId);
        if (prepared) preparedAnchors.set(roomId, prepared);
    }
    const now = Date.now();
    const picks = pickPrefetchRooms({
        visibleRoomIds,
        activeRoomId: roomsState.activeRoomId,
        unreadAnchors,
        preparedAnchors,
        loadedCounts,
        lastPrefetchAt,
        inFlight: new Set(inFlight.keys()),
        now,
        saveData: saveDataEnabled(),
        hidden: document.hidden,
    });
    for (const pick of picks) {
        // Cooldown starts at the attempt, so a failure is not retried in a loop.
        lastPrefetchAt.set(prefetchKey(pick), now);
        inFlight.set(pick.roomId, owner.client);
        void prefetchOne(owner, pick, loadedCounts.get(pick.roomId) ?? 0);
    }
}

async function prefetchOne(
    owner: ClientOwnership<MatrixClient>,
    { roomId, anchor }: PrefetchPick,
    loaded: number,
): Promise<void> {
    try {
        if (anchor) await prefetchContextWindow(roomId, anchor);
        else await prefetchRoomTimeline(roomId, prefetchPageSize(loaded));
    } catch (err) {
        console.debug("[room-prefetch] failed", roomId, err);
    } finally {
        if (inFlight.get(roomId) === owner.client) inFlight.delete(roomId);
        // Start the next queued room, if the client is still the live one.
        if (ownedClient(owner)) scheduleRun();
    }
}

/**
 * Start prefetching visible rooms. Returns the stop function, which disconnects
 * the observer and drops pending work. Mount once, from AppShell.
 */
export function startRoomPrefetch(): () => void {
    if (running) return () => {};
    running = true;
    if (typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(onIntersect);
        for (const el of rowRooms.keys()) observer.observe(el);
    }
    visibilityListener = () => {
        if (!document.hidden) scheduleRun();
    };
    document.addEventListener("visibilitychange", visibilityListener);
    scheduleRun();
    return () => {
        running = false;
        clearTimeout(settleTimer);
        settleTimer = undefined;
        observer?.disconnect();
        observer = null;
        visibleRows.clear();
        lastPrefetchAt.clear();
        if (visibilityListener)
            document.removeEventListener(
                "visibilitychange",
                visibilityListener,
            );
        visibilityListener = null;
    };
}
