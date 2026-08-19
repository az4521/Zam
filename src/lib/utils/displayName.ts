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
    const name = source.displayName?.trim();
    if (name && name !== source.userId) return name;
    return source.userId;
}
