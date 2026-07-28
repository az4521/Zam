/**
 * Pure helpers for Matrix room aliases (`#localpart:server`) and the
 * `m.room.canonical_alias` state event.
 *
 * SDK-free so it can be unit-tested. `client.ts` owns every network call; this
 * module owns the grammar, the user-facing validation copy, and the content
 * arithmetic deciding what the canonical-alias event should look like after an
 * address is added, removed or promoted.
 */

/** The spec caps a full room alias at 255 bytes. */
export const MAX_ALIAS_LENGTH = 255;

/** `m.room.canonical_alias` content. Both fields are optional in the spec. */
export interface CanonicalAliasContent {
    alias?: string;
    alt_aliases?: string[];
}

export interface AliasValidation {
    valid: boolean;
    /** User-facing explanation when `valid` is false, else null. */
    reason: string | null;
}

function byteLength(value: string): number {
    return new TextEncoder().encode(value).length;
}

/** Build `#localpart:server` from its parts. */
export function buildAlias(localpart: string, serverName: string): string {
    return `#${localpart}:${serverName}`;
}

/**
 * Split `#localpart:server` back into its parts, or null if malformed.
 * Splits on the FIRST colon so a server name with a port survives intact.
 */
export function parseAlias(
    alias: string,
): { localpart: string; serverName: string } | null {
    if (!alias.startsWith("#")) return null;
    const idx = alias.indexOf(":");
    if (idx <= 1) return null;
    const localpart = alias.slice(1, idx);
    const serverName = alias.slice(idx + 1);
    if (!localpart || !serverName) return null;
    return { localpart, serverName };
}

/**
 * Validate a localpart the user typed. The spec forbids only `:` and NUL, but
 * servers are stricter in practice, so whitespace and a stray `#` are rejected
 * here too — a clear message beats an opaque server error.
 */
export function validateAliasLocalpart(
    localpart: string,
    serverName: string,
    existing: string[] = [],
): AliasValidation {
    if (!localpart) return { valid: false, reason: "Enter an address." };
    if (/\s/.test(localpart))
        return { valid: false, reason: "Addresses cannot contain spaces." };
    if (localpart.includes(":"))
        return { valid: false, reason: "Addresses cannot contain ':'." };
    if (localpart.includes("#"))
        return { valid: false, reason: "Addresses cannot contain '#'." };
    if (/[\u0000-\u001f]/.test(localpart))
        return {
            valid: false,
            reason: "Addresses cannot contain control characters.",
        };

    const full = buildAlias(localpart, serverName);
    if (byteLength(full) > MAX_ALIAS_LENGTH)
        return {
            valid: false,
            reason: `Address is too long (max ${MAX_ALIAS_LENGTH} characters).`,
        };

    const lower = full.toLowerCase();
    if (existing.some((a) => a.toLowerCase() === lower))
        return { valid: false, reason: "That address already exists." };

    return { valid: true, reason: null };
}

/**
 * Canonical-alias content for a chosen main address, preserving alternates.
 * Empty fields are OMITTED so we never publish `{"alias": ""}`.
 */
export function buildCanonicalAliasContent(input: {
    alias: string | null;
    altAliases: string[];
}): CanonicalAliasContent {
    const content: CanonicalAliasContent = {};
    if (input.alias) content.alias = input.alias;
    const alts = [...new Set(input.altAliases)].filter(
        (a) => !!a && a !== input.alias,
    );
    if (alts.length > 0) content.alt_aliases = alts;
    return content;
}

/**
 * The content to publish after `removed` is deleted from the directory, or
 * null when the event never mentioned it and needs no update.
 *
 * Deliberately does NOT promote an alternate into the vacated main slot —
 * silently republishing a different main address would surprise; the user
 * picks the replacement explicitly.
 */
export function canonicalAliasContentAfterRemoval(
    current: CanonicalAliasContent,
    removed: string,
): CanonicalAliasContent | null {
    const alias = current.alias ?? null;
    const alts = current.alt_aliases ?? [];
    if (alias !== removed && !alts.includes(removed)) return null;
    return buildCanonicalAliasContent({
        alias: alias === removed ? null : alias,
        altAliases: alts.filter((a) => a !== removed),
    });
}

/** Addresses for display: the main address first, then the rest A→Z. */
export function sortAliasesForDisplay(
    aliases: string[],
    canonical: string | null,
): string[] {
    return [...new Set(aliases)].sort((a, b) => {
        if (a === canonical) return -1;
        if (b === canonical) return 1;
        return a.localeCompare(b);
    });
}
