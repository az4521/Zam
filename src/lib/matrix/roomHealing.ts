/**
 * Healing rooms the homeserver's sync left broken. Rooms joined over
 * federation can arrive as state-less stubs (seeded from /rooms/{id}/state and
 * backfilled), and a room the server lists as joined can be missing from the
 * local store altogether (the joined-rooms reconcile materializes it in place,
 * with a cache-wipe reload as the last resort).
 *
 * Split out of `client.ts`, which re-exports the public API and calls
 * resetLiveSyncDelivered / noteLiveSyncResponse from startSync.
 */
import { Direction, EventTimeline, MatrixEvent } from "matrix-js-sdk";
import type { MatrixClient, Room } from "matrix-js-sdk";
import {
    captureOwnership,
    type ClientOwnership,
} from "$lib/utils/clientGeneration";
import {
    clientGeneration,
    matrixClient,
    matrixStore,
    ownedClient,
} from "./runtime";
import { notifyRoomUpdate } from "./client";
import { ensureRoomCryptoConfigured } from "$lib/matrix/crypto";
import { deleteSnapshot, snapshotKey } from "./roomListCache";
import { isUsingSlidingSync } from "./slidingSync";
import { materializeJoinedRoom } from "./materializeJoinedRoom";
import { createHealedRoomRegistry } from "$lib/utils/roomStateTrust";
import { needsStateSeed } from "$lib/utils/roomStateHealth";
import { planReconcileReload } from "$lib/utils/reconcileReload";

// Continuwuity never delivers rooms joined over federation in incremental
// /sync: the SDK is left holding a state-less stub ("Empty room", no
// m.room.create, isSpaceRoom() false) that pollutes room lists and can't be
// recognized as a space. The server demonstrably HAS the full state (a plain
// /rooms/{id}/state returns it), so fetch it and seed the SDK's store.

const seedingRooms = new Set<string>();
const roomHealedSubscribers = new Set<(roomId: string) => void>();
// Rooms whose state we healed out-of-band this session (see roomStateTrust.ts).
// Read by the UI to flag server-fetched trust indicators as unverified (SEC-M5).
const healedRoomRegistry = createHealedRoomRegistry();

/**
 * Fires after a state-less stub room has been seeded and backfilled — the
 * live timeline changed without any SDK sync event, so timeline views must
 * re-read it (room lists go through onRoomUpdate, which also fires).
 */
export function onRoomHealed(callback: (roomId: string) => void): () => void {
    roomHealedSubscribers.add(callback);
    return () => roomHealedSubscribers.delete(callback);
}

/**
 * Whether this room's current state was healed out-of-band (fetched from
 * `/rooms/{id}/state`) rather than delivered through /sync this session. The UI
 * uses it to flag server-controlled trust indicators as unverified (SEC-M5).
 */
export function isRoomStateHealed(roomId: string): boolean {
    return healedRoomRegistry.isHealed(roomId);
}

export function roomLacksState(room: Room): boolean {
    const create = room
        .getLiveTimeline()
        .getState(EventTimeline.FORWARDS)
        ?.getStateEvents("m.room.create", "");
    return needsStateSeed({
        membership: room.getMyMembership(),
        hasCreateEvent: !!create,
        createEventId: create?.getId(),
    });
}

/**
 * Backfill a room whose live timeline has no backward pagination token —
 * scrollback() treats a missing token as "already at the start of history"
 * and silently no-ops, and sync never supplies the token for the rooms it
 * omits. A token-less /messages probe yields a starting point to prime it.
 */
export async function primeBackwardToken(
    owner: ClientOwnership<MatrixClient>,
    room: Room,
): Promise<void> {
    const probe = await owner.client.createMessagesRequest(
        room.roomId,
        null,
        1,
        Direction.Backward,
    );
    if (!ownedClient(owner)) return;
    const token = probe.start ?? null;
    room.getLiveTimeline().setPaginationToken(token, Direction.Backward);
    // scrollback() reads the legacy oldState alias, not the timeline.
    room.oldState.paginationToken = token;
}

async function backfillStubTimeline(
    owner: ClientOwnership<MatrixClient>,
    room: Room,
): Promise<void> {
    if (!room.getLiveTimeline().getPaginationToken(Direction.Backward)) {
        await primeBackwardToken(owner, room);
    }
    const client = ownedClient(owner);
    if (!client) return;
    await client.scrollback(room, 30);
}

/**
 * Fetch and inject the room's current state if the SDK only holds a
 * state-less stub. No-op (false) when the room already has state, isn't
 * known, or the fetch fails. Resolves true when state was seeded — with one
 * exception: if a successor client takes over the slot mid-operation this
 * abandons the heal and resolves false even though state (and its crypto
 * config) may already have been injected, because that work belongs to a
 * session nobody is using any more.
 */
export async function seedRoomStateIfMissing(
    roomId: string,
    force = false,
): Promise<boolean> {
    if (!matrixClient) return false;
    const owner = captureOwnership(matrixClient, clientGeneration);
    const room = owner.client.getRoom(roomId);
    if (!room || seedingRooms.has(roomId)) return false;
    // `force` is for callers that KNOW the state is partial rather than
    // absent — accepting an invite, where the room carries only the handful
    // of events invite_state shipped and the server never re-sends the rest.
    // roomLacksState() can't see that: those events are real (ids and all),
    // m.room.create among them.
    if (!force && !roomLacksState(room)) return false;
    seedingRooms.add(roomId);
    try {
        const events = await owner.client.roomState(roomId);
        // A successor account owns the slot: this is the previous account's
        // room state, and every step below it (crypto config, subscriber
        // fanout) would apply to the wrong session.
        if (!ownedClient(owner)) return false;
        const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
        if (!state) return false;
        state.setStateEvents(events.map((e) => new MatrixEvent(e)));
        room.recalculate();
        // State injected here never passed through the sync loop, which is the
        // ONLY place the SDK configures a room's encryption. Without this, a
        // healed encrypted room reads as encrypted everywhere in the UI while
        // every send fails with "Cannot encrypt event in unconfigured room"
        // (incoming messages still decrypt, so it looks one-way). Bit a
        // cross-server DM 2026-07-25.
        await ensureRoomCryptoConfigured(room);
        if (!ownedClient(owner)) return false;
        // The timeline suffers the same omission as the state — backfill so
        // the room doesn't open as an empty chat despite having history.
        await backfillStubTimeline(owner, room).catch((err) =>
            console.warn("Backfill after state seeding failed:", err),
        );
        if (!ownedClient(owner)) return false;
        notifyRoomUpdate();
        for (const cb of roomHealedSubscribers) cb(roomId);
        healedRoomRegistry.markHealed(roomId);
        return true;
    } catch (err) {
        console.error("Failed to seed room state:", err);
        return false;
    } finally {
        seedingRooms.delete(roomId);
    }
}

/** Heal every state-less joined room the SDK knows about (boot pass). */
export function seedStatelessRooms(): void {
    if (!matrixClient) return;
    const owner = captureOwnership(matrixClient, clientGeneration);
    for (const room of owner.client.getRooms()) {
        if (roomLacksState(room)) {
            void seedRoomStateIfMissing(room.roomId);
        } else if (
            room.getMyMembership() === "join" &&
            !room.isSpaceRoom() &&
            room.getLiveTimeline().getEvents().length === 0
        ) {
            // State present but an empty timeline (seeded before backfill
            // existed, or the sync omission's timeline variant) — backfill
            // so the room doesn't open as an empty chat.
            void backfillStubTimeline(owner, room)
                .then(() => {
                    if (!ownedClient(owner)) return;
                    notifyRoomUpdate();
                    for (const cb of roomHealedSubscribers) cb(room.roomId);
                })
                .catch((err) =>
                    console.warn("Boot-pass timeline backfill failed:", err),
                );
        }
    }
}

/**
 * Wipe the local sync cache (IndexedDB) and reload the app. Auth is
 * untouched — the next boot performs a fresh initial sync. Escape hatch for
 * stale-cache states the server never re-delivers (continuwuity omits
 * rooms it considers "unchanged" from incremental sync, so a room cached
 * wrongly stays wrong forever).
 */
export async function clearCacheAndReload(): Promise<void> {
    try {
        const userId = matrixClient?.getUserId();
        const deviceId = matrixClient?.getDeviceId();
        if (userId && deviceId)
            await deleteSnapshot(snapshotKey(userId, deviceId));
        matrixClient?.stopClient();
        await matrixStore?.deleteAllData();
    } catch (err) {
        console.warn("Sync cache wipe failed, reloading anyway:", err);
    }
    window.location.reload();
}

// A joined-rooms mismatch — the server reports a room joined that our local sync
// cache is missing — heals in place where possible (re-assert the join, seed
// state); a cache-wipe reload is only the last resort. continuwuity both poisons
// the cache (a fresh sync WOULD re-deliver the room, so a reload helps) and
// reports outright phantoms (it never delivers the room, so nothing materializes
// it). We reload at most ONCE per unhealable room, remembered in localStorage, so
// a known phantom never re-triggers the boot "Restoring session…" double-flash on
// later cold starts.
const RECONCILE_RELOADED_KEY = "syncReconcileReloadedRooms";
const RECONCILE_RELOADED_MAX = 50;

function loadReconcileReloadedRooms(): string[] {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(RECONCILE_RELOADED_KEY) ?? "[]",
        );
        return Array.isArray(parsed)
            ? parsed.filter((x): x is string => typeof x === "string")
            : [];
    } catch {
        return [];
    }
}

function saveReconcileReloadedRooms(ids: string[]): void {
    try {
        // Bounded: only the most recent unhealable rooms need remembering.
        localStorage.setItem(
            RECONCILE_RELOADED_KEY,
            JSON.stringify(ids.slice(-RECONCILE_RELOADED_MAX)),
        );
    } catch {
        // Private-mode localStorage can throw; the one reload still happens.
    }
}

/** Re-materialize + state-seed one joined room the local cache is missing. */
async function healMissingJoinedRoom(roomId: string): Promise<boolean> {
    if (!matrixClient) return false;
    const owner = captureOwnership(matrixClient, clientGeneration);
    // Raw SDK joinRoom inside (not the joinRoom wrapper) so it never
    // re-triggers reconciliation.
    return materializeJoinedRoom(owner.client, roomId, {
        isCurrent: () => !!ownedClient(owner),
        // Forced: a room with a stale membership LOOKS stated but is behind.
        seedState: (id) => seedRoomStateIfMissing(id, true),
    });
}

let liveReconcileRunning = false;

// Whether this sync run has processed a real /sync response yet. Until it has,
// the store holds only the IndexedDB cache (or nothing, after a cache wipe), so
// diffing it against the server's joined list reports rooms as missing that the
// first live response is about to deliver. Each of those used to escalate to a
// cache-wipe reload (the boot "loads two or three times" loop), and would now
// still cost a needless /join and /state fetch. Reset by startSync.
let liveSyncDelivered = false;

/** startSync: a new sync run has not had a live response yet. */
export function resetLiveSyncDelivered(): void {
    liveSyncDelivered = false;
}

/** startSync: a live (non-cached) response landed; the first one reconciles. */
export function noteLiveSyncResponse(): void {
    if (liveSyncDelivered) return;
    liveSyncDelivered = true;
    void reconcileJoinedRoomsLive();
}

/**
 * Compare the server's joined list against ours and heal any room sync dropped,
 * preferring an in-place heal (no reload). Runs at boot (first PREPARED) and,
 * debounced, mid-session. A cache-wipe reload is the last resort, tried at most
 * once per unhealable room so a continuwuity phantom can't reload on every boot.
 */
export async function reconcileJoinedRoomsLive(): Promise<void> {
    if (!matrixClient || liveReconcileRunning || !liveSyncDelivered) return;
    // Sliding sync loads rooms in a growing window, so rooms outside it are
    // "missing" by design, not because sync dropped them.
    if (isUsingSlidingSync()) return;
    liveReconcileRunning = true;
    try {
        const server = await matrixClient.getJoinedRooms();
        const missing = server.joined_rooms.filter(
            (id) => matrixClient?.getRoom(id)?.getMyMembership() !== "join",
        );
        if (missing.length === 0) return;
        console.info("Sync heal - rooms missing locally:", missing);
        const stillMissing: string[] = [];
        for (const id of missing) {
            if (!(await healMissingJoinedRoom(id))) stillMissing.push(id);
        }
        notifyRoomUpdate();
        for (const id of missing) {
            if (matrixClient.getRoom(id)?.getMyMembership() === "join")
                for (const cb of roomHealedSubscribers) cb(id);
        }
        if (stillMissing.length === 0) return;
        // Rooms we couldn't materialize in place: reload once for any we have
        // never reloaded for (a poisoned cache may deliver them on a fresh
        // sync); never reload for one a prior reload already failed to fix.
        const plan = planReconcileReload({
            stillMissing,
            reloadedRooms: loadReconcileReloadedRooms(),
        });
        if (!plan.reload) {
            console.warn(
                "Joined-rooms mismatch a reload can't fix:",
                stillMissing,
            );
            return;
        }
        saveReconcileReloadedRooms(plan.nextReloadedRooms);
        await clearCacheAndReload();
    } catch {
        // best-effort — never surface as a user-facing error
    } finally {
        liveReconcileRunning = false;
    }
}

let liveReconcileTimer: ReturnType<typeof setTimeout> | null = null;
/** Debounced trigger for the in-session joined-rooms heal. */
export function scheduleJoinedRoomsReconcile(delayMs = 1500): void {
    if (liveReconcileTimer) return;
    liveReconcileTimer = setTimeout(() => {
        liveReconcileTimer = null;
        void reconcileJoinedRoomsLive();
    }, delayMs);
}
