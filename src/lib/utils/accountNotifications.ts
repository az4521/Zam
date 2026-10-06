// Which of an inactive account's server notifications (GET /notifications) are
// new enough to show. Pure: the polling, decryption and posting live in
// $lib/inactiveAccountNotifier.ts.

/** One entry of the `/notifications` response, as untrusted JSON. */
export interface ServerNotification {
    actions?: unknown[];
    event?: {
        event_id?: unknown;
        type?: unknown;
        sender?: unknown;
        content?: unknown;
        room_id?: unknown;
        origin_server_ts?: unknown;
    };
    read?: unknown;
    room_id?: unknown;
    ts?: unknown;
}

export interface PickedNotifications {
    /** Unread notifications to show, oldest first. */
    fresh: ServerNotification[];
    /** The newest `ts` seen so far: the next poll's cursor. */
    cursor: number;
}

/**
 * The notifications newer than `cursor` that are unread and not already shown.
 * With no cursor yet (the first poll for an account) nothing is fresh: the
 * cursor is only set, so opening the app never replays a backlog. At most
 * `max` are returned, the newest ones, since a burst after a long gap is
 * better summarised by its latest messages than flooded.
 */
export function pickNewNotifications(
    list: readonly ServerNotification[],
    cursor: number | null,
    alreadyShown: (eventId: string) => boolean,
    max = 5,
): PickedNotifications {
    let newest = cursor ?? 0;
    for (const n of list) {
        if (typeof n.ts === "number" && n.ts > newest) newest = n.ts;
    }
    if (cursor === null) return { fresh: [], cursor: newest };
    const fresh = list
        .filter((n) => {
            const id = n.event?.event_id;
            return (
                typeof n.ts === "number" &&
                n.ts > cursor &&
                n.read !== true &&
                typeof n.room_id === "string" &&
                typeof id === "string" &&
                !alreadyShown(id)
            );
        })
        .sort((a, b) => (a.ts as number) - (b.ts as number))
        .slice(-max);
    return { fresh, cursor: newest };
}

/** Whether the push actions ask for a sound (the "loud" tier). */
export function isLoudNotification(actions: unknown): boolean {
    return (
        Array.isArray(actions) &&
        actions.some(
            (a) =>
                !!a &&
                typeof a === "object" &&
                (a as { set_tweak?: unknown }).set_tweak === "sound",
        )
    );
}
