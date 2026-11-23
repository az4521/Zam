// Invite blocking (MSC4380): the pure pieces. Which account-data type to use,
// how a type's content reads, and whether a send error is the "invite
// blocked" rejection. No SDK imports, so it is testable on its own; client.ts
// does the reads and writes, and the store in stores/inviteBlocking.svelte.ts
// keeps the UI state.
//
// `static/sw.js` carries a hand-written mirror of the stable-then-unstable
// read (invitesBlockedFor) for the push path, since it cannot import
// TypeScript. Keep the two in step.

export const STABLE_INVITE_PERMISSION_TYPE = "m.invite_permission_config";
export const UNSTABLE_INVITE_PERMISSION_TYPE =
    "org.matrix.msc4380.invite_permission_config";

/** `/versions` unstable_features: the stable flag wins over the unstable one. */
const STABLE_FEATURE = "org.matrix.msc4380.stable";
const UNSTABLE_FEATURE = "org.matrix.msc4380";

/**
 * What the homeserver does with the setting. "stable" and "unstable" mean the
 * server enforces it (it rejects invites); "none" means the app alone hides
 * invites.
 */
export type InviteBlockingSupport = "stable" | "unstable" | "none";

export function inviteBlockingSupport(
    unstableFeatures: Record<string, boolean> | null | undefined,
): InviteBlockingSupport {
    if (unstableFeatures?.[STABLE_FEATURE] === true) return "stable";
    if (unstableFeatures?.[UNSTABLE_FEATURE] === true) return "unstable";
    return "none";
}

/**
 * The account-data type to write. Only a server that advertises just the
 * unstable MSC gets the unstable type; everything else gets the stable one,
 * which also syncs to the user's other devices.
 */
export function inviteBlockingWriteType(
    support: InviteBlockingSupport,
): string {
    return support === "unstable"
        ? UNSTABLE_INVITE_PERMISSION_TYPE
        : STABLE_INVITE_PERMISSION_TYPE;
}

export function isInviteBlockingAccountType(type: string): boolean {
    return (
        type === STABLE_INVITE_PERMISSION_TYPE ||
        type === UNSTABLE_INVITE_PERMISSION_TYPE
    );
}

/** The content that blocks every invite, or the one that allows them. */
export function inviteBlockingContent(
    blocked: boolean,
): Record<string, string> {
    return blocked ? { default_action: "block" } : {};
}

/** Whether one account-data content blocks all invites. */
export function invitesBlockedFromContent(content: unknown): boolean {
    return (
        typeof content === "object" &&
        content !== null &&
        (content as { default_action?: unknown }).default_action === "block"
    );
}

/**
 * Whether invites are blocked, given the two account-data contents (undefined
 * or null when absent). A present stable type decides, even `{}`; the
 * unstable type is read only when the stable one is absent.
 */
export function resolveInvitesBlocked(
    stableContent: unknown | null | undefined,
    unstableContent: unknown | null | undefined,
): boolean {
    const chosen =
        stableContent !== undefined && stableContent !== null
            ? stableContent
            : unstableContent;
    return invitesBlockedFromContent(chosen);
}

const INVITE_BLOCKED_ERRCODES = new Set([
    "M_INVITE_BLOCKED",
    "ORG.MATRIX.MSC4155.INVITE_BLOCKED",
]);

/** Whether a failed invite was rejected because the invitee blocks invites. */
export function isInviteBlockedError(err: unknown): boolean {
    if (typeof err !== "object" || err === null) return false;
    const e = err as { errcode?: unknown; data?: { errcode?: unknown } };
    const code =
        typeof e.errcode === "string"
            ? e.errcode
            : typeof e.data?.errcode === "string"
              ? e.data.errcode
              : undefined;
    return code !== undefined && INVITE_BLOCKED_ERRCODES.has(code);
}

/** Push rule id that silences invites while invites are blocked. */
export const INVITE_BLOCK_PUSH_RULE_ID = "im.zam.block_invites";

/**
 * An override rule with no actions for invites to `userId`. User override
 * rules outrank the server-default `.m.rule.invite_for_me`, so pushes for
 * invites stop on every device (web push, FCM, UnifiedPush) even on a
 * server that doesn't enforce MSC4380 itself.
 */
export function buildInviteBlockPushRule(userId: string) {
    return {
        ruleId: INVITE_BLOCK_PUSH_RULE_ID,
        kind: "override" as const,
        body: {
            conditions: [
                { kind: "event_match", key: "type", pattern: "m.room.member" },
                {
                    kind: "event_property_is",
                    key: "content.membership",
                    value: "invite",
                },
                { kind: "event_property_is", key: "state_key", value: userId },
            ],
            actions: [],
        },
    };
}
