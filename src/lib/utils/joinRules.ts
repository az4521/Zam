/**
 * Pure helpers for the restricted join rule (MSC3083, room v8+): the content
 * builder, the version-support predicate, and the "can I offer this option?"
 * state helper. SDK-free so they can be unit-tested. Mirrors roomEncryption.ts's
 * getEnableEncryptionState.
 */

/** join_rule value for a space-restricted room (MSC3083). */
export const RESTRICTED_JOIN_RULE = "restricted";

/** allow-entry type granting join to members of a room (=== SDK RestrictedAllowType.RoomMembership). */
export const ROOM_MEMBERSHIP_ALLOW_TYPE = "m.room_membership";

/** One entry of a restricted join rule's `allow` list. */
export interface RestrictedAllowEntry {
    type: typeof ROOM_MEMBERSHIP_ALLOW_TYPE;
    room_id: string;
}

/** `m.room.join_rules` content shape (only the fields we write). */
export interface RestrictedJoinRuleContent {
    join_rule: typeof RESTRICTED_JOIN_RULE;
    allow: RestrictedAllowEntry[];
}

/**
 * Whether a room version supports restricted joins (MSC3083, v8+). Parses the
 * leading integer of the version string; a non-numeric / unstable version
 * (e.g. "org.matrix.msc3083") → false (conservative: show the disabled hint
 * rather than send a rule the server may reject).
 */
export function roomVersionSupportsRestricted(version: string): boolean {
    const match = /^(\d+)/.exec(version.trim());
    if (!match) return false;
    return parseInt(match[1], 10) >= 8;
}

/**
 * Build the `m.room.join_rules` content for a restricted rule granting join to
 * members of the given parent spaces. De-dupes and drops falsy ids, preserving
 * first-seen order. An empty result is still returned as `{ join_rule, allow: [] }`
 * for the caller/test to reject rather than send.
 */
export function buildRestrictedJoinRuleContent(
    parentSpaceIds: string[],
): RestrictedJoinRuleContent {
    const seen = new Set<string>();
    const allow: RestrictedAllowEntry[] = [];
    for (const id of parentSpaceIds) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        allow.push({ type: ROOM_MEMBERSHIP_ALLOW_TYPE, room_id: id });
    }
    return { join_rule: RESTRICTED_JOIN_RULE, allow };
}

export interface RestrictedJoinStateInput {
    roomVersion: string;
    /** Direct parent space ids (from getDirectParentSpaceIds). */
    parentSpaceIds: string[];
    /** Whether the user may edit room state at all (canEditState). */
    canEditState: boolean;
}
export interface RestrictedJoinState {
    /** True only when the restricted option can be selected & saved right now. */
    available: boolean;
    /** Empty when available; else the one-line disabled reason. */
    reason: string;
}

/**
 * Pure gate for whether/why the "space members can join" option is offered.
 * Reason precedence: not editable → available:false, reason:"" (the whole radio
 * group is already dimmed by canEditState); no parent space → "inside a space";
 * version unsupported → version reason; else available:true.
 */
export function getRestrictedJoinState(
    input: RestrictedJoinStateInput,
): RestrictedJoinState {
    if (!input.canEditState) return { available: false, reason: "" };
    if (input.parentSpaceIds.length === 0) {
        return {
            available: false,
            reason: "Only available for rooms inside a space",
        };
    }
    if (!roomVersionSupportsRestricted(input.roomVersion)) {
        return {
            available: false,
            reason: "This room's version doesn't support space-restricted joining",
        };
    }
    return { available: true, reason: "" };
}
