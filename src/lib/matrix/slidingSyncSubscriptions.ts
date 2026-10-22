import type { MatrixClient } from "matrix-js-sdk";

type RoomSubscription = Record<string, unknown>;
type Request = {
    room_subscriptions?: Record<string, RoomSubscription>;
    unsubscribe_rooms?: string[];
};

/**
 * Add every desired room subscription the request leaves out.
 *
 * MSC4186 room subscriptions are NOT sticky: the server applies only what this
 * request carries (Synapse reads `room_subscriptions` from the request alone;
 * tuwunel happens to remember them). matrix-js-sdk's SlidingSync sends a
 * subscription once, on the request after it is added, and never again, so on
 * matrix.org the viewed room fell back to the room list's timeline_limit of 1
 * from the second response on. Any two events between polls then arrived as a
 * `limited` update holding just the newest, the gap check reset the live
 * timeline, and the open chat went blank while it refilled (issue #38).
 */
export function withAllRoomSubscriptions<T extends Request>(
    req: T,
    desired: Iterable<string>,
    subscription: RoomSubscription,
): T {
    const dropped = new Set(req.unsubscribe_rooms ?? []);
    for (const roomId of desired) {
        if (dropped.has(roomId) || req.room_subscriptions?.[roomId]) continue;
        req.room_subscriptions ??= {};
        req.room_subscriptions[roomId] = subscription;
    }
    return req;
}

/**
 * Wrap client.slidingSync so each request repeats the room subscriptions
 * `desired()` returns (see withAllRoomSubscriptions). The SDK's own
 * (un)subscribe bookkeeping is untouched, so `unsubscribe_rooms` still reaches
 * servers that do keep subscriptions.
 */
export function resendRoomSubscriptions(
    client: MatrixClient,
    desired: () => Iterable<string>,
    subscription: RoomSubscription,
): void {
    if (wrapped.has(client)) return;
    wrapped.add(client);
    const send = client.slidingSync.bind(client) as (
        req: Request,
        ...rest: unknown[]
    ) => Promise<unknown>;
    (client as unknown as { slidingSync: typeof send }).slidingSync = (
        req,
        ...rest
    ) => send(withAllRoomSubscriptions(req, desired(), subscription), ...rest);
}

// Sync setup can run again for the same client; wrap its slidingSync once.
const wrapped = new WeakSet<MatrixClient>();
