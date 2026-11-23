/**
 * Pure MSC4284 room policy-server helpers. SDK-free so they can be unit-tested.
 *
 * A room names its policy server with a state event (empty state key) of type
 * `m.room.policy` (stable) or `org.matrix.msc4284.policy` (unstable). Homeservers
 * ask that server to sign every event, so a refusal surfaces as M_FORBIDDEN.
 */

import { parseServerAcl, type ServerAcl } from "$lib/utils/serverAcl";

export interface RoomPolicyServer {
    via: string;
    ed25519: string;
}

function nonEmptyString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** Validate one policy event content; null when it is not a usable policy. */
function parseOne(content: unknown): RoomPolicyServer | null {
    if (!content || typeof content !== "object") return null;
    const record = content as Record<string, unknown>;
    const via = nonEmptyString(record.via);
    const keys = record.public_keys;
    if (!via || !keys || typeof keys !== "object") return null;
    const ed25519 = nonEmptyString((keys as Record<string, unknown>).ed25519);
    if (!ed25519) return null;
    return { via, ed25519 };
}

/**
 * The room's policy server. The stable event wins when it is valid, otherwise
 * the unstable one, otherwise null.
 */
export function parseRoomPolicy(
    stableContent: unknown,
    unstableContent: unknown,
): RoomPolicyServer | null {
    return parseOne(stableContent) ?? parseOne(unstableContent);
}

/**
 * True when a failed send looks like a policy server refusing the event.
 * Requires M_FORBIDDEN and a room that has a policy server; then either the
 * error text mentions policy/spam, or the user has power to send (so a
 * forbidden error cannot be a plain power-level denial).
 */
export function isPolicyRefusal(input: {
    errcode?: string;
    message?: string;
    roomHasPolicyServer: boolean;
    userCanSend: boolean;
}): boolean {
    if (input.errcode !== "M_FORBIDDEN") return false;
    if (!input.roomHasPolicyServer) return false;
    return /policy|spam/i.test(input.message ?? "") || input.userCanSend;
}

/**
 * Summarise an m.room.server_acl for display. Returns null when there is no ACL
 * or it is the trivial allow-everything form (allow ["*"], deny [], IP literals
 * allowed), since that restricts nothing worth showing.
 */
export function summarizeServerAcl(content: unknown): {
    allow: string[];
    deny: string[];
    allowIpLiterals: boolean;
} | null {
    if (!content || typeof content !== "object") return null;
    const acl: ServerAcl = parseServerAcl(content as Record<string, unknown>);
    const trivial =
        acl.allow.length === 1 &&
        acl.allow[0] === "*" &&
        acl.deny.length === 0 &&
        acl.allowIpLiterals;
    if (trivial) return null;
    return {
        allow: acl.allow,
        deny: acl.deny,
        allowIpLiterals: acl.allowIpLiterals,
    };
}
