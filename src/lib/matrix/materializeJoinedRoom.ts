import { ClientEvent, type MatrixClient } from "matrix-js-sdk";

export interface MaterializeDeps {
    /** False once a successor client owns the slot: abandon, store nothing. */
    isCurrent: () => boolean;
    /**
     * Fetch and inject the room's current state (seedRoomStateIfMissing with
     * force). Must take its in-flight lock synchronously, before its first
     * await: the membership and ClientEvent.Room listeners fired below start
     * their own seed of the same room, and the lock is what turns those into
     * no-ops instead of a second /state fetch.
     */
    seedState: (roomId: string) => Promise<boolean>;
}

/**
 * Make a room the server reports us joined to, but that the local store is
 * missing or holds with a stale membership, a usable joined Room in place.
 *
 * A room absent from the store needs a Room object built the way sync builds
 * one (reEmitter wiring, client options), and the SDK only exposes that through
 * `joinRoom`, which returns `SyncApi.createRoom(roomId)` for a room it does not
 * know. It never stores that Room (every `storeRoom` call site lives in sync
 * processing), so `getRoom()` stayed null and every such heal used to fail.
 * Storing it here is what makes the heal real. Sync, if it ever delivers the
 * room, picks up the stored Room rather than building another.
 *
 * A room the store already has is not re-joined: the server says we are in it,
 * so only the local membership and state are behind.
 *
 * Resolves false (and leaves nothing behind) when the room can't be made
 * usable, so the caller can fall back to its cache-wipe reload.
 */
export async function materializeJoinedRoom(
    client: MatrixClient,
    roomId: string,
    deps: MaterializeDeps,
): Promise<boolean> {
    let room = client.getRoom(roomId);
    if (room?.getMyMembership() === "join") return true;

    const fresh = !room;
    if (!room) {
        try {
            room = await client.joinRoom(roomId);
        } catch {
            return false;
        }
        if (!deps.isCurrent()) return false;
        // Sync may have delivered it while /join was in flight.
        const synced = client.getRoom(roomId);
        if (synced?.getMyMembership() === "join") return true;
        if (synced) room = synced;
    }
    const stored = fresh && room !== client.getRoom(roomId);
    if (stored) client.store.storeRoom(room);

    // Lock first (see MaterializeDeps.seedState), then announce.
    const seeding = deps.seedState(roomId);
    room.updateMyMembership("join");
    if (stored) client.emit(ClientEvent.Room, room);
    const seeded = await seeding.catch(() => false);

    if (!seeded && stored) {
        // A Room with no state is a nameless "Empty room" in every list:
        // take it back out rather than leave a stub behind.
        if (client.getRoom(roomId) === room) {
            client.store.removeRoom(roomId);
            client.emit(ClientEvent.DeleteRoom, roomId);
        }
        return false;
    }
    return room.getMyMembership() === "join";
}
