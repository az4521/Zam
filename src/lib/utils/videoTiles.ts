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
 *  auto-promotes the first screenshare that has just appeared, unless it is
 *  our own: the sharer would only see their own screen (a hall of mirrors
 *  when sharing the whole screen) instead of the call. */
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
        (t) => t.source === "screenshare" && !t.isLocal && !prev.has(t.key),
    );
    return fresh?.key ?? null;
}

/** Other people's screen shares that weren't there last time. */
export function newRemoteShares(
    prevKeys: string[],
    tiles: VideoTileDescriptor[],
): VideoTileDescriptor[] {
    const prev = new Set(prevKeys);
    return tiles.filter(
        (t) => t.source === "screenshare" && !t.isLocal && !prev.has(t.key),
    );
}

/** The one stream worth floating over the app. What the user chose wins (the
 *  tile sent to the system window, then the spotlight); otherwise someone
 *  else's screen, then whoever is talking, staying on `current` through the
 *  silences so the picture doesn't jump. Never our own video unless asked for:
 *  a sharer would only get a hall of mirrors (see nextFocus). */
export function pickPipTile(
    tiles: VideoTileDescriptor[],
    opts: {
        pinned: string | null;
        focused: string | null;
        current: string | null;
        speakingUserIds: { has(userId: string): boolean };
    },
): VideoTileDescriptor | null {
    const byKey = (key: string | null) =>
        tiles.find((t) => t.key === key) ?? null;
    const chosen = byKey(opts.pinned) ?? byKey(opts.focused);
    if (chosen) return chosen;
    const remote = tiles.filter((t) => !t.isLocal);
    return (
        remote.find((t) => t.source === "screenshare") ??
        remote.find((t) => opts.speakingUserIds.has(t.userId)) ??
        remote.find((t) => t.key === opts.current) ??
        remote[0] ??
        null
    );
}

/** Where the floating video rests: against one side of the window, `at` of
 *  the way along it (0 is the top or left end, 1 the bottom or right). A
 *  fraction rather than pixels so it stays put when the window resizes. */
export interface PipPlacement {
    side: "top" | "bottom" | "left" | "right";
    at: number;
}

/** Settle a dragged video against whichever side it is closest to, keeping
 *  where it was along that side. `x` and `y` are its top-left corner, and the
 *  bounds are the range that corner can rest in. */
export function snapPipToEdge(
    x: number,
    y: number,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
): PipPlacement {
    const { minX, maxX, minY, maxY } = bounds;
    const fraction = (value: number, min: number, max: number) =>
        max > min ? Math.min(Math.max((value - min) / (max - min), 0), 1) : 0;
    const gaps = {
        top: y - minY,
        bottom: maxY - y,
        left: x - minX,
        right: maxX - x,
    };
    const closest = Math.min(...Object.values(gaps));
    if (closest === gaps.top || closest === gaps.bottom) {
        return {
            side: closest === gaps.top ? "top" : "bottom",
            at: fraction(x, minX, maxX),
        };
    }
    return {
        side: closest === gaps.left ? "left" : "right",
        at: fraction(y, minY, maxY),
    };
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
