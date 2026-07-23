/**
 * Pure helpers for live location sharing (MSC3672 beacons, built on MSC3488
 * m.location). No DOM/SDK/Svelte state — all inputs are `unknown` because they
 * come from untrusted event content and must never throw during render.
 */

import { parseGeoUri } from "./location";

const BEACON_INFO_TYPES = ["m.beacon_info", "org.matrix.msc3672.beacon_info"];
const BEACON_TYPES = ["m.beacon", "org.matrix.msc3672.beacon"];

/**
 * True iff `type` is a beacon_info state event type: one of the stable/unstable
 * base types, or one of them followed by a `.`-prefixed per-owner suffix
 * (e.g. `"m.beacon_info.@bob:hs"`). Non-string → false.
 */
export function isBeaconInfoEventType(type: unknown): boolean {
    if (typeof type !== "string") return false;
    return BEACON_INFO_TYPES.some(
        (base) => type === base || type.startsWith(base + "."),
    );
}

/**
 * True iff `type` equals the stable or unstable beacon (location) event type.
 * No suffix tolerance. Non-string → false.
 */
export function isBeaconEventType(type: unknown): boolean {
    if (typeof type !== "string") return false;
    return BEACON_TYPES.includes(type);
}

export interface ParsedBeaconInfo {
    description?: string;
    timeoutMs: number;
    live: boolean;
    startTs: number;
    expiresAt: number;
}

/**
 * Parse an m.beacon_info state event's content. Returns null when the content
 * is missing required, well-typed fields (`timeout` > 0, strict boolean
 * `live`). `startTs` uses `org.matrix.msc3488.ts` when it is a finite number,
 * otherwise the event's origin timestamp.
 */
export function parseBeaconInfo(
    content: unknown,
    eventTs: number,
): ParsedBeaconInfo | null {
    if (content === null || typeof content !== "object") return null;
    const c = content as Record<string, unknown>;

    const timeout = c.timeout;
    if (
        typeof timeout !== "number" ||
        !Number.isFinite(timeout) ||
        timeout <= 0
    )
        return null;

    const live = c.live;
    if (typeof live !== "boolean") return null;

    const tsRaw = c["org.matrix.msc3488.ts"];
    const startTs =
        typeof tsRaw === "number" && Number.isFinite(tsRaw) ? tsRaw : eventTs;

    const result: ParsedBeaconInfo = {
        timeoutMs: timeout,
        live,
        startTs,
        expiresAt: startTs + timeout,
    };
    if (typeof c.description === "string") result.description = c.description;
    return result;
}

/**
 * Extract {lat, lon} from a beacon's latest location state — an object with a
 * string `uri` in geo: form. Null-tolerant: anything malformed → null.
 */
export function beaconGeo(
    latestLocationState: unknown,
): { lat: number; lon: number } | null {
    if (latestLocationState === null || typeof latestLocationState !== "object")
        return null;
    const uri = (latestLocationState as Record<string, unknown>).uri;
    return parseGeoUri(uri);
}

/** MSC3489: location updates are sent by the sharer. The beacon_info state is
 * auth-protected but m.beacon updates are plain timeline events — accept a
 * location only from the beacon's owner, else treat the beacon as location-less. */
export function ownedLatestLocation(beacon: {
    beaconInfoOwner: string;
    latestLocationEvent?: { getSender(): string | null } | undefined;
}): typeof beacon.latestLocationEvent | undefined {
    const ev = beacon.latestLocationEvent;
    return ev && ev.getSender() === beacon.beaconInfoOwner ? ev : undefined;
}

/** Human "time left" for a live share, given its expiry and the current time. */
export function remainingLabel(expiresAt: number, now: number): string {
    const ms = expiresAt - now;
    if (ms <= 0) return "Expired";
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 1) return "less than a minute left";
    if (totalMin < 60) return `${totalMin} min left`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h} h left` : `${h} h ${m} min left`;
}

/** Human "last updated" label for a location fix at `ts`, relative to `now`. */
export function updatedAgoLabel(ts: number, now: number): string {
    const diff = now - ts;
    if (diff < 10000) return "just now";
    if (diff < 60000) return `${Math.floor(diff / 1000)} s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    return `${Math.floor(diff / 3600000)} h ago`;
}

/**
 * Rate-limit outgoing location updates: send if nothing has been sent yet, or
 * if at least `minIntervalMs` has elapsed since the last send.
 */
export function shouldSendUpdate(
    lastSentTs: number | null,
    now: number,
    minIntervalMs = 5000,
): boolean {
    if (lastSentTs == null) return true;
    return now - lastSentTs >= minIntervalMs;
}

/** The offered live-share durations, in presentation order. */
export const LIVE_SHARE_DURATIONS: { label: string; ms: number }[] = [
    { label: "15 minutes", ms: 900000 },
    { label: "1 hour", ms: 3600000 },
    { label: "8 hours", ms: 28800000 },
];
