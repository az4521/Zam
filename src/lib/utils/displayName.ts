// Decide how to render a Matrix user's name: their display name by default,
// or their full Matrix id (@user:server) when the "Show Matrix IDs" setting
// is on. Pure and SDK-agnostic — callers pass a member-like object so this
// stays testable and free of matrix-js-sdk imports.

export interface NameSource {
    userId: string;
    displayName?: string | null;
}

export interface ResolveDisplayNameOptions {
    preferId?: boolean;
}

export function resolveDisplayName(
    source: NameSource,
    options: ResolveDisplayNameOptions = {},
): string {
    if (options.preferId) return source.userId;
    let name = source.displayName?.trim();
    if (name) {
        // matrix-js-sdk disambiguates a colliding display name by appending
        // " (@localpart:server)". Strip that suffix so the toggle-OFF path
        // shows the clean display name. An MXID has no spaces or parens, so
        // this never touches a legitimate parenthetical like "(Discord)".
        const stripped = name.replace(/\s*\(@[^\s()]+:[^\s()]+\)$/, "").trim();
        if (stripped) {
            name = stripped;
        } else if (name.match(/^\s*\(@[^\s()]+:[^\s()]+\)$/)) {
            // Name was only the suffix, clear it to fall back to userId
            name = "";
        }
    }
    if (name && name !== source.userId) return name;
    return source.userId;
}
