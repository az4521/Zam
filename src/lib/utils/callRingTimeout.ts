/**
 * How long an unanswered incoming-call ring notification lingers before it
 * auto-dismisses as a "missed call" (ms). A closed-device call push carries no
 * "call ended" signal, so without this the ring notification never goes away.
 *
 * ⚠ MIRRORED inline in `static/sw.js` (RING_AUTO_DISMISS_MS) and
 * `MatrixMessagingService.java` (CALL_RING_TIMEOUT_MS) — those files are not
 * bundled and cannot import this. Keep the three values in sync.
 */
export const CALL_RING_TIMEOUT_MS = 45000;

/**
 * The auto-dismiss delay for a notification, or null when it must persist until
 * the user acts. Only incoming-call rings auto-dismiss; a message notification
 * is transient already so it never gets a timer.
 */
export function ringDismissDelayMs(isCall: boolean): number | null {
    return isCall ? CALL_RING_TIMEOUT_MS : null;
}
