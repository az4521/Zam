/**
 * How long an unanswered incoming-call ring notification lingers before it
 * auto-dismisses as a "missed call" (ms). A closed-device call push carries no
 * "call ended" signal, so without this the ring notification never goes away.
 *
 * ⚠ MIRRORED inline in `static/sw.js` (RING_AUTO_DISMISS_MS) and
 * `IncomingCallNotification.java` (CALL_RING_TIMEOUT_MS) — those files are not
 * bundled and cannot import this. Keep the three values in sync.
 */
export const CALL_RING_TIMEOUT_MS = 45000;
