// The wire format for the customization settings we sync to the homeserver
// as account data (see stores/customizationSync.svelte).
//
// Every field is optional and typed as a bare primitive rather than as the
// app's union types (Theme, GifTab, …). This content is remote data: it comes
// from whatever this account's other devices — possibly an older or newer
// build — last wrote, so it is untrusted at the type level. The settings store
// runs each field through its usual normalize* helper on the way in, which is
// where the unions and the defaults are enforced.

import { sanitizeThemeColors } from "./themePalette";
import { sanitizeCustomPreset, type CustomPreset } from "./themePreset";

export interface ClientCustomization {
    theme?: string;
    timeClock?: string;
    dateStyle?: string;
    customDatePattern?: string;
    alwaysAbsolute?: boolean;
    gifDefaultTab?: string;
    keepSidebarOpen?: boolean;
    ownDoubleTapAction?: string;
    otherDoubleTapAction?: string;
    doubleTapReaction?: string;
    doubleTapReactionBySpace?: Record<string, string>;
    themePresets?: Record<string, CustomPreset>;
    activePreset?: string;
}

function str(v: unknown): string | undefined {
    return typeof v === "string" ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
    return typeof v === "boolean" ? v : undefined;
}

function stringMap(v: unknown): Record<string, string> | undefined {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    return Object.fromEntries(
        Object.entries(v).filter(
            (e): e is [string, string] =>
                typeof e[1] === "string" && e[1].length > 0,
        ),
    );
}

function themePresetsMap(v: unknown): Record<string, CustomPreset> | undefined {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;

    const entries = Object.entries(v);
    const result: Record<string, CustomPreset> = {};
    let count = 0;

    for (const [key, value] of entries) {
        if (count >= 50) break;
        const sanitized = sanitizeCustomPreset(value);
        if (sanitized !== null) {
            result[key] = sanitized;
            count++;
        }
    }

    return result;
}

/**
 * Keep only known keys holding the right primitive type, dropping everything
 * else. A field another build wrote but this one doesn't know about is not
 * preserved — see the round-trip note in customizationSync.
 */
export function sanitizeCustomization(raw: unknown): ClientCustomization {
    if (!raw || typeof raw !== "object") return {};
    const r = raw as Record<string, unknown>;
    const out: ClientCustomization = {
        theme: str(r.theme),
        timeClock: str(r.timeClock),
        dateStyle: str(r.dateStyle),
        customDatePattern: str(r.customDatePattern),
        alwaysAbsolute: bool(r.alwaysAbsolute),
        gifDefaultTab: str(r.gifDefaultTab),
        keepSidebarOpen: bool(r.keepSidebarOpen),
        ownDoubleTapAction: str(r.ownDoubleTapAction),
        otherDoubleTapAction: str(r.otherDoubleTapAction),
        doubleTapReaction: str(r.doubleTapReaction),
        doubleTapReactionBySpace: stringMap(r.doubleTapReactionBySpace),
        themePresets: themePresetsMap(r.themePresets),
        activePreset: str(r.activePreset),
    };
    // Drop absent keys so an empty payload serializes as {} rather than a
    // wall of undefined, keeping the equality check in the sync layer honest.
    for (const k of Object.keys(out) as Array<keyof ClientCustomization>) {
        if (out[k] === undefined) delete out[k];
    }
    return out;
}
