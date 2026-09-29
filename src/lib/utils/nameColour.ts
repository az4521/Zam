import { contrastRatio, relativeLuminance } from "./contrast";
import type { ColourPreference } from "./extendedProfile";

/** Below WCAG's 3:1 non-text threshold a name is too hard to read. */
const MIN_CONTRAST = 3;
/** Backgrounds darker than this count as a dark theme. */
const DARK_BACKGROUND_LUMINANCE = 0.2;

/**
 * The colour to draw a name in over `background`, from a user's MSC4522
 * preference. Uses the half matching the theme, falls back to the other half,
 * and returns null (use the default) when neither is readable.
 */
export function pickNameColour(
    preference: ColourPreference | null | undefined,
    background: string,
): string | null {
    if (!preference) return null;
    let dark: boolean;
    try {
        dark = relativeLuminance(background) < DARK_BACKGROUND_LUMINANCE;
    } catch {
        return null;
    }
    const ordered = dark
        ? [preference.on_dark, preference.on_light]
        : [preference.on_light, preference.on_dark];
    return (
        ordered.find((c) => contrastRatio(c, background) >= MIN_CONTRAST) ??
        null
    );
}
