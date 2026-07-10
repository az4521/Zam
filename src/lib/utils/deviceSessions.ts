/**
 * Pure helpers for the Sessions panel: ordering and describing the devices
 * the server reports for the logged-in user, plus a User-Interactive Auth
 * flow check. SDK-free so it can be unit-tested.
 */

export interface DeviceInfo {
    deviceId: string;
    displayName?: string;
    lastSeenIp?: string;
    lastSeenTs?: number;
    lastSeenUserAgent?: string;
}

/**
 * Order devices for display: the current session first, then by last-seen
 * (newest first, never-seen last), with device id as a stable tiebreak.
 * Returns a new array.
 */
export function sortDevices<
    T extends { deviceId: string; lastSeenTs?: number },
>(devices: T[], currentDeviceId: string | null): T[] {
    return [...devices].sort((a, b) => {
        if (a.deviceId === currentDeviceId) return -1;
        if (b.deviceId === currentDeviceId) return 1;
        const ta = a.lastSeenTs ?? -1;
        const tb = b.lastSeenTs ?? -1;
        if (ta !== tb) return tb - ta;
        return a.deviceId.localeCompare(b.deviceId);
    });
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Humanize a last-seen timestamp relative to `now`: "Just now" (including
 * small clock skew into the future), relative units up to a week, then a
 * calendar date. Servers may omit the timestamp entirely → "Unknown".
 */
export function formatLastSeen(ts: number | undefined, now: number): string {
    if (ts === undefined) return "Unknown";
    const ago = (n: number, unit: string): string =>
        `${n} ${unit}${n === 1 ? "" : "s"} ago`;
    const age = now - ts;
    if (age < MINUTE) return "Just now";
    if (age < HOUR) return ago(Math.floor(age / MINUTE), "minute");
    if (age < DAY) return ago(Math.floor(age / HOUR), "hour");
    if (age < 7 * DAY) return ago(Math.floor(age / DAY), "day");
    return new Date(ts).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

/**
 * Turn a raw user-agent string into a short human description like
 * "Firefox on Windows" or "Element on Android". Returns null when there is
 * nothing recognizable to say.
 */
export function describeUserAgent(ua: string | undefined): string | null {
    if (!ua) return null;

    // Order matters: Android UAs also contain "Linux", iOS UAs contain
    // "like Mac OS X".
    const os = ua.includes("Android")
        ? "Android"
        : /iPhone|iPad|iPod/.test(ua)
          ? "iOS"
          : ua.includes("Windows")
            ? "Windows"
            : /Macintosh|Mac OS X/.test(ua)
              ? "macOS"
              : /Linux|X11/.test(ua)
                ? "Linux"
                : null;

    // Order matters again: Electron and Edge UAs also contain "Chrome",
    // Chrome UAs also contain "Safari".
    let client: string | null = null;
    if (ua.includes("Electron/")) client = "Desktop app";
    else if (ua.includes("Edg/")) client = "Edge";
    else if (ua.includes("Firefox/")) client = "Firefox";
    else if (ua.includes("Chrome/")) client = "Chrome";
    else if (ua.includes("Safari/")) client = "Safari";
    else {
        // Non-browser clients ("Element/1.11.66 (…)"): use the product name.
        const product = ua.match(/^([A-Za-z][\w .-]*)\//);
        if (product) client = product[1];
    }

    if (client && os) return `${client} on ${os}`;
    return client ?? os;
}

/**
 * Whether a User-Interactive Auth challenge can be completed with just the
 * account password — i.e. some advertised flow is exactly one
 * m.login.password stage. Anything else (SSO, recaptcha, multi-stage) is
 * not something this client can drive.
 */
export function supportsPasswordUia(
    flows: { stages: string[] }[] | undefined,
): boolean {
    return (
        flows?.some(
            (f) => f.stages.length === 1 && f.stages[0] === "m.login.password",
        ) ?? false
    );
}
