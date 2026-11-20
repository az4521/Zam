/**
 * Mentions in encrypted "mentions only" rooms.
 *
 * Why this exists: push rules run on the homeserver, and the homeserver only
 * sees an encrypted message's ciphertext. "Mentions only" is a room-kind rule
 * with no actions; the mention rules (`.m.rule.is_user_mention`,
 * `.m.rule.contains_display_name`, ...) are server-default OVERRIDE rules that
 * run before it, but they read `content.m.mentions` / `content.body`, which an
 * `m.room.encrypted` event does not have. So the room rule matched every
 * encrypted message, mentions included, and the server never pushed any of
 * them: a closed or backgrounded app never pinged, and a sliding-sync gap never
 * looked like it hid a notifying message (the server's count did not move), so
 * the in-app gap recovery skipped it too.
 *
 * The fix is MSC4028's idea scoped to those rooms: a user override rule that
 * makes the server push (and count) the room's encrypted events, and a check on
 * the device, after decryption, that only lets real mentions through. The rule
 * matches on the WIRE type, so once the device has the cleartext (where the
 * type is m.room.message) it no longer matches and the normal rules decide.
 *
 * `isMentionOfUser` is hand-mirrored in `static/sw.js` (region
 * `mirrored:mentions`, tested against the same table) and in
 * `MatrixMessagingService.java`; keep the three in step.
 */

/** Prefix of the per-room override rule ids. Never starts with "." (reserved
 *  for server-default rules). */
export const ENCRYPTED_MENTIONS_RULE_PREFIX =
    "moe.crafty.matrix.e2ee_mentions.";

export function encryptedMentionsRuleId(roomId: string): string {
    return ENCRYPTED_MENTIONS_RULE_PREFIX + roomId;
}

/** The room a rule id belongs to, or null when it is not one of ours. */
export function roomIdOfEncryptedMentionsRule(ruleId: unknown): string | null {
    if (typeof ruleId !== "string") return null;
    if (!ruleId.startsWith(ENCRYPTED_MENTIONS_RULE_PREFIX)) return null;
    const roomId = ruleId.slice(ENCRYPTED_MENTIONS_RULE_PREFIX.length);
    return roomId.length > 0 ? roomId : null;
}

/** Body for `addPushRule("global", "override", id, body)`. Plain notify: no
 *  sound and no highlight, since the server cannot know yet whether it is a
 *  mention. The device decides after decrypting. */
export function encryptedMentionsRuleBody(roomId: string) {
    return {
        conditions: [
            { kind: "event_match", key: "room_id", pattern: roomId },
            { kind: "event_match", key: "type", pattern: "m.room.encrypted" },
        ],
        actions: ["notify"],
    };
}

interface RuleLike {
    rule_id?: unknown;
    actions?: unknown;
    enabled?: unknown;
}

/** An enabled rule that does not notify: "mentions only" as a room rule, a
 *  mute as an override keyed by the room id. */
function isSilentRule(r: RuleLike): boolean {
    return (
        typeof r.rule_id === "string" &&
        r.enabled !== false &&
        isSilentActions(r.actions)
    );
}

function isSilentActions(actions: unknown): boolean {
    if (!Array.isArray(actions)) return false;
    return actions.length === 0 || actions[0] === "dont_notify";
}

/**
 * Which per-room rules to add and remove so that exactly the rooms set to
 * "mentions only" have one. A muted room (an override with the room's id and
 * no notify) needs none: muting drops mentions as well. A rule the user turned
 * off is left alone rather than re-added.
 */
export function planEncryptedMentionRules(
    global:
        | { room?: RuleLike[] | null; override?: RuleLike[] | null }
        | null
        | undefined,
): { add: string[]; remove: string[] } {
    const room = global?.room ?? [];
    const override = global?.override ?? [];
    const muted = new Set(
        override.filter(isSilentRule).map((r) => r.rule_id as string),
    );
    const mentionsOnly = new Set(
        room
            .filter(isSilentRule)
            .map((r) => r.rule_id as string)
            .filter((roomId) => !muted.has(roomId)),
    );
    const existing = new Map<string, string>();
    for (const r of override) {
        const roomId = roomIdOfEncryptedMentionsRule(r.rule_id);
        if (roomId) existing.set(roomId, r.rule_id as string);
    }
    const add = [...mentionsOnly].filter((roomId) => !existing.has(roomId));
    const remove = [...existing]
        .filter(([roomId]) => !mentionsOnly.has(roomId))
        .map(([, ruleId]) => ruleId);
    return { add, remove };
}

function escapeRegExp(text: string): string {
    return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

/** Whole-word, case-insensitive containment, the way matrix-js-sdk's push
 *  processor matches `content.body` (`(^|\W)x(\W|$)`). */
function containsWord(body: string, word: string): boolean {
    if (!word) return false;
    return new RegExp("(^|\\W)" + escapeRegExp(word) + "(\\W|$)", "i").test(
        body,
    );
}

export interface MentionCheckInput {
    /** Decrypted event content. */
    content: unknown;
    /** The signed-in user, `@local:server`. */
    userId: string;
    /** The user's display name in this room, if known. */
    displayName?: string | null;
}

/**
 * Does this decrypted message mention the user, by the spec's mention rules?
 *
 * With `m.mentions` present (Matrix 1.7 intentional mentions) only it counts:
 * the user's id in `user_ids`, or `room: true`. Without it, the legacy body
 * rules apply: the display name, the localpart, or "@room" as a whole word.
 * Keywords and the @room power-level check are not evaluated here.
 */
export function isMentionOfUser({
    content,
    userId,
    displayName,
}: MentionCheckInput): boolean {
    if (!content || typeof content !== "object") return false;
    const c = content as Record<string, unknown>;
    const mentions = c["m.mentions"];
    if (mentions && typeof mentions === "object" && !Array.isArray(mentions)) {
        const m = mentions as Record<string, unknown>;
        if (Array.isArray(m.user_ids) && m.user_ids.includes(userId))
            return true;
        return m.room === true;
    }
    const body = c.body;
    if (typeof body !== "string" || !body) return false;
    const localpart = /^@([^:]+):/.exec(userId)?.[1] ?? "";
    return (
        containsWord(body, displayName ?? "") ||
        containsWord(body, localpart) ||
        containsWord(body, "@room")
    );
}
