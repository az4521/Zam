/**
 * Pure shaping for Electron's screen-share source list. The main process
 * enumerates screens/windows with `desktopCapturer.getSources()` and pushes a
 * plain-object copy over IPC (see `electron/main.cjs`); this module turns that
 * raw list into ordered, render-safe descriptors for the in-app picker.
 *
 * Kept free of any Electron import so it stays unit-testable and safe to load
 * on web and Android, where no picker ever appears.
 */

import { t } from "$lib/i18n";
export type DisplaySourceKind = "screen" | "window";

/** One entry exactly as `electron/main.cjs` serialises it. */
export interface RawDisplaySource {
    /** Electron's `DesktopCapturerSource.id`, e.g. `screen:0:0` / `window:12:1`. */
    id: string;
    name?: string;
    thumbnailDataUrl?: string | null;
    displayId?: string;
}

/** The audio a share may carry (electron/main.cjs, electron/shareAudio.cjs). */
export interface ShareAudioOffer {
    /** What "system audio" is here: everything but Zam (our own capture),
     *  Electron's full loopback (includes Zam), or not available. */
    system: "exclude-self" | "loopback" | null;
    /** A window share can carry just that window's application. */
    windowApp: boolean;
    /** Applications with audio right now, to share one of. */
    apps: { id: string; name: string; active: boolean }[];
}

/** The `screenshare:request` payload pushed from the main process. */
export interface DisplaySourceRequest {
    requestId: number;
    audioRequested: boolean;
    /** Null when the share asked for no audio (or an older main process). */
    audio?: ShareAudioOffer | null;
    sources: RawDisplaySource[];
}

/** One entry of the picker's audio menu; `value` is what main is sent. */
export interface ShareAudioOption {
    value: string;
    label: string;
    /** Listed under the applications heading. */
    app: boolean;
}

/** The picker's audio menu for an offer, in display order: automatic, all
 *  audio, each application, none. Empty when there's nothing to choose. */
export function shareAudioOptions(
    offer: ShareAudioOffer | null | undefined,
): ShareAudioOption[] {
    if (!offer) return [];
    const out: ShareAudioOption[] = [];
    if (offer.windowApp) {
        out.push({
            value: "auto",
            label: t("screenSharePicker.audioAuto"),
            app: false,
        });
    }
    if (offer.system) {
        out.push({
            value: "system",
            label:
                offer.system === "exclude-self"
                    ? t("screenSharePicker.audioSystemExceptZam")
                    : t("screenSharePicker.audioSystem"),
            app: false,
        });
    }
    const seen = new Set<string>();
    for (const a of offer.apps ?? []) {
        const id = typeof a?.id === "string" ? a.id : "";
        const name = typeof a?.name === "string" ? a.name.trim() : "";
        if (!id || !name || seen.has(id)) continue;
        seen.add(id);
        out.push({ value: `app:${id}`, label: name, app: true });
    }
    if (!out.length) return [];
    out.push({
        value: "none",
        label: t("screenSharePicker.audioNone"),
        app: false,
    });
    return out;
}

/** Where the audio menu starts: no audio when the user turned share audio
 *  off, otherwise the broadest automatic choice there is. */
export function defaultShareAudioChoice(
    options: ShareAudioOption[],
    shareAudio: boolean,
): string {
    if (!shareAudio) return "none";
    for (const value of ["auto", "system"]) {
        if (options.some((o) => o.value === value)) return value;
    }
    return "none";
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
            name:
                name ||
                (kind === "screen"
                    ? t("displaySources.screen")
                    : t("displaySources.untitledWindow")),
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
