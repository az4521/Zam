/**
 * Pure Matrix m.room.server_acl utilities: parse, match, validate, serialize.
 * Implements the Matrix spec's 4-step enforcement order and glob semantics.
 * SDK-free so the logic can be unit-tested.
 */

/**
 * Parsed server ACL configuration. Matrix spec shape with camelCase names.
 */
export interface ServerAcl {
    /** Allow list of server-name globs (default: empty = deny all). */
    allow: string[];
    /** Deny list of server-name globs (default: empty). Deny wins over allow. */
    deny: string[];
    /** Whether IP literal server names are allowed (default: true). */
    allowIpLiterals: boolean;
}

/**
 * Default template ACL for a room that has no m.room.server_acl event.
 * This is the editor's starting state, NOT the spec parse-default.
 * Allows all servers and IP literals.
 */
export const DEFAULT_SERVER_ACL: ServerAcl = {
    allow: ["*"],
    deny: [],
    allowIpLiterals: true,
};

/**
 * Parse an m.room.server_acl event content object into normalized ServerAcl.
 * Spec-faithful: absent/invalid allow→[], absent/invalid deny→[], non-boolean
 * allow_ip_literals→true. Array entries kept only if typeof === "string".
 */
export function parseServerAcl(
    content: Record<string, unknown> | null | undefined,
): ServerAcl {
    if (!content || typeof content !== "object") {
        return { allow: [], deny: [], allowIpLiterals: true };
    }

    const parseStringArray = (val: unknown): string[] => {
        if (!Array.isArray(val)) return [];
        return val.filter((entry) => typeof entry === "string");
    };

    const allow = parseStringArray(content.allow);
    const deny = parseStringArray(content.deny);
    const allowIpLiterals =
        typeof content.allow_ip_literals === "boolean"
            ? content.allow_ip_literals
            : true;

    return { allow, deny, allowIpLiterals };
}

/**
 * True if the content looks like an m.room.server_acl event (non-null object).
 */
export function hasServerAcl(
    content: Record<string, unknown> | null | undefined,
): boolean {
    return content != null && typeof content === "object";
}

/**
 * Convert a Matrix server ACL glob to a RegExp. Matrix glob: `*` = zero or more
 * chars, `?` = exactly one char, all other regex metachars literal. Anchored,
 * case-insensitive.
 */
export function serverAclGlobToRegExp(glob: string): RegExp {
    let pattern = "";
    for (const char of glob) {
        if (char === "*") {
            pattern += ".*";
        } else if (char === "?") {
            pattern += ".";
        } else if (/[.+^${}()|[\]\\]/.test(char)) {
            // Escape regex metachars (but NOT * or ?)
            pattern += "\\" + char;
        } else {
            pattern += char;
        }
    }
    return new RegExp("^" + pattern + "$", "i");
}

/**
 * Strip the port suffix from a server name, preserving bracketed IPv6 addresses.
 * If the server name starts with `[`, the host is everything up to and including `]`.
 * Otherwise, if the name contains exactly one `:` and the tail is all digits, drop the tail.
 */
function stripPort(serverName: string): string {
    if (serverName.startsWith("[")) {
        const closeBracket = serverName.indexOf("]");
        if (closeBracket !== -1) {
            return serverName.substring(0, closeBracket + 1);
        }
        return serverName;
    }

    const colonIndex = serverName.indexOf(":");
    if (colonIndex === -1) return serverName;
    // Only one colon AND tail is all digits → port
    if (serverName.indexOf(":", colonIndex + 1) === -1) {
        const tail = serverName.substring(colonIndex + 1);
        if (/^\d+$/.test(tail)) {
            return serverName.substring(0, colonIndex);
        }
    }
    return serverName;
}

/**
 * True if the server name is an IP literal: bare IPv4 (n.n.n.n) or bracketed IPv6 ([...]).
 * The port suffix is stripped before testing.
 */
export function isIpLiteralServerName(serverName: string): boolean {
    const host = stripPort(serverName);
    // IPv4: four 1-3 digit groups
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
    // IPv6: bracketed hex/colon notation
    if (/^\[[0-9a-fA-F:.]+\]$/.test(host)) return true;
    return false;
}

/**
 * Returns true if the server name is ALLOWED by the ACL, following the 4-step
 * Matrix spec enforcement order:
 * 1. If server is an IP literal and allow_ip_literals is false, deny.
 * 2. If server matches any deny glob, deny.
 * 3. If server matches any allow glob, allow.
 * 4. Default deny.
 */
export function matchesServerAcl(serverName: string, acl: ServerAcl): boolean {
    const host = stripPort(serverName).toLowerCase();

    // Step 1: IP literal check
    if (isIpLiteralServerName(serverName) && !acl.allowIpLiterals) {
        return false;
    }

    // Step 2: Deny list (deny wins over allow)
    for (const denyGlob of acl.deny) {
        if (serverAclGlobToRegExp(denyGlob).test(host)) {
            return false;
        }
    }

    // Step 3: Allow list
    for (const allowGlob of acl.allow) {
        if (serverAclGlobToRegExp(allowGlob).test(host)) {
            return true;
        }
    }

    // Step 4: Default deny
    return false;
}

/**
 * Validate a ServerAcl for common footguns, returning warnings.
 * Checks: empty allow list, deny contains "*", config bans your own server.
 */
export function validateServerAcl(
    acl: ServerAcl,
    ownServerName: string,
): { warnings: string[] } {
    const warnings: string[] = [];

    if (acl.allow.length === 0) {
        warnings.push(
            "Allow list is empty, which denies all servers from federating.",
        );
    }

    if (acl.deny.includes("*")) {
        warnings.push("Deny list contains *, which bans all servers.");
    }

    if (ownServerName && !matchesServerAcl(ownServerName, acl)) {
        warnings.push(
            `This configuration bans your own server (${ownServerName}), which will break federation.`,
        );
    }

    return { warnings };
}

/**
 * Serialize a ServerAcl to the Matrix event content shape: trims each entry,
 * drops empty/whitespace-only entries, dedupes (order-preserving), converts
 * allowIpLiterals back to allow_ip_literals.
 */
export function serializeServerAcl(acl: ServerAcl): {
    allow: string[];
    deny: string[];
    allow_ip_literals: boolean;
} {
    const clean = (list: string[]): string[] => {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const entry of list) {
            const trimmed = entry.trim();
            if (trimmed && !seen.has(trimmed)) {
                seen.add(trimmed);
                result.push(trimmed);
            }
        }
        return result;
    };

    return {
        allow: clean(acl.allow),
        deny: clean(acl.deny),
        allow_ip_literals: acl.allowIpLiterals,
    };
}

/**
 * Parse a user's multi-line or comma-separated server list input into an array.
 * Splits on newlines and commas, trims each entry, drops empties, dedupes
 * (order-preserving).
 */
export function parseServerListInput(text: string): string[] {
    const entries = text.split(/[\n,]/);
    const seen = new Set<string>();
    const result: string[] = [];
    for (const entry of entries) {
        const trimmed = entry.trim();
        if (trimmed && !seen.has(trimmed)) {
            seen.add(trimmed);
            result.push(trimmed);
        }
    }
    return result;
}

/**
 * Convert a server list array to newline-joined text for display/editing.
 */
export function serverListToText(list: string[]): string {
    return list.join("\n");
}
