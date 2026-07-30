/**
 * A one-shot waiter for "the room I just created has landed in the SDK store".
 *
 * `MatrixClient.createRoom` is a bare POST: it never stores a Room, never emits
 * `ClientEvent.Room`, so `getRoom(newRoomId)` is null until the /sync response
 * carrying the room is processed. Everything downstream needs the Room object —
 * `scrollback` dereferences it, and `ensureRoomCryptoConfigured` reads its state
 * — and the SDK's send path silently sends PLAINTEXT when the room is unknown.
 *
 * The handle only decides WHEN the wait is over. Attaching the listener and the
 * timer stays with the caller (client.ts), which keeps this module free of SDK
 * and timer dependencies and lets every settle path be tested directly. Settling
 * is idempotent in every direction, because a real emitter can deliver an
 * arrival after the timeout already won.
 */
export interface RoomArrivalHandle<TRoom> {
    /** The room once it arrives, or null if the wait timed out. Never rejects. */
    result: Promise<TRoom | null>;
    /** True once the result is fixed; further callbacks are no-ops. */
    settled(): boolean;
    /** Feed one `ClientEvent.Room` emission in. Non-matching ids are ignored. */
    onRoomArrived(arrivedRoomId: string, room: TRoom): void;
    /** Give up waiting and resolve null. */
    onTimeout(): void;
}

export function waitForRoomArrival<TRoom>(
    roomId: string,
    existing: TRoom | null,
): RoomArrivalHandle<TRoom> {
    let done = false;
    let settle!: (room: TRoom | null) => void;
    const result = new Promise<TRoom | null>((resolve) => {
        settle = resolve;
    });

    const finish = (room: TRoom | null): void => {
        if (done) return;
        done = true;
        settle(room);
    };

    if (existing !== null && existing !== undefined) finish(existing);

    return {
        result,
        settled: () => done,
        onRoomArrived(arrivedRoomId, room) {
            if (arrivedRoomId !== roomId) return;
            finish(room);
        },
        onTimeout() {
            finish(null);
        },
    };
}
