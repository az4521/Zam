/**
 * Should a notification tap open a room in the session that is live RIGHT NOW?
 *
 * Notifications outlive the session that posted them: they sit in the OS
 * notification centre across a logout, a session expiry (which swaps to the
 * login view in place, without a reload, so a page Notification's onclick
 * closure survives it) and an account switch. Without this check, tapping
 * account A's popup after signing in as B navigates B's client to A's room id
 * — the "clicking later routes an old room ID into another account" half of
 * audit finding PRIV-02.
 *
 * An UNKNOWN poster navigates. Every surface this app posts from now stamps
 * the account that posted it, so an unstamped notification can only have come
 * from a build older than this one — a population that ages out. Failing
 * closed there would silently break taps on notifications already in the tray
 * at update time. The case that unknown-fails-open would otherwise leave open
 * is handled at POST time instead: a surface with no identity omits the room
 * id entirely, so its notification is not routable in the first place.
 */
export interface NotificationRouteTarget {
    /** The room the notification wants to open. */
    roomId?: string | null;
    /** The account that posted it, when the poster recorded one. */
    userId?: string | null;
}

export interface NotificationRouteSession {
    /** The account signed in right now, or null/undefined when signed out. */
    userId?: string | null;
}

export type NotificationRouteDecision =
    | { action: "navigate"; roomId: string }
    | { action: "drop"; reason: "no-room" | "signed-out" | "other-account" };

export function decideNotificationRoute(
    target: NotificationRouteTarget,
    session: NotificationRouteSession,
): NotificationRouteDecision {
    const roomId = target.roomId;
    if (!roomId) return { action: "drop", reason: "no-room" };

    const sessionUserId = session.userId;
    if (!sessionUserId) return { action: "drop", reason: "signed-out" };

    const postedBy = target.userId;
    if (postedBy && postedBy !== sessionUserId)
        return { action: "drop", reason: "other-account" };

    return { action: "navigate", roomId };
}
