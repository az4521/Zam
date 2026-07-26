/**
 * Pure rules for the cross-device "active session" heartbeat.
 *
 * One account-data event, `moe.crafty.matrix.active_session`, content
 * `{ deviceId, ts, graceMs }`. The focused client writes it; every
 * notification surface reads it and stays quiet while a DIFFERENT device is
 * demonstrably in use. `graceMs` (the user's setting) travels inside the blob
 * so the service worker and the Android service get threshold + heartbeat in
 * a single request.
 *
 * Everything here FAILS OPEN: any doubt at all → notify. A suppression bug
 * that eats notifications is far worse than a redundant ping.
 *
 * `static/sw.js` and `MatrixMessagingService.java` mirror
 * `shouldSuppressForActiveDevice` by hand (they cannot import TypeScript) —
 * keep those copies in step with this file.
 */

export const ACTIVE_SESSION_KEY = "moe.crafty.matrix.active_session";

/** Default grace: 60s of "the other device is in use" before we go quiet. */
export const DEFAULT_GRACE_MS = 60_000;

/** How often the focused client refreshes the blob. */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * `ts` comes from another device's clock and is compared against ours, so it
 * needs a sanity bound (project law: never trust a foreign clock unguarded).
 * A heartbeat claiming to be from further than this in the future is a broken
 * clock, not a real one → fail open. The 60s default absorbs ordinary skew.
 */
export const MAX_FUTURE_SKEW_MS = 300_000;

/** The choices offered in Settings. 0 = feature off. */
export const GRACE_OPTIONS: readonly { value: number; label: string }[] = [
    { value: 0, label: "Off — always notify" },
    { value: 15_000, label: "15 seconds" },
    { value: 30_000, label: "30 seconds" },
    { value: 60_000, label: "1 minute" },
    { value: 120_000, label: "2 minutes" },
    { value: 300_000, label: "5 minutes" },
];

export interface ActiveSessionHeartbeat {
    /** The device that was focused when this was written. */
    deviceId: string;
    /** The WRITER's wall clock at write time (ms since epoch). */
    ts: number;
    /** How long after `ts` other devices stay quiet. 0 = never suppress. */
    graceMs: number;
}

/** Strict parse — anything unexpected yields null, i.e. "notify". */
export function parseActiveSession(
    content: unknown,
): ActiveSessionHeartbeat | null {
    if (!content || typeof content !== "object") return null;
    const c = content as Record<string, unknown>;
    const deviceId = c.deviceId;
    const ts = c.ts;
    const graceMs = c.graceMs;
    if (typeof deviceId !== "string" || deviceId.length === 0) return null;
    if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
    if (typeof graceMs !== "number" || !Number.isFinite(graceMs)) return null;
    if (graceMs < 0) return null;
    return { deviceId, ts, graceMs };
}

/** Should this device stay quiet because another one is in active use? */
export function shouldSuppressForActiveDevice(args: {
    heartbeat: ActiveSessionHeartbeat | null;
    myDeviceId: string | null;
    now: number;
}): boolean {
    const { heartbeat, myDeviceId, now } = args;
    if (!heartbeat) return false; // no blob → notify
    if (!myDeviceId) return false; // can't tell who we are → notify
    if (heartbeat.deviceId === myDeviceId) return false; // our own heartbeat
    if (heartbeat.graceMs <= 0) return false; // feature off
    if (heartbeat.ts > now + MAX_FUTURE_SKEW_MS) return false; // broken clock
    return now - heartbeat.ts < heartbeat.graceMs;
}

/** Rate-limit + focus gate for the writer. Never writes while hidden. */
export function shouldWriteHeartbeat(args: {
    lastWriteTs: number | null;
    now: number;
    hasFocus: boolean;
    intervalMs: number;
}): boolean {
    const { lastWriteTs, now, hasFocus, intervalMs } = args;
    if (!hasFocus) return false;
    if (lastWriteTs === null) return true;
    if (lastWriteTs > now) return true; // clock jumped back — don't stall
    return now - lastWriteTs >= intervalMs;
}

export function buildHeartbeat(args: {
    deviceId: string;
    now: number;
    graceMs: number;
}): ActiveSessionHeartbeat {
    return { deviceId: args.deviceId, ts: args.now, graceMs: args.graceMs };
}

/** Coerce a stored/remote grace value onto a usable number of ms. */
export function normalizeGraceMs(value: unknown): number {
    const n = typeof value === "string" ? Number(value) : value;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0)
        return DEFAULT_GRACE_MS;
    return n;
}
