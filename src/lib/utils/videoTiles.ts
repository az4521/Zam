/**
 * Pure logic for the call video grid: turn LiveKit video publications into
 * ordered, keyed tiles, and decide which tile holds the spotlight. Kept free
 * of any LiveKit import so it stays unit-testable; the track object is carried
 * through opaquely as `unknown`.
 */

export type VideoSource = "camera" | "screenshare";

export interface VideoPublicationInput {
    userId: string;
    identity: string; // "@user:server:DEVICE"
    source: VideoSource;
    isLocal: boolean;
    track: unknown; // LiveKit Track — never inspected here
}

export interface VideoTileDescriptor {
    key: string; // `${identity}:${source}`
    userId: string;
    identity: string;
    source: VideoSource;
    isLocal: boolean;
    track: unknown;
}

/** Screenshares first (they're the reason to look), then cameras; stable by
 *  identity within each source. Deduped by key. */
export function buildVideoTiles(
    pubs: VideoPublicationInput[],
): VideoTileDescriptor[] {
    const byKey = new Map<string, VideoTileDescriptor>();
    for (const p of pubs) {
        const key = `${p.identity}:${p.source}`;
        if (byKey.has(key)) continue;
        byKey.set(key, {
            key,
            userId: p.userId,
            identity: p.identity,
            source: p.source,
            isLocal: p.isLocal,
            track: p.track,
        });
    }
    const rank = (s: VideoSource) => (s === "screenshare" ? 0 : 1);
    return [...byKey.values()].sort(
        (a, b) =>
            rank(a.source) - rank(b.source) ||
            a.identity.localeCompare(b.identity),
    );
}

/** Spotlight selection. Manual focus (a non-null `current` still present)
 *  always wins; a focus that left falls back to the grid; an unfocused grid
 *  auto-promotes the first screenshare that has just appeared. */
export function nextFocus(
    prevKeys: string[],
    tiles: VideoTileDescriptor[],
    current: string | null,
): string | null {
    const present = new Set(tiles.map((t) => t.key));
    if (current && present.has(current)) return current;
    if (current) return null;
    const prev = new Set(prevKeys);
    const fresh = tiles.find(
        (t) => t.source === "screenshare" && !prev.has(t.key),
    );
    return fresh?.key ?? null;
}

/** Whether this environment can capture a screen (web/desktop yes; Capacitor
 *  Android WebView no). Feature-detected, not platform-sniffed. */
export function canScreenShare(env: { getDisplayMedia?: unknown }): boolean {
    return typeof env.getDisplayMedia === "function";
}

/** The impure adapter for the above — the one line of `navigator` poking that
 *  every call surface would otherwise copy. Support is fixed for the session,
 *  so callers may hold the result in a plain const. */
export function screenShareSupportedHere(): boolean {
    return canScreenShare({
        getDisplayMedia:
            typeof navigator !== "undefined"
                ? navigator.mediaDevices?.getDisplayMedia
                : undefined,
    });
}
