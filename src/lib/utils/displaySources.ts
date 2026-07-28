/**
 * Pure shaping for Electron's screen-share source list. The main process
 * enumerates screens/windows with `desktopCapturer.getSources()` and pushes a
 * plain-object copy over IPC (see `electron/main.cjs`); this module turns that
 * raw list into ordered, render-safe descriptors for the in-app picker.
 *
 * Kept free of any Electron import so it stays unit-testable and safe to load
 * on web and Android, where no picker ever appears.
 */

export type DisplaySourceKind = "screen" | "window";

/** One entry exactly as `electron/main.cjs` serialises it. */
export interface RawDisplaySource {
    /** Electron's `DesktopCapturerSource.id`, e.g. `screen:0:0` / `window:12:1`. */
    id: string;
    name?: string;
    thumbnailDataUrl?: string | null;
    displayId?: string;
}

/** The `screenshare:request` payload pushed from the main process. */
export interface DisplaySourceRequest {
    requestId: number;
    audioRequested: boolean;
    sources: RawDisplaySource[];
}

export interface DisplaySource {
    id: string;
    name: string;
    kind: DisplaySourceKind;
    /** A `data:image/…` thumbnail, or null when there is nothing safe to show. */
    thumbnailDataUrl: string | null;
}

/** Electron ids are `screen:XX:YY` or `window:XX:YY`; anything unrecognised is
 *  treated as a window (the conservative label — it never claims "whole screen"
 *  for something that is not one). */
export function sourceKind(id: string): DisplaySourceKind {
    return id.startsWith("screen:") ? "screen" : "window";
}

/** Only a data URL may reach the picker's `<img src>`: the list crosses an IPC
 *  boundary, and a remote URL there would be an unexpected network fetch. */
function safeThumbnail(value: string | null | undefined): string | null {
    return typeof value === "string" && value.startsWith("data:image/")
        ? value
        : null;
}

/** Normalise, dedupe and order the raw list: screens first (they are the usual
 *  intent), then windows, stable within each group. */
export function shapeDisplaySources(
    raw: RawDisplaySource[] | null | undefined,
): DisplaySource[] {
    if (!raw?.length) return [];
    const byId = new Map<string, DisplaySource>();
    for (const entry of raw) {
        const id = entry?.id?.trim();
        if (!id || byId.has(id)) continue;
        const kind = sourceKind(id);
        const name = entry.name?.trim();
        byId.set(id, {
            id,
            name: name || (kind === "screen" ? "Screen" : "Untitled window"),
            kind,
            thumbnailDataUrl: safeThumbnail(entry.thumbnailDataUrl),
        });
    }
    const ordered = [...byId.values()];
    const rank = (k: DisplaySourceKind) => (k === "screen" ? 0 : 1);
    // Array.prototype.sort is stable, so input order survives within a group.
    return ordered.sort((a, b) => rank(a.kind) - rank(b.kind));
}

/** Split for the picker's two sections. */
export function groupDisplaySources(sources: DisplaySource[]): {
    screens: DisplaySource[];
    windows: DisplaySource[];
} {
    return {
        screens: sources.filter((s) => s.kind === "screen"),
        windows: sources.filter((s) => s.kind === "window"),
    };
}
