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

/** Slowest tick the focused client uses to refresh the blob (see
 *  `heartbeatIntervalFor` — short graces need a faster one). */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** Smallest tick the writer is allowed to use. */
export const MIN_HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * `ts` comes from another device's clock and is compared against ours, so it
 * needs a sanity bound (project law: never trust a foreign clock unguarded).
 * A heartbeat claiming to be from further than this in the future is a broken
 * clock, not a real one → fail open. Five minutes is generous enough to
 * absorb any ordinary skew between two correctly-set devices.
 *
 * The bound is INCLUSIVE: `ts === now + MAX_FUTURE_SKEW_MS` is still honoured,
 * only strictly beyond it fails open. The sw.js/Java copies must match.
 */
export const MAX_FUTURE_SKEW_MS = 300_000;

/**
 * Upper bound on a remote grace value: a blob past this is a bug, and
 * honouring it would mute this device indefinitely.
 *
 * It MUST stay comfortably above the largest value the picker can produce.
 * Readers clamp to it silently, so an offered option above the cap would make
 * Settings say one duration while the device behaves like another — the exact
 * asymmetry this module exists to avoid. Two hours vs. a 30-minute longest
 * preset (and a 2-hour custom ceiling, `MAX_CUSTOM_GRACE_MINUTES`).
 *
 * Hand-mirrored in `static/sw.js` and `MatrixMessagingService.java`.
 */
export const MAX_GRACE_MS = 7_200_000;

/** The choices offered in Settings. 0 = feature off. Anything else the user
 *  wants goes through the "Custom" input (`parseCustomGraceMinutes`). */
export const GRACE_OPTIONS: readonly { value: number; label: string }[] = [
    { value: 0, label: "Off — always notify" },
    { value: 15_000, label: "15 seconds" },
    { value: 30_000, label: "30 seconds" },
    { value: 60_000, label: "1 minute" },
    { value: 120_000, label: "2 minutes" },
    { value: 300_000, label: "5 minutes" },
    { value: 600_000, label: "10 minutes" },
    { value: 1_800_000, label: "30 minutes" },
];

/** Shortest custom duration. The presets already cover everything below a
 *  minute, and a typed "0.2" is far more likely to be a slip than a wish. */
export const MIN_CUSTOM_GRACE_MS = 60_000;

/** Longest custom duration, in minutes — the reader clamp expressed in the
 *  unit the input uses. Anything above is REJECTED rather than clamped: a
 *  silently curbed value is how the UI ends up lying about the behaviour. */
export const MAX_CUSTOM_GRACE_MINUTES = MAX_GRACE_MS / 60_000;

export type CustomGraceParse =
    | { ok: true; ms: number }
    | { ok: false; error: string };

/**
 * Validate a typed custom duration (in MINUTES) from the Settings picker.
 *
 * Minutes is the only unit offered on purpose: a seconds/minutes pair lets a
 * user pick "2 seconds", which every reader would honour and no one wants.
 * Out-of-range input comes back as an error for the UI to show — never as a
 * quietly clamped number, because the readers clamp too and the mismatch
 * between the two is invisible.
 */
export function parseCustomGraceMinutes(input: string): CustomGraceParse {
    const trimmed = input.trim();
    if (trimmed.length === 0)
        return { ok: false, error: "Enter a number of minutes." };
    const minutes = Number(trimmed);
    if (!Number.isFinite(minutes))
        return { ok: false, error: "Enter a number of minutes." };
    const ms = Math.round(minutes * 60_000);
    if (ms < MIN_CUSTOM_GRACE_MS)
        return {
            ok: false,
            error: "Choose at least 1 minute — use the list above for shorter times.",
        };
    if (ms > MAX_GRACE_MS)
        return {
            ok: false,
            error: `Choose ${MAX_CUSTOM_GRACE_MINUTES} minutes (2 hours) or less.`,
        };
    return { ok: true, ms };
}

/** Is this value one of the ready-made options, or a custom one? Drives which
 *  entry the Settings <select> shows for a stored value. */
export function isPresetGraceMs(ms: number): boolean {
    return GRACE_OPTIONS.some((option) => option.value === ms);
}

/** Render a stored grace as the minutes string the custom input prefills
 *  with. Must round-trip back through `parseCustomGraceMinutes` unchanged, or
 *  reopening Settings and saving would move the setting on its own. */
export function graceMsToMinutesInput(ms: number): string {
    return String(Number((ms / 60_000).toFixed(6)));
}

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

/**
 * Should this device stay quiet because another one is in active use?
 *
 * The grace window is CLAMPED to `MAX_GRACE_MS` before use: the blob is
 * written by another device and a bogus value there must not be able to mute
 * this one indefinitely. The sw.js/Java copies must mirror the clamp.
 */
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
    const graceMs = Math.min(heartbeat.graceMs, MAX_GRACE_MS);
    return now - heartbeat.ts < graceMs;
}

/**
 * How long after the last real user input a focused window still counts as
 * "in use". Focus alone is not enough: a focused window the user walked away
 * from (or a locked screen that never blurred) would otherwise keep claiming
 * the account and mute every other device indefinitely — the one failure this
 * whole module exists to prevent.
 */
export const IDLE_LIMIT_MS = 180_000;

/**
 * Is this device actually in use right now? Focus AND recent input.
 * `lastInputTs` null means "no input seen yet this session" — the caller
 * seeds it at mount, since opening the app is itself an interaction.
 */
export function isDeviceInUse(args: {
    hasFocus: boolean;
    lastInputTs: number | null;
    now: number;
    idleLimitMs: number;
}): boolean {
    const { hasFocus, lastInputTs, now, idleLimitMs } = args;
    if (!hasFocus) return false;
    if (lastInputTs === null) return false;
    if (lastInputTs > now) return true; // clock jumped back — treat as fresh
    return now - lastInputTs < idleLimitMs;
}

/**
 * Rate-limit + in-use gate for the writer.
 *
 * `hasFocus` is the CALLER'S "is this device in use" verdict, not the raw
 * `document.hasFocus()` — see `isDeviceInUse`. A window keeps focus while its
 * owner is away from the desk or the screen is locked, and publishing through
 * that would silence every other device for as long as the tab stays open.
 * The parameter keeps its old name only because callers and tests depend on it.
 */
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

/**
 * How often the focused device should refresh the blob for a given grace.
 * The blob must never be allowed to age past `graceMs` while the device is
 * still in use, or suppression flaps on and off — so refresh at half the
 * grace, capped at HEARTBEAT_INTERVAL_MS and floored at
 * MIN_HEARTBEAT_INTERVAL_MS. `graceMs <= 0` (feature off) still returns the
 * cap: the writer keeps publishing because the blob is also how the setting
 * itself reaches the other devices.
 */
export function heartbeatIntervalFor(graceMs: number): number {
    if (!Number.isFinite(graceMs) || graceMs <= 0) return HEARTBEAT_INTERVAL_MS;
    return Math.max(
        MIN_HEARTBEAT_INTERVAL_MS,
        Math.min(HEARTBEAT_INTERVAL_MS, Math.floor(graceMs / 2)),
    );
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
    let n: unknown = value;
    if (typeof n === "string") {
        const trimmed = n.trim();
        // `Number("")` and `Number("   ")` are both 0, which would read as an
        // explicit "Off". A blank stored value means "never set" → default.
        if (trimmed.length === 0) return DEFAULT_GRACE_MS;
        n = Number(trimmed);
    }
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0)
        return DEFAULT_GRACE_MS;
    // Clamp the top end too. This value is adopted from the account-data blob
    // (which any device may have written) and then RE-PUBLISHED by this one,
    // so an out-of-range grace would propagate itself forever: every reader
    // clamps to MAX_GRACE_MS, so every device would fall silent for the full
    // clamp window after each heartbeat, and the Settings <select> would show
    // blank because no <option> matches. Clamping here makes it self-healing.
    return Math.min(n, MAX_GRACE_MS);
}
