import { describe, it, expect } from "vitest";
import {
    AUDIT_EVENT_TYPES,
    AUDIT_STATE_TYPES,
    filterEntries,
    pickAuditName,
    toAuditEntries,
    type AuditEntry,
    type RawAuditEvent,
} from "./auditLog";

const MOD = "@mod:example.org";
const USER = "@alice:example.org";

let seq = 0;
function ev(partial: Partial<RawAuditEvent> & Pick<RawAuditEvent, "type">) {
    seq += 1;
    return {
        sender: MOD,
        origin_server_ts: 1_700_000_000_000 + seq,
        event_id: `$ev${seq}`,
        content: {},
        ...partial,
    } as RawAuditEvent;
}

function member(
    content: Record<string, unknown>,
    prev: Record<string, unknown> | undefined,
    opts: { sender?: string; stateKey?: string } = {},
) {
    return ev({
        type: "m.room.member",
        state_key: opts.stateKey ?? USER,
        sender: opts.sender ?? MOD,
        content,
        unsigned: prev === undefined ? undefined : { prev_content: prev },
    });
}

function keysOf(entries: AuditEntry[]) {
    return entries.map((e) => e.key);
}

describe("AUDIT_EVENT_TYPES", () => {
    it("is every state type plus redactions", () => {
        expect(AUDIT_STATE_TYPES).toHaveLength(15);
        expect(AUDIT_EVENT_TYPES).toEqual([
            ...AUDIT_STATE_TYPES,
            "m.room.redaction",
        ]);
    });
});

describe("member events", () => {
    it("reports a join from nothing as a member entry", () => {
        const [e] = toAuditEntries(
            member({ membership: "join" }, undefined, { sender: USER }),
        );
        expect(e).toMatchObject({
            key: "member.join",
            category: "members",
            actorId: USER,
            targetId: USER,
        });
    });

    it("reports an invite accepted as a join (prev invite)", () => {
        const out = toAuditEntries(
            member(
                { membership: "join" },
                { membership: "invite" },
                { sender: USER },
            ),
        );
        expect(keysOf(out)).toEqual(["member.join"]);
    });

    it("reports a voluntary leave", () => {
        const out = toAuditEntries(
            member(
                { membership: "leave" },
                { membership: "join" },
                { sender: USER },
            ),
        );
        expect(out).toMatchObject([
            { key: "member.leave", category: "members", targetId: USER },
        ]);
    });

    it("reports a kick when sender differs from state_key, with reason", () => {
        const out = toAuditEntries(
            member(
                { membership: "leave", reason: "spam" },
                { membership: "join" },
            ),
        );
        expect(out).toMatchObject([
            {
                key: "member.kick",
                category: "moderation",
                actorId: MOD,
                targetId: USER,
                reason: "spam",
            },
        ]);
    });

    it("drops an empty or whitespace kick reason", () => {
        const [a] = toAuditEntries(
            member({ membership: "leave", reason: "" }, { membership: "join" }),
        );
        const [b] = toAuditEntries(
            member(
                { membership: "leave", reason: "   " },
                { membership: "join" },
            ),
        );
        expect(a.reason).toBeUndefined();
        expect(b.reason).toBeUndefined();
    });

    it("reports a ban as moderation with reason", () => {
        const out = toAuditEntries(
            member(
                { membership: "ban", reason: "raid" },
                { membership: "join" },
            ),
        );
        expect(out).toMatchObject([
            { key: "member.ban", category: "moderation", reason: "raid" },
        ]);
    });

    it("does not report a repeated ban", () => {
        expect(
            toAuditEntries(
                member({ membership: "ban" }, { membership: "ban" }),
            ),
        ).toEqual([]);
    });

    it("reports an unban (leave from ban by a moderator) as moderation", () => {
        const out = toAuditEntries(
            member({ membership: "leave" }, { membership: "ban" }),
        );
        expect(out).toMatchObject([
            { key: "member.unban", category: "moderation", targetId: USER },
        ]);
    });

    it("ignores a self-leave from ban (cannot happen, so no entry)", () => {
        expect(
            toAuditEntries(
                member(
                    { membership: "leave" },
                    { membership: "ban" },
                    { sender: USER },
                ),
            ),
        ).toEqual([]);
    });

    it("reports an invite as a member entry and skips a repeated invite", () => {
        expect(
            keysOf(toAuditEntries(member({ membership: "invite" }, undefined))),
        ).toEqual(["member.invite"]);
        expect(
            toAuditEntries(
                member({ membership: "invite" }, { membership: "invite" }),
            ),
        ).toEqual([]);
    });

    it("reports an invite declined by the invitee", () => {
        const out = toAuditEntries(
            member(
                { membership: "leave" },
                { membership: "invite" },
                { sender: USER },
            ),
        );
        expect(out).toMatchObject([
            { key: "member.inviteRejected", category: "members" },
        ]);
    });

    it("reports an invite retracted by someone else", () => {
        const out = toAuditEntries(
            member({ membership: "leave" }, { membership: "invite" }),
        );
        expect(out).toMatchObject([
            {
                key: "member.inviteRetracted",
                category: "members",
                targetId: USER,
            },
        ]);
    });

    it("reports a knock and skips a repeated knock", () => {
        expect(
            keysOf(
                toAuditEntries(
                    member({ membership: "knock" }, undefined, {
                        sender: USER,
                    }),
                ),
            ),
        ).toEqual(["member.knock"]);
        expect(
            toAuditEntries(
                member({ membership: "knock" }, { membership: "knock" }),
            ),
        ).toEqual([]);
    });

    it("reports a display name change with the new name as value", () => {
        const out = toAuditEntries(
            member(
                { membership: "join", displayname: "Alice B" },
                { membership: "join", displayname: "Alice" },
                { sender: USER },
            ),
        );
        expect(out).toMatchObject([
            {
                key: "member.displaynameChanged",
                category: "members",
                value: "Alice B",
                detail: "Alice",
            },
        ]);
    });

    it("reports a display name change with the old name as detail", () => {
        const out = toAuditEntries(
            member(
                { membership: "join", displayname: "Alice B" },
                { membership: "join", displayname: "Alice" },
                { sender: USER },
            ),
        );
        expect(out).toMatchObject([
            {
                key: "member.displaynameChanged",
                value: "Alice B",
                detail: "Alice",
            },
        ]);
    });

    it("keeps the plain display name key when there was no earlier name", () => {
        const [e] = toAuditEntries(
            member(
                { membership: "join", displayname: "Alice" },
                { membership: "join" },
                { sender: USER },
            ),
        );
        expect(e.key).toBe("member.displayname");
        expect(e.detail).toBeUndefined();
    });

    it("carries the target's displayname from the event content", () => {
        const [e] = toAuditEntries(
            member(
                { membership: "leave", reason: "spam", displayname: "Eve" },
                { membership: "join" },
            ),
        );
        expect(e).toMatchObject({ key: "member.kick", targetName: "Eve" });
    });

    it("falls back to prev_content displayname for the target name", () => {
        const [e] = toAuditEntries(
            member(
                { membership: "ban" },
                { membership: "join", displayname: "Eve" },
            ),
        );
        expect(e).toMatchObject({ key: "member.ban", targetName: "Eve" });
    });

    it("leaves targetName unset when the event has no displayname", () => {
        const [e] = toAuditEntries(
            member({ membership: "leave" }, { membership: "join" }),
        );
        expect(e.targetName).toBeUndefined();
    });

    it("reports a cleared display name", () => {
        const out = toAuditEntries(
            member(
                { membership: "join" },
                { membership: "join", displayname: "Alice" },
                { sender: USER },
            ),
        );
        expect(keysOf(out)).toEqual(["member.displaynameRemoved"]);
    });

    it("reports an avatar change", () => {
        const out = toAuditEntries(
            member(
                { membership: "join", avatar_url: "mxc://x/new" },
                { membership: "join", avatar_url: "mxc://x/old" },
                { sender: USER },
            ),
        );
        expect(keysOf(out)).toEqual(["member.avatar"]);
    });

    it("reports both a name and an avatar change in one event", () => {
        const out = toAuditEntries(
            member(
                {
                    membership: "join",
                    displayname: "B",
                    avatar_url: "mxc://x/n",
                },
                {
                    membership: "join",
                    displayname: "A",
                    avatar_url: "mxc://x/o",
                },
                { sender: USER },
            ),
        );
        expect(keysOf(out)).toEqual([
            "member.displaynameChanged",
            "member.avatar",
        ]);
    });

    it("reports nothing for a join that changes neither name nor avatar", () => {
        expect(
            toAuditEntries(
                member(
                    { membership: "join", displayname: "A" },
                    { membership: "join", displayname: "A" },
                    { sender: USER },
                ),
            ),
        ).toEqual([]);
    });

    it("treats a missing displayname and an empty one as the same", () => {
        expect(
            toAuditEntries(
                member(
                    { membership: "join", displayname: "" },
                    { membership: "join" },
                    { sender: USER },
                ),
            ),
        ).toEqual([]);
    });

    it("reports nothing for a leave that repeats a leave", () => {
        expect(
            toAuditEntries(
                member({ membership: "leave" }, { membership: "leave" }),
            ),
        ).toEqual([]);
    });

    it("reads an empty prev_content as no earlier state", () => {
        expect(
            keysOf(
                toAuditEntries(
                    member({ membership: "join" }, {}, { sender: USER }),
                ),
            ),
        ).toEqual(["member.join"]);
    });

    it("reports nothing when the content has no membership", () => {
        expect(toAuditEntries(member({}, { membership: "join" }))).toEqual([]);
    });

    it("keeps the event id, timestamp and actor on every entry", () => {
        const e = member({ membership: "join" }, undefined, { sender: USER });
        const [out] = toAuditEntries(e);
        expect(out).toMatchObject({
            id: e.event_id,
            ts: e.origin_server_ts,
            actorId: USER,
        });
    });
});

describe("power levels", () => {
    const base = {
        users: { [MOD]: 100, [USER]: 0 },
        users_default: 0,
        events: { "m.room.name": 50 },
        events_default: 0,
        state_default: 50,
        ban: 50,
        kick: 50,
        redact: 50,
        invite: 0,
    };

    function pl(
        content: Record<string, unknown>,
        prev?: Record<string, unknown>,
    ) {
        return ev({
            type: "m.room.power_levels",
            state_key: "",
            content,
            unsigned: prev === undefined ? undefined : { prev_content: prev },
        });
    }

    it("reports one moderation entry per user whose level changed", () => {
        const out = toAuditEntries(
            pl({ ...base, users: { [MOD]: 100, [USER]: 50 } }, base),
        );
        expect(out).toMatchObject([
            {
                key: "power.user",
                category: "moderation",
                targetId: USER,
                detail: "0",
                value: "50",
            },
        ]);
    });

    it("reports a user removed from the map as back to the default", () => {
        const out = toAuditEntries(
            pl(
                { ...base, users: { [MOD]: 100 } },
                { ...base, users: { [MOD]: 100, [USER]: 50 } },
            ),
        );
        expect(out).toMatchObject([
            { key: "power.user", targetId: USER, detail: "50", value: "0" },
        ]);
    });

    it("reports nothing when a user removed from the map was already at the default", () => {
        expect(
            toAuditEntries(pl({ ...base, users: { [MOD]: 100 } }, base)),
        ).toEqual([]);
    });

    it("reports several changed users, one entry each", () => {
        const out = toAuditEntries(
            pl(
                {
                    ...base,
                    users: { [MOD]: 100, [USER]: 25, "@bob:example.org": 50 },
                },
                base,
            ),
        );
        expect(
            out.filter((e) => e.key === "power.user").map((e) => e.targetId),
        ).toEqual(["@alice:example.org", "@bob:example.org"]);
    });

    it("reports a changed default or event level as one power.defaults entry", () => {
        const out = toAuditEntries(pl({ ...base, kick: 100, ban: 100 }, base));
        expect(keysOf(out)).toEqual(["power.defaults"]);
        expect(out[0].category).toBe("moderation");
    });

    it("reports a changed event level as power.defaults", () => {
        const out = toAuditEntries(
            pl({ ...base, events: { "m.room.name": 0 } }, base),
        );
        expect(keysOf(out)).toEqual(["power.defaults"]);
    });

    it("reports a changed notifications level as power.defaults", () => {
        const out = toAuditEntries(
            pl(
                { ...base, notifications: { room: 20 } },
                { ...base, notifications: { room: 50 } },
            ),
        );
        expect(keysOf(out)).toEqual(["power.defaults"]);
    });

    it("emits both per-user and defaults entries in one event", () => {
        const out = toAuditEntries(
            pl(
                {
                    ...base,
                    users: { [MOD]: 100, [USER]: 50 },
                    state_default: 0,
                },
                base,
            ),
        );
        expect(keysOf(out)).toEqual(["power.user", "power.defaults"]);
    });

    it("reports nothing for an identical repeat", () => {
        expect(toAuditEntries(pl({ ...base }, { ...base }))).toEqual([]);
    });

    it("reports nothing for a repeat that only reorders keys", () => {
        const reordered = {
            users: { [USER]: 0, [MOD]: 100 },
            events: { "m.room.name": 50 },
            kick: 50,
            ban: 50,
        };
        expect(
            toAuditEntries(
                pl(
                    {
                        ...reordered,
                        users_default: 0,
                        events_default: 0,
                        state_default: 50,
                        redact: 50,
                        invite: 0,
                    },
                    { ...base },
                ),
            ),
        ).toEqual([]);
    });

    it("treats an absent prev_content as the spec defaults", () => {
        // First power levels event: the creator goes from default 0 to 100.
        const out = toAuditEntries(pl({ users: { [MOD]: 100 } }));
        expect(out).toMatchObject([
            { key: "power.user", targetId: MOD, detail: "0", value: "100" },
        ]);
    });

    it("reports nothing for an empty first event with no users", () => {
        expect(toAuditEntries(pl({}))).toEqual([]);
    });
});

describe("server ACL", () => {
    it("reports a change as moderation", () => {
        const out = toAuditEntries(
            ev({
                type: "m.room.server_acl",
                state_key: "",
                content: { allow: ["*"], deny: ["bad.example"] },
                unsigned: { prev_content: { allow: ["*"] } },
            }),
        );
        expect(out).toMatchObject([{ key: "acl", category: "moderation" }]);
    });

    it("reports nothing for a repeat with the same lists", () => {
        expect(
            toAuditEntries(
                ev({
                    type: "m.room.server_acl",
                    state_key: "",
                    content: { allow: ["*"], deny: ["a", "b"] },
                    unsigned: {
                        prev_content: { deny: ["a", "b"], allow: ["*"] },
                    },
                }),
            ),
        ).toEqual([]);
    });

    it("reports a first ACL when prev_content is absent", () => {
        const out = toAuditEntries(
            ev({
                type: "m.room.server_acl",
                state_key: "",
                content: { allow: ["*"] },
            }),
        );
        expect(keysOf(out)).toEqual(["acl"]);
    });
});

describe("redactions", () => {
    it("reports the removed event id as detail and the reason", () => {
        const out = toAuditEntries(
            ev({
                type: "m.room.redaction",
                redacts: "$gone",
                content: { reason: "off topic" },
            }),
        );
        expect(out).toMatchObject([
            {
                key: "redaction",
                category: "moderation",
                detail: "$gone",
                reason: "off topic",
            },
        ]);
    });

    it("falls back to content.redacts for older room versions", () => {
        const [out] = toAuditEntries(
            ev({ type: "m.room.redaction", content: { redacts: "$old" } }),
        );
        expect(out.detail).toBe("$old");
        expect(out.reason).toBeUndefined();
    });

    it("keeps a redaction even though it has no state_key", () => {
        expect(
            toAuditEntries(ev({ type: "m.room.redaction", redacts: "$x" })),
        ).toHaveLength(1);
    });
});

describe("settings events", () => {
    function setting(
        type: string,
        content: Record<string, unknown>,
        prev?: Record<string, unknown>,
        sender = MOD,
    ) {
        return toAuditEntries(
            ev({
                type,
                state_key: "",
                sender,
                content,
                unsigned:
                    prev === undefined ? undefined : { prev_content: prev },
            }),
        );
    }

    it("reports a room name change with the old and new name", () => {
        expect(
            setting("m.room.name", { name: "Cats" }, { name: "Dogs" }),
        ).toMatchObject([
            {
                key: "settings.nameChanged",
                category: "settings",
                value: "Cats",
                detail: "Dogs",
            },
        ]);
    });

    it("reports a first room name when prev_content is absent", () => {
        const [e] = setting("m.room.name", { name: "Cats" });
        expect(e.key).toBe("settings.name");
        expect(e.detail).toBeUndefined();
    });

    it("reports a first room name when the previous name was empty", () => {
        expect(
            keysOf(setting("m.room.name", { name: "Cats" }, { name: "" })),
        ).toEqual(["settings.name"]);
    });

    it("reports a cleared room name", () => {
        expect(keysOf(setting("m.room.name", {}, { name: "Cats" }))).toEqual([
            "settings.nameRemoved",
        ]);
    });

    it("reports nothing for a repeated room name", () => {
        expect(setting("m.room.name", { name: "A" }, { name: "A" })).toEqual(
            [],
        );
    });

    it("reports a topic change without the topic text", () => {
        const [e] = setting("m.room.topic", { topic: "new" }, { topic: "old" });
        expect(e).toMatchObject({
            key: "settings.topic",
            category: "settings",
        });
        expect(e.value).toBe("new");
    });

    it("reports nothing for a repeated topic", () => {
        expect(
            setting("m.room.topic", { topic: "same" }, { topic: "same" }),
        ).toEqual([]);
    });

    it("reports a room avatar set and removed", () => {
        expect(
            keysOf(setting("m.room.avatar", { url: "mxc://a/b" }, {})),
        ).toEqual(["settings.avatar"]);
        expect(
            keysOf(setting("m.room.avatar", {}, { url: "mxc://a/b" })),
        ).toEqual(["settings.avatarRemoved"]);
    });

    it("reports a join rule change with its value", () => {
        expect(
            setting(
                "m.room.join_rules",
                { join_rule: "invite" },
                { join_rule: "public" },
            ),
        ).toMatchObject([{ key: "settings.joinRules", value: "invite" }]);
    });

    it("reports nothing for a join rule with no value", () => {
        expect(
            setting("m.room.join_rules", {}, { join_rule: "public" }),
        ).toEqual([]);
    });

    it("reports nothing for a repeated join rule", () => {
        expect(
            setting(
                "m.room.join_rules",
                { join_rule: "invite" },
                { join_rule: "invite" },
            ),
        ).toEqual([]);
    });

    it("reports history visibility and guest access changes", () => {
        expect(
            keysOf(
                setting(
                    "m.room.history_visibility",
                    { history_visibility: "shared" },
                    { history_visibility: "joined" },
                ),
            ),
        ).toEqual(["settings.historyVisibility"]);
        expect(
            keysOf(
                setting(
                    "m.room.guest_access",
                    { guest_access: "can_join" },
                    {},
                ),
            ),
        ).toEqual(["settings.guestAccess"]);
    });

    it("reports nothing for a repeated history visibility", () => {
        expect(
            setting(
                "m.room.history_visibility",
                { history_visibility: "shared" },
                { history_visibility: "shared" },
            ),
        ).toEqual([]);
    });

    it("reports turning encryption on, and skips a repeat", () => {
        expect(
            keysOf(
                setting("m.room.encryption", {
                    algorithm: "m.megolm.v1.aes-sha2",
                }),
            ),
        ).toEqual(["settings.encryption"]);
        expect(
            setting(
                "m.room.encryption",
                { algorithm: "m.megolm.v1.aes-sha2" },
                { algorithm: "m.megolm.v1.aes-sha2" },
            ),
        ).toEqual([]);
    });

    it("reports pinned messages only when the pinned list changes", () => {
        expect(
            keysOf(
                setting(
                    "m.room.pinned_events",
                    { pinned: ["$a"] },
                    { pinned: [] },
                ),
            ),
        ).toEqual(["settings.pinned"]);
        expect(
            setting(
                "m.room.pinned_events",
                { pinned: ["$a"] },
                { pinned: ["$a"] },
            ),
        ).toEqual([]);
        expect(setting("m.room.pinned_events", {}, {})).toEqual([]);
    });

    it("reports a canonical alias set and cleared", () => {
        expect(
            setting(
                "m.room.canonical_alias",
                { alias: "#cats:x" },
                { alias: "#dogs:x" },
            ),
        ).toMatchObject([{ key: "settings.canonicalAlias", value: "#cats:x" }]);
        expect(
            keysOf(setting("m.room.canonical_alias", {}, { alias: "#cats:x" })),
        ).toEqual(["settings.canonicalAliasRemoved"]);
    });

    it("reports nothing for a repeated canonical alias", () => {
        expect(
            setting(
                "m.room.canonical_alias",
                { alias: "#a:x" },
                { alias: "#a:x" },
            ),
        ).toEqual([]);
    });

    it("reports a tombstone with the replacement room", () => {
        expect(
            setting("m.room.tombstone", { replacement_room: "!new:x" }, {}),
        ).toMatchObject([{ key: "settings.tombstone", value: "!new:x" }]);
        expect(setting("m.room.tombstone", {}, {})).toEqual([]);
    });

    it("reports a space child added or removed by the presence of via", () => {
        const added = toAuditEntries(
            ev({
                type: "m.space.child",
                state_key: "!child:x",
                content: { via: ["x"] },
            }),
        );
        expect(added).toMatchObject([
            {
                key: "settings.spaceChildAdded",
                targetId: "!child:x",
                category: "settings",
            },
        ]);
        const removed = toAuditEntries(
            ev({
                type: "m.space.child",
                state_key: "!child:x",
                content: {},
                unsigned: { prev_content: { via: ["x"] } },
            }),
        );
        expect(keysOf(removed)).toEqual(["settings.spaceChildRemoved"]);
    });

    it("marks the space child target as a room, not a user", () => {
        const [e] = toAuditEntries(
            ev({
                type: "m.space.child",
                state_key: "!child:x",
                content: { via: ["x"] },
            }),
        );
        expect(e).toMatchObject({ targetId: "!child:x", targetIsRoom: true });
        const [user] = toAuditEntries(
            member({ membership: "invite" }, undefined),
        );
        expect(user.targetIsRoom).toBeUndefined();
    });

    it("reports a space child repeat as no entry", () => {
        expect(
            toAuditEntries(
                ev({
                    type: "m.space.child",
                    state_key: "!c:x",
                    content: { via: ["x"] },
                    unsigned: { prev_content: { via: ["y"] } },
                }),
            ),
        ).toEqual([]);
    });

    it("reports a space parent added or removed", () => {
        expect(
            keysOf(
                toAuditEntries(
                    ev({
                        type: "m.space.parent",
                        state_key: "!p:x",
                        content: { via: ["x"] },
                    }),
                ),
            ),
        ).toEqual(["settings.spaceParentAdded"]);
        expect(
            toAuditEntries(
                ev({
                    type: "m.space.parent",
                    state_key: "!p:x",
                    content: {},
                    unsigned: { prev_content: { via: ["x"] } },
                }),
            ).map((e) => e.key),
        ).toEqual(["settings.spaceParentRemoved"]);
    });
});

describe("toAuditEntries on non-audit events", () => {
    it("ignores a non-state event", () => {
        expect(
            toAuditEntries(
                ev({ type: "m.room.message", content: { body: "hi" } }),
            ),
        ).toEqual([]);
    });

    it("ignores an unknown state type", () => {
        expect(
            toAuditEntries(
                ev({ type: "org.example.thing", state_key: "", content: {} }),
            ),
        ).toEqual([]);
    });

    it("ignores a state event whose type is not handled, even if it has changes", () => {
        expect(
            toAuditEntries(
                ev({
                    type: "m.room.create",
                    state_key: "",
                    content: { creator: MOD },
                }),
            ),
        ).toEqual([]);
    });
});

describe("filterEntries", () => {
    const entries: AuditEntry[] = [
        {
            id: "1",
            ts: 1,
            category: "moderation",
            actorId: MOD,
            key: "member.kick",
        },
        {
            id: "2",
            ts: 2,
            category: "members",
            actorId: MOD,
            key: "member.join",
        },
        {
            id: "3",
            ts: 3,
            category: "settings",
            actorId: MOD,
            key: "settings.name",
        },
    ];

    it("returns every entry for all", () => {
        expect(filterEntries(entries, "all").map((e) => e.id)).toEqual([
            "1",
            "2",
            "3",
        ]);
    });

    it("keeps only the chosen category", () => {
        expect(filterEntries(entries, "moderation").map((e) => e.id)).toEqual([
            "1",
        ]);
        expect(filterEntries(entries, "members").map((e) => e.id)).toEqual([
            "2",
        ]);
        expect(filterEntries(entries, "settings").map((e) => e.id)).toEqual([
            "3",
        ]);
    });

    it("returns a copy, not the input array", () => {
        const out = filterEntries(entries, "all");
        expect(out).not.toBe(entries);
    });

    it("returns nothing for an empty input", () => {
        expect(filterEntries([], "moderation")).toEqual([]);
    });
});

describe("pickAuditName", () => {
    it("takes the first usable candidate in order", () => {
        expect(pickAuditName(USER, ["Room Name", "Event Name", "Known"])).toBe(
            "Room Name",
        );
        expect(pickAuditName(USER, [undefined, "Event Name", "Known"])).toBe(
            "Event Name",
        );
        expect(pickAuditName(USER, [null, "", "   ", "Known"])).toBe("Known");
    });

    it("falls back to the mxid when nothing is usable", () => {
        expect(pickAuditName(USER, [])).toBe(USER);
        expect(pickAuditName(USER, [undefined, null, "  "])).toBe(USER);
    });

    it("skips a candidate that is just the mxid", () => {
        expect(pickAuditName(USER, [USER, "Known"])).toBe("Known");
        expect(pickAuditName(USER, [USER])).toBe(USER);
    });

    it("strips the sdk disambiguation suffix", () => {
        expect(pickAuditName(USER, [`Alice (${USER})`])).toBe("Alice");
    });
});
