// Pure audit-log model for the room/space settings "Audit log" tab.
//
// Turns raw state events (and redactions) from a backward /messages page into
// human-readable entries. `unsigned.prev_content` tells what changed, so a
// no-op (a state event repeating its previous value) produces no entry.
// No Svelte, no SDK imports: the client wrapper hands plain JSON in.

import { resolveDisplayName } from "./displayName";

export type AuditCategory = "moderation" | "members" | "settings";

export type AuditFilter = "all" | AuditCategory;

/** Order the filter chips are shown in. */
export const AUDIT_FILTERS: readonly AuditFilter[] = [
    "all",
    "moderation",
    "members",
    "settings",
];

/** Plain JSON for one event, as /messages returns it. */
export interface RawAuditEvent {
    type: string;
    state_key?: string;
    sender: string;
    origin_server_ts: number;
    event_id: string;
    content: Record<string, unknown>;
    unsigned?: { prev_content?: Record<string, unknown> };
    redacts?: string;
}

export interface AuditEntry {
    /** Source event id. One event can yield several entries (power levels). */
    id: string;
    ts: number;
    category: AuditCategory;
    actorId: string;
    /** Suffix of the `auditLog.<key>` i18n string. */
    key: string;
    /** User or room the change is about, when there is one. */
    targetId?: string;
    /** New value shown in the sentence (name, rule, level, ...). Plain text. */
    value?: string;
    /** Moderator's reason, when the event carried a non-empty one. */
    reason?: string;
    /** Extra data that is not shown in the sentence (old level, redacted id). */
    detail?: string;
    /**
     * Display name the target carried in the event itself (member content or
     * prev_content). Used only when the room does not know the user any more.
     */
    targetName?: string;
    /** True when `targetId` is a room id (space child / parent), not a user. */
    targetIsRoom?: boolean;
}

/**
 * First usable name from `candidates`, in the order given. A candidate counts
 * only if it is non-empty after the same cleanup as room member names, and is
 * not just the mxid. Falls back to the mxid.
 */
export function pickAuditName(
    userId: string,
    candidates: readonly (string | null | undefined)[],
): string {
    for (const displayName of candidates) {
        const name = resolveDisplayName({ userId, displayName });
        if (name !== userId) return name;
    }
    return userId;
}

/** State event types the audit log reads. */
export const AUDIT_STATE_TYPES: readonly string[] = [
    "m.room.member",
    "m.room.power_levels",
    "m.room.name",
    "m.room.topic",
    "m.room.avatar",
    "m.room.join_rules",
    "m.room.history_visibility",
    "m.room.guest_access",
    "m.room.encryption",
    "m.room.server_acl",
    "m.room.pinned_events",
    "m.room.canonical_alias",
    "m.room.tombstone",
    "m.space.child",
    "m.space.parent",
];

/** Types sent as the /messages `types` filter: state plus redactions. */
export const AUDIT_EVENT_TYPES: readonly string[] = [
    ...AUDIT_STATE_TYPES,
    "m.room.redaction",
];

type Obj = Record<string, unknown>;

function asObj(v: unknown): Obj {
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {};
}

function str(v: unknown): string | undefined {
    return typeof v === "string" ? v : undefined;
}

function num(v: unknown, fallback: number): number {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** Key-sorted JSON so two equal values always compare equal. */
function stableJson(v: unknown): string {
    if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
    if (v && typeof v === "object") {
        const o = v as Obj;
        return `{${Object.keys(o)
            .sort()
            .filter((k) => o[k] !== undefined)
            .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
            .join(",")}}`;
    }
    return JSON.stringify(v ?? null);
}

function reasonOf(content: Obj): string | undefined {
    const r = str(content.reason)?.trim();
    return r ? r : undefined;
}

/** Spec defaults for the power-level scalars, used when a field is absent. */
const PL_SCALAR_DEFAULTS: Record<string, number> = {
    users_default: 0,
    events_default: 0,
    state_default: 50,
    ban: 50,
    kick: 50,
    redact: 50,
    invite: 0,
};

function powerLevelEntries(
    base: Omit<AuditEntry, "category" | "key">,
    content: Obj,
    prev: Obj,
): AuditEntry[] {
    const out: AuditEntry[] = [];
    const prevUsers = asObj(prev.users);
    const curUsers = asObj(content.users);
    const oldUsersDefault = num(prev.users_default, 0);
    const newUsersDefault = num(content.users_default, 0);
    const userIds = [
        ...new Set([...Object.keys(prevUsers), ...Object.keys(curUsers)]),
    ].sort();
    for (const userId of userIds) {
        const oldLevel = num(prevUsers[userId], oldUsersDefault);
        const newLevel = num(curUsers[userId], newUsersDefault);
        if (oldLevel === newLevel) continue;
        out.push({
            ...base,
            category: "moderation",
            key: "power.user",
            targetId: userId,
            value: String(newLevel),
            detail: String(oldLevel),
        });
    }

    let defaultsChanged = false;
    for (const field of Object.keys(PL_SCALAR_DEFAULTS)) {
        // users_default is compared above as the fallback for each user, but
        // a change to it is still a change to the defaults.
        const fallback = PL_SCALAR_DEFAULTS[field];
        if (num(prev[field], fallback) !== num(content[field], fallback)) {
            defaultsChanged = true;
        }
    }
    if (
        stableJson(asObj(prev.events)) !== stableJson(asObj(content.events)) ||
        stableJson(asObj(prev.notifications)) !==
            stableJson(asObj(content.notifications))
    ) {
        defaultsChanged = true;
    }
    if (defaultsChanged) {
        out.push({ ...base, category: "moderation", key: "power.defaults" });
    }
    return out;
}

function memberEntries(
    base: Omit<AuditEntry, "category" | "key">,
    ev: RawAuditEvent,
    content: Obj,
    prev: Obj,
): AuditEntry[] {
    const target = ev.state_key ?? "";
    const curM = str(content.membership);
    if (!curM) return [];
    const prevM = str(prev.membership);
    const self = ev.sender === target;
    // The name the target had in this event, before the room's own state.
    const targetName =
        str(content.displayname)?.trim() || str(prev.displayname)?.trim();
    const mod = (key: string): AuditEntry => ({
        ...base,
        category: "moderation",
        key,
        targetId: target,
        targetName,
        reason: reasonOf(content),
    });
    const mem = (key: string): AuditEntry => ({
        ...base,
        category: "members",
        key,
        targetId: target,
        targetName,
    });

    if (curM === "join" && prevM === "join") {
        // Already joined: only a display name or avatar change is news.
        const out: AuditEntry[] = [];
        const oldName = str(prev.displayname) ?? "";
        const newName = str(content.displayname) ?? "";
        if (oldName !== newName) {
            out.push(
                newName
                    ? {
                          ...mem(
                              oldName
                                  ? "member.displaynameChanged"
                                  : "member.displayname",
                          ),
                          value: newName,
                          detail: oldName || undefined,
                      }
                    : mem("member.displaynameRemoved"),
            );
        }
        if ((str(prev.avatar_url) ?? "") !== (str(content.avatar_url) ?? "")) {
            out.push(mem("member.avatar"));
        }
        return out;
    }
    if (curM === "join") return [mem("member.join")];
    if (curM === "invite") {
        return prevM === "invite" ? [] : [mem("member.invite")];
    }
    if (curM === "ban") return prevM === "ban" ? [] : [mod("member.ban")];
    if (curM === "knock") {
        return prevM === "knock" ? [] : [mem("member.knock")];
    }
    if (curM === "leave") {
        if (prevM === "leave") return [];
        if (prevM === "ban") return self ? [] : [mod("member.unban")];
        if (prevM === "invite") {
            return self
                ? [mem("member.inviteRejected")]
                : [mem("member.inviteRetracted")];
        }
        // Left a room they were in, or were removed from it.
        return self ? [mem("member.leave")] : [mod("member.kick")];
    }
    return [];
}

/** A setting whose value changed: one entry with `key` (or its cleared form). */
function changedSetting(
    base: Omit<AuditEntry, "category" | "key">,
    category: AuditCategory,
    key: string,
    oldValue: string,
    newValue: string,
    clearedKey?: string,
): AuditEntry[] {
    if (oldValue === newValue) return [];
    if (newValue === "" && clearedKey) {
        return [{ ...base, category, key: clearedKey }];
    }
    return [
        {
            ...base,
            category,
            key,
            value: newValue || undefined,
            detail: oldValue || undefined,
        },
    ];
}

function settingEntries(
    base: Omit<AuditEntry, "category" | "key">,
    ev: RawAuditEvent,
    content: Obj,
    prev: Obj,
): AuditEntry[] {
    switch (ev.type) {
        case "m.room.name": {
            const oldName = str(prev.name) ?? "";
            const newName = str(content.name) ?? "";
            return changedSetting(
                base,
                "settings",
                oldName && newName ? "settings.nameChanged" : "settings.name",
                oldName,
                newName,
                "settings.nameRemoved",
            );
        }
        case "m.room.topic":
            return changedSetting(
                base,
                "settings",
                "settings.topic",
                str(prev.topic) ?? "",
                str(content.topic) ?? "",
            );
        case "m.room.avatar":
            return changedSetting(
                base,
                "settings",
                "settings.avatar",
                str(prev.url) ?? "",
                str(content.url) ?? "",
                "settings.avatarRemoved",
            );
        case "m.room.join_rules": {
            const rule = str(content.join_rule);
            if (!rule) return [];
            return changedSetting(
                base,
                "settings",
                "settings.joinRules",
                str(prev.join_rule) ?? "",
                rule,
            );
        }
        case "m.room.history_visibility": {
            const value = str(content.history_visibility);
            if (!value) return [];
            return changedSetting(
                base,
                "settings",
                "settings.historyVisibility",
                str(prev.history_visibility) ?? "",
                value,
            );
        }
        case "m.room.guest_access": {
            const value = str(content.guest_access);
            if (!value) return [];
            return changedSetting(
                base,
                "settings",
                "settings.guestAccess",
                str(prev.guest_access) ?? "",
                value,
            );
        }
        case "m.room.encryption": {
            // Encryption can be turned on but never off; a repeat is a no-op.
            const algorithm = str(content.algorithm);
            if (!algorithm || str(prev.algorithm) === algorithm) return [];
            return [
                { ...base, category: "settings", key: "settings.encryption" },
            ];
        }
        case "m.room.server_acl":
            if (stableJson(content) === stableJson(prev)) return [];
            return [{ ...base, category: "moderation", key: "acl" }];
        case "m.room.pinned_events":
            if (
                stableJson(content.pinned ?? []) ===
                stableJson(prev.pinned ?? [])
            ) {
                return [];
            }
            return [{ ...base, category: "settings", key: "settings.pinned" }];
        case "m.room.canonical_alias":
            return changedSetting(
                base,
                "settings",
                "settings.canonicalAlias",
                str(prev.alias) ?? "",
                str(content.alias) ?? "",
                "settings.canonicalAliasRemoved",
            );
        case "m.room.tombstone": {
            const replacement = str(content.replacement_room);
            if (!replacement) return [];
            return changedSetting(
                base,
                "settings",
                "settings.tombstone",
                str(prev.replacement_room) ?? "",
                replacement,
            );
        }
        case "m.space.child":
        case "m.space.parent": {
            // Linked while `via` is set, unlinked when the content is emptied.
            const linked = Array.isArray(content.via);
            if (linked === Array.isArray(prev.via)) return [];
            const isChild = ev.type === "m.space.child";
            const key = isChild
                ? linked
                    ? "settings.spaceChildAdded"
                    : "settings.spaceChildRemoved"
                : linked
                  ? "settings.spaceParentAdded"
                  : "settings.spaceParentRemoved";
            return [
                {
                    ...base,
                    category: "settings",
                    key,
                    targetId: ev.state_key,
                    targetIsRoom: true,
                },
            ];
        }
        default:
            return [];
    }
}

function redactionEntries(
    base: Omit<AuditEntry, "category" | "key">,
    ev: RawAuditEvent,
): AuditEntry[] {
    const redacted = ev.redacts ?? str(ev.content.redacts);
    return [
        {
            ...base,
            category: "moderation",
            key: "redaction",
            detail: redacted,
            reason: reasonOf(ev.content),
        },
    ];
}

/**
 * The audit entries one raw event produces, in display order. Empty for a
 * non-state event, an unsupported type, or a state event that did not change
 * anything. `prev_content` missing or empty is read as "no earlier state", so
 * a first-ever value (room name set, first power levels) still produces an
 * entry.
 */
export function toAuditEntries(ev: RawAuditEvent): AuditEntry[] {
    const base = {
        id: ev.event_id,
        ts: ev.origin_server_ts,
        actorId: ev.sender,
    };
    if (ev.type === "m.room.redaction") return redactionEntries(base, ev);
    if (ev.state_key === undefined) return [];
    const content = asObj(ev.content);
    const prev = asObj(ev.unsigned?.prev_content);
    if (ev.type === "m.room.member") {
        return memberEntries(base, ev, content, prev);
    }
    if (ev.type === "m.room.power_levels") {
        return powerLevelEntries(base, content, prev);
    }
    return settingEntries(base, ev, content, prev);
}

/** Keep the entries in one category, or all of them. */
export function filterEntries(
    entries: readonly AuditEntry[],
    filter: AuditFilter,
): AuditEntry[] {
    if (filter === "all") return [...entries];
    return entries.filter((e) => e.category === filter);
}
