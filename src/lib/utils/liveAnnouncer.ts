/**
 * Pure reducer behind the timeline's screen-reader announcer (A11Y-06).
 *
 * A screen-reader user typing in the composer is never told that messages
 * arrived: the timeline carries no live semantics, and it cannot be given any,
 * because backfill *replaces* the whole message array — an implicit live region
 * would re-announce the entire visible history on every scroll-up. So the
 * timeline stays `aria-live="off"` and a separate polite region is fed from
 * here instead.
 *
 * This module owns only the decision of *what a drain should say*. The caller
 * owns the timer: it calls `recordArrival` per live append and, after a quiet
 * `ANNOUNCE_DEBOUNCE_MS`, calls `drainAnnouncement` once for the whole burst.
 * That is what keeps a ten-message flood from becoming ten interruptions.
 *
 * Pure and dependency-free so it can be unit-tested without a DOM or the SDK.
 */

export interface ArrivedMessage {
    eventId: string;
    sender: string; // display name, already resolved by the caller
    isOwn: boolean; // sent by this user (local echo) — never announced
    body: string; // plain-text preview, may be ""
}

export interface AnnouncerState {
    readonly pending: readonly ArrivedMessage[];
    readonly seen: readonly string[];
}

/** Quiet period before a burst is announced as one utterance. */
export const ANNOUNCE_DEBOUNCE_MS = 800;

/** Longest body read out verbatim; anything longer is cut and elided. */
export const MAX_BODY_CHARS = 120;

/**
 * Cap on remembered event ids. Only there to stop an all-day session from
 * growing the set without bound — dedupe only ever needs to look back far
 * enough to catch the SDK re-emitting an event we just handled.
 */
const MAX_SEEN_IDS = 200;

export const EMPTY_ANNOUNCER: AnnouncerState = { pending: [], seen: [] };

/**
 * Queue a newly arrived message for the next announcement.
 *
 * Returns the **identical state object** when the message is dropped (own
 * echo, missing id, or an id already queued or announced). The caller compares
 * with `!==` to decide whether to restart its debounce timer, so returning a
 * fresh-but-equal object would restart the timer forever and nothing would ever
 * be announced.
 */
export function recordArrival(
    state: AnnouncerState,
    msg: ArrivedMessage,
): AnnouncerState {
    // Own messages: the user knows they sent them, and the composer already
    // gives feedback. Announcing them is pure noise.
    if (msg.isOwn) return state;
    // Without an id there is no dedupe key, and every re-emit of the same event
    // would announce again. Dropping is the safe direction.
    if (!msg.eventId) return state;
    if (state.pending.some((p) => p.eventId === msg.eventId)) return state;
    if (state.seen.includes(msg.eventId)) return state;
    return { pending: [...state.pending, msg], seen: state.seen };
}

/**
 * Turn everything queued into one utterance and empty the queue.
 *
 * Returns the identical state and an empty string when nothing is pending, so
 * a stray drain never re-announces and never churns the caller's state.
 */
export function drainAnnouncement(state: AnnouncerState): {
    state: AnnouncerState;
    text: string;
} {
    if (state.pending.length === 0) return { state, text: "" };
    const text = describeArrivals(state.pending);
    const seen = [...state.seen, ...state.pending.map((m) => m.eventId)];
    return {
        state: { pending: [], seen: seen.slice(-MAX_SEEN_IDS) },
        text,
    };
}

/** Newlines and runs of spaces read as a run-on sentence; flatten them. */
function collapseWhitespace(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function truncateBody(body: string): string {
    return body.length > MAX_BODY_CHARS
        ? `${body.slice(0, MAX_BODY_CHARS)}…`
        : body;
}

function describeArrivals(pending: readonly ArrivedMessage[]): string {
    if (pending.length === 1) {
        const only = pending[0];
        const body = truncateBody(collapseWhitespace(only.body));
        // Bodiless events (an image, a sticker, an undecryptable message) still
        // deserve "something arrived, from whom".
        return body ? `${only.sender}: ${body}` : `Message from ${only.sender}`;
    }
    // A burst is summarised, not read out: reading five bodies back to back
    // buries the composer the user is trying to type in.
    const senders = new Set(pending.map((m) => m.sender));
    return senders.size === 1
        ? `${pending.length} new messages from ${pending[0].sender}`
        : `${pending.length} new messages`;
}
