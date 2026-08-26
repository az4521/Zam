/** What a tapped notification wants to open, and who posted it. */
export interface NotificationRouteTarget {
    /** The room the notification wants to open. */
    roomId?: string | null;
    /** The account that posted it, when the poster recorded one. */
    userId?: string | null;
    /**
     * The specific message the notification was raised for, when the poster
     * recorded one. Carried through so the caller can jump the timeline to the
     * exact event instead of merely opening the room. Optional: a room-level
     * notification (or an older pre-stamp one) has none, and then the caller
     * just opens the room.
     */
    eventId?: string | null;
}

export interface NotificationRouteSession {
    /** The account signed in right now, or null/undefined when signed out. */
    userId?: string | null;
}

export type NotificationRouteDecision =
    | { action: "navigate"; roomId: string; eventId?: string }
    | {
          action: "drop";
          reason: "no-room" | "signed-out" | "other-account" | "no-poster";
      };

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
 * A notification with NO recorded poster is DROPPED (fail closed — audit
 * SEC-M4). Every surface this build posts stamps the account it came from and
 * omits the room id when it cannot (see `sw.js` `notificationData` and Android
 * `MainActivity.handleRoomIntent`), so a routable-but-unstamped target can only
 * be an old pre-stamp notification still in the tray — whose tap we accept
 * breaking — or a forged Android intent from another app trying to force this
 * session into an attacker-chosen room. Dropping both is the safe choice; the
 * app is still surfaced by the caller, only the navigation is withheld.
 */
export function decideNotificationRoute(
    target: NotificationRouteTarget,
    session: NotificationRouteSession,
): NotificationRouteDecision {
    const roomId = target.roomId;
    if (!roomId) return { action: "drop", reason: "no-room" };

    const sessionUserId = session.userId;
    if (!sessionUserId) return { action: "drop", reason: "signed-out" };

    const postedBy = target.userId;
    if (!postedBy) return { action: "drop", reason: "no-poster" };
    if (postedBy !== sessionUserId)
        return { action: "drop", reason: "other-account" };

    // The event id rides along ONLY once every gate above has passed, so a
    // jump target can never bypass the poster/session check.
    return { action: "navigate", roomId, eventId: target.eventId ?? undefined };
}
