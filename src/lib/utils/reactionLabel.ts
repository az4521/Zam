/**
 * Human-readable names for reaction keys.
 *
 * A custom (image) reaction is keyed by its emote's `mxc://` URI, which is not
 * something to show a user. Its name comes from, in priority order:
 *   1. the reaction event's MSC4027 shortcode, `com.beeper.reaction.shortcode`
 *   2. a reverse lookup of the mxc in the known custom emoji packs
 *   3. a caller-supplied generic fallback (never the mxc itself)
 *
 * Pure: no SDK imports, so it is unit-tested directly.
 */

/** MSC4027 field carrying the shortcode on an `m.reaction` event's content. */
export const REACTION_SHORTCODE_KEY = "com.beeper.reaction.shortcode";

const SHORTCODE_RE = /^[A-Za-z0-9_.+-]{1,64}$/;

/** A shortcode without colons, or null when it is missing or not a valid name. */
export function normalizeReactionShortcode(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const name = raw.trim().replace(/^:+|:+$/g, "");
    return SHORTCODE_RE.test(name) ? name : null;
}

/** The shortcode an `m.reaction` content carries, or null. */
export function reactionShortcodeFromContent(content: unknown): string | null {
    if (!content || typeof content !== "object") return null;
    return normalizeReactionShortcode(
        (content as Record<string, unknown>)[REACTION_SHORTCODE_KEY],
    );
}

export function isMxcReactionKey(key: string): boolean {
    return key.startsWith("mxc://");
}

/**
 * The bare shortcode (no colons) for a reaction key, or null when a custom
 * reaction has no usable name. Non-mxc keys have no shortcode.
 */
export function resolveReactionShortcode(
    key: string,
    shortcode: string | null | undefined,
    emojis: readonly { shortcode: string; mxcUrl: string }[],
): string | null {
    if (!isMxcReactionKey(key)) return null;
    const fromEvent = normalizeReactionShortcode(shortcode);
    if (fromEvent) return fromEvent;
    const match = emojis.find((e) => e.mxcUrl === key);
    return match ? normalizeReactionShortcode(match.shortcode) : null;
}

/**
 * Text to show for a reaction key: the key itself for unicode / text reactions,
 * `:name:` for a custom one, and `fallback` when a custom one has no name.
 */
export function reactionDisplayName(
    key: string,
    shortcode: string | null | undefined,
    emojis: readonly { shortcode: string; mxcUrl: string }[],
    fallback: string,
): string {
    if (!isMxcReactionKey(key)) return key;
    const name = resolveReactionShortcode(key, shortcode, emojis);
    return name ? `:${name}:` : fallback;
}
