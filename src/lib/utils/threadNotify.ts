/**
 * Whether a thread-reply event should raise an app notification/ping.
 *
 * Mirrors the main-timeline gating: `notify` already encodes the room's push /
 * mute state and keyword/mention rules (from getPushActionsForEvent). On top of
 * that, a thread reply is surfaced only when the user is a PARTICIPANT in the
 * thread or is MENTIONED — never for own events, and never for every reply in
 * the room (that would be noisy).
 */
export function shouldNotifyThreadEvent(params: {
    /** Sender is the current user — never self-notify. */
    isOwnEvent: boolean;
    /** Push rules say notify (respects mute + keyword/mention rules). */
    notify: boolean;
    /** Current user participates in this thread (authored root or a reply). */
    isParticipant: boolean;
    /** Current user is mentioned by this reply (push highlight tweak). */
    isMentioned: boolean;
}): boolean {
    if (params.isOwnEvent) return false;
    if (!params.notify) return false;
    return params.isParticipant || params.isMentioned;
}
