/**
 * Catalog of room permissions shown in room settings, mapped onto the
 * power-levels `events` map.
 *
 * Per-event-type levels live in the power-levels `events` map. Any event type
 * that is absent from that map falls back to the catch-all: `events_default`
 * for message events and `state_default` for state events. So a row whose
 * types are all absent is "inherited" and displays the catch-all level.
 *
 * In encrypted rooms the server only sees `m.room.encrypted` for the
 * encryptable types, so their own levels have no effect there. Those rows are
 * locked to the `m.room.message` level by `isLockedByEncryption`.
 *
 * This module is SDK-free and pure so it can be unit-tested.
 */
import type { MessageKey } from "$lib/i18n/en";
import { CALL_MEMBER_EVENT_TYPES } from "$lib/utils/powerLevels";

export type PermKind = "message" | "state";
export type PermGroup = "messages" | "calls" | "room";

export interface PermEntry {
    id: string;
    group: PermGroup;
    /** i18n key for the row label. */
    labelKey: MessageKey;
    types: readonly (readonly [type: string, kind: PermKind])[];
    /** Every type is a message event the SDK encrypts in E2EE rooms. */
    encryptable?: boolean;
    /** How differing per-type levels combine for display. Default "max". */
    combine?: "min" | "max";
    /** undefined = shown for both rooms and spaces. */
    scope?: "room" | "space";
}

export const PERMISSION_CATALOG: readonly PermEntry[] = [
    // messages
    {
        id: "sendMessages",
        group: "messages",
        labelKey: "roomSettings.perm.sendMessages",
        types: [
            ["m.room.message", "message"],
            ["m.room.encrypted", "message"],
        ],
        scope: "room",
    },
    {
        id: "sendStickers",
        group: "messages",
        labelKey: "roomSettings.perm.sendStickers",
        types: [["m.sticker", "message"]],
        encryptable: true,
        scope: "room",
    },
    {
        id: "react",
        group: "messages",
        labelKey: "roomSettings.perm.react",
        types: [["m.reaction", "message"]],
        scope: "room",
    },
    {
        id: "redactOwn",
        group: "messages",
        labelKey: "roomSettings.perm.redactOwn",
        types: [["m.room.redaction", "message"]],
        scope: "room",
    },
    {
        id: "createPolls",
        group: "messages",
        labelKey: "roomSettings.perm.createPolls",
        types: [
            ["org.matrix.msc3381.poll.start", "message"],
            ["m.poll.start", "message"],
        ],
        encryptable: true,
        scope: "room",
    },
    {
        id: "votePolls",
        group: "messages",
        labelKey: "roomSettings.perm.votePolls",
        types: [
            ["org.matrix.msc3381.poll.response", "message"],
            ["m.poll.response", "message"],
        ],
        encryptable: true,
        scope: "room",
    },
    {
        id: "endPolls",
        group: "messages",
        labelKey: "roomSettings.perm.endPolls",
        types: [
            ["org.matrix.msc3381.poll.end", "message"],
            ["m.poll.end", "message"],
        ],
        encryptable: true,
        scope: "room",
    },
    {
        id: "nameThreads",
        group: "messages",
        labelKey: "roomSettings.perm.nameThreads",
        types: [["moe.crafty.matrix.thread_name", "message"]],
        encryptable: true,
        scope: "room",
    },
    {
        id: "offerFiles",
        group: "messages",
        labelKey: "roomSettings.perm.offerFiles",
        types: [["moe.crafty.matrix.file_offer", "message"]],
        encryptable: true,
        scope: "room",
    },

    // calls
    {
        id: "joinCalls",
        group: "calls",
        labelKey: "roomSettings.joinCallsVoiceVideo",
        types: [
            ...CALL_MEMBER_EVENT_TYPES.map((t) => [t, "state"] as const),
            ["org.matrix.msc4143.rtc.member", "message"] as const,
        ],
        combine: "min",
        scope: "room",
    },
    {
        id: "ringCalls",
        group: "calls",
        labelKey: "roomSettings.perm.ringCalls",
        types: [
            ["org.matrix.msc4075.rtc.notification", "message"],
            ["m.rtc.notification", "message"],
        ],
        encryptable: true,
        scope: "room",
    },
    {
        id: "disconnectFromCall",
        group: "calls",
        labelKey: "roomSettings.perm.disconnectFromCall",
        types: [["com.zam.call.kick", "message"]],
        scope: "room",
    },
    {
        id: "liveLocation",
        group: "calls",
        labelKey: "roomSettings.perm.liveLocation",
        types: [
            ["org.matrix.msc3672.beacon_info", "state"],
            ["m.beacon_info", "state"],
            ["org.matrix.msc3672.beacon", "message"],
            ["m.beacon", "message"],
        ],
        scope: "room",
    },

    // room (state)
    {
        id: "roomName",
        group: "room",
        labelKey: "roomSettings.perm.roomName",
        types: [["m.room.name", "state"]],
    },
    {
        id: "roomTopic",
        group: "room",
        labelKey: "roomSettings.perm.roomTopic",
        types: [["m.room.topic", "state"]],
    },
    {
        id: "roomAvatar",
        group: "room",
        labelKey: "roomSettings.perm.roomAvatar",
        types: [["m.room.avatar", "state"]],
    },
    {
        id: "roomAddresses",
        group: "room",
        labelKey: "roomSettings.perm.roomAddresses",
        types: [["m.room.canonical_alias", "state"]],
    },
    {
        id: "joinRules",
        group: "room",
        labelKey: "roomSettings.perm.joinRules",
        types: [["m.room.join_rules", "state"]],
    },
    {
        id: "historyVisibility",
        group: "room",
        labelKey: "roomSettings.perm.historyVisibility",
        types: [["m.room.history_visibility", "state"]],
    },
    {
        id: "guestAccess",
        group: "room",
        labelKey: "roomSettings.perm.guestAccess",
        types: [["m.room.guest_access", "state"]],
    },
    {
        id: "encryption",
        group: "room",
        labelKey: "roomSettings.perm.encryption",
        types: [["m.room.encryption", "state"]],
    },
    {
        id: "powerLevels",
        group: "room",
        labelKey: "roomSettings.perm.powerLevels",
        types: [["m.room.power_levels", "state"]],
    },
    {
        id: "serverAcl",
        group: "room",
        labelKey: "roomSettings.perm.serverAcl",
        types: [["m.room.server_acl", "state"]],
    },
    {
        id: "pins",
        group: "room",
        labelKey: "roomSettings.perm.pins",
        types: [["m.room.pinned_events", "state"]],
        scope: "room",
    },
    {
        id: "spaceChildren",
        group: "room",
        labelKey: "roomSettings.perm.spaceChildren",
        types: [["m.space.child", "state"]],
        scope: "space",
    },
    {
        id: "roleTags",
        group: "room",
        labelKey: "roomSettings.perm.roleTags",
        types: [
            ["in.cinny.room.power_level_tags", "state"],
            ["m.room.power_level_tags", "state"],
        ],
    },
    {
        id: "widgets",
        group: "room",
        labelKey: "roomSettings.perm.widgets",
        types: [
            ["im.vector.modular.widgets", "state"],
            ["m.widget", "state"],
        ],
        scope: "room",
    },
    {
        id: "emotes",
        group: "room",
        labelKey: "roomSettings.perm.emotes",
        types: [
            ["m.room.image_pack", "state"],
            ["im.ponies.room_emotes", "state"],
        ],
    },
    {
        id: "soundboard",
        group: "room",
        labelKey: "roomSettings.perm.soundboard",
        types: [["moe.crafty.room_soundboard", "state"]],
    },
    {
        id: "upgrade",
        group: "room",
        labelKey: "roomSettings.perm.upgrade",
        types: [["m.room.tombstone", "state"]],
    },
];

export interface PlDefaults {
    events_default: number;
    state_default: number;
}

export interface RowState {
    /** Combined level for display (per entry.combine). */
    level: number;
    /** True when no type of the entry has its own key in `events`. */
    inherited: boolean;
    /** True when the per-type levels are not all equal. */
    mixed: boolean;
}

const hasOwn = (o: object, k: string): boolean =>
    Object.prototype.hasOwnProperty.call(o, k);

/** Visible catalog entries for a room or a space. */
export function visibleEntries(isSpace: boolean): PermEntry[] {
    return PERMISSION_CATALOG.filter((e) => {
        if (e.scope === "room" && isSpace) return false;
        if (e.scope === "space" && !isSpace) return false;
        return true;
    });
}

/** Whether a row is forced by E2EE (its own levels have no effect there). */
export function isLockedByEncryption(
    entry: PermEntry,
    encrypted: boolean,
): boolean {
    return encrypted && !!entry.encryptable;
}

/** Effective display state of one catalog row from a power-levels `events` map. */
export function rowState(
    events: Record<string, number>,
    entry: PermEntry,
    defaults: PlDefaults,
): RowState {
    const levels: number[] = [];
    let inherited = true;
    for (const [type, kind] of entry.types) {
        if (hasOwn(events, type) && typeof events[type] === "number") {
            levels.push(events[type]);
            inherited = false;
        } else {
            levels.push(
                kind === "message"
                    ? defaults.events_default
                    : defaults.state_default,
            );
        }
    }
    const combine = entry.combine ?? "max";
    const level =
        levels.length === 0
            ? defaults.events_default
            : combine === "min"
              ? Math.min(...levels)
              : Math.max(...levels);
    const mixed = levels.some((l) => l !== levels[0]);
    return { level, inherited, mixed };
}

/**
 * Returns a new events map with every type of `entry` set to `level`, or
 * removed when `level` is null. The input is never mutated.
 */
export function withRowLevel(
    events: Record<string, number>,
    entry: PermEntry,
    level: number | null,
): Record<string, number> {
    const next: Record<string, number> = { ...events };
    for (const [type] of entry.types) {
        if (level === null) delete next[type];
        else next[type] = level;
    }
    return next;
}

/** Every event type string that appears in the catalog. */
export function catalogTypeSet(): Set<string> {
    const set = new Set<string>();
    for (const entry of PERMISSION_CATALOG) {
        for (const [type] of entry.types) set.add(type);
    }
    return set;
}

/** Own keys of `events` that the catalog does not cover, sorted. */
export function customEventTypes(events: Record<string, number>): string[] {
    const known = catalogTypeSet();
    return Object.keys(events)
        .filter((k) => !known.has(k))
        .sort();
}

export type CustomTypeError = "empty" | "invalid" | "tooLong" | "exists";

/** UTF-8 byte length of a string, without TextEncoder. */
function utf8ByteLength(s: string): number {
    let n = 0;
    for (const ch of s) {
        const c = ch.codePointAt(0)!;
        n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    return n;
}

/** Whether a character is whitespace or a control character. */
function isBadChar(ch: string): boolean {
    const c = ch.charCodeAt(0);
    return /\s/.test(ch) || c <= 0x1f || (c >= 0x7f && c <= 0x9f);
}

/** Validates a user-typed custom event type against the current map. */
export function validateCustomType(
    raw: string,
    events: Record<string, number>,
): CustomTypeError | null {
    const type = raw.trim();
    if (type === "") return "empty";
    for (const ch of type) {
        if (isBadChar(ch)) return "invalid";
    }
    if (utf8ByteLength(type) > 255) return "tooLong";
    if (hasOwn(events, type) || catalogTypeSet().has(type)) return "exists";
    return null;
}

/** True when both maps have the same own keys with equal values. */
export function eventsMapEqual(
    a: Record<string, number>,
    b: Record<string, number>,
): boolean {
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) return false;
    return keysA.every((k) => hasOwn(b, k) && a[k] === b[k]);
}

/**
 * Rebases the user's edits (initial to draft) onto the live map. Only keys
 * whose value differs between initial and draft are written, so concurrent
 * changes to untouched keys in `live` survive.
 */
export function applyEventsDiff(
    initial: Record<string, number>,
    draft: Record<string, number>,
    live: Record<string, number>,
): Record<string, number> {
    const out: Record<string, number> = { ...live };
    const keys = new Set<string>([
        ...Object.keys(initial),
        ...Object.keys(draft),
    ]);
    for (const k of keys) {
        const inInitial = hasOwn(initial, k);
        const inDraft = hasOwn(draft, k);
        if (inInitial === inDraft && initial[k] === draft[k]) continue;
        if (inDraft) out[k] = draft[k];
        else delete out[k];
    }
    return out;
}
