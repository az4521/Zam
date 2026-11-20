import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    ENCRYPTED_MENTIONS_RULE_PREFIX,
    encryptedMentionsRuleBody,
    encryptedMentionsRuleId,
    isMentionOfUser,
    planEncryptedMentionRules,
    roomIdOfEncryptedMentionsRule,
} from "./encryptedMentions";

// static/sw.js is un-bundled: run its hand-mirrored copy against the same table.
const SW_SOURCE = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../static/sw.js"),
    "utf-8",
);
const start = SW_SOURCE.indexOf("// #region mirrored:mentions");
const end = SW_SOURCE.indexOf("// #endregion mirrored:mentions");
const sw = new Function(
    `${SW_SOURCE.slice(start, end)}
    return { isMentionOfUser, ENCRYPTED_MENTIONS_RULE_PREFIX };`,
)() as {
    isMentionOfUser: (
        content: unknown,
        userId: string,
        displayName: string,
    ) => boolean;
    ENCRYPTED_MENTIONS_RULE_PREFIX: string;
};

const ME = "@alice:example.org";

const CASES: [string, unknown, string, boolean][] = [
    [
        "m.mentions with my id",
        { body: "hi", "m.mentions": { user_ids: [ME] } },
        "Alice",
        true,
    ],
    [
        "m.mentions room",
        { body: "hi all", "m.mentions": { room: true } },
        "Alice",
        true,
    ],
    [
        "m.mentions of someone else",
        { body: "hi", "m.mentions": { user_ids: ["@bob:example.org"] } },
        "Alice",
        false,
    ],
    // Intentional mentions switch the legacy body rules off.
    [
        "empty m.mentions ignores the body",
        { body: "Alice look", "m.mentions": {} },
        "Alice",
        false,
    ],
    [
        'room: "true" (string) is not a room mention',
        { body: "x", "m.mentions": { room: "true" } },
        "Alice",
        false,
    ],
    ["legacy display name", { body: "hey Alice, look" }, "Alice", true],
    ["legacy display name, any case", { body: "hey ALICE" }, "Alice", true],
    [
        "legacy display name inside a word",
        { body: "Alicea is here" },
        "Alice",
        false,
    ],
    ["legacy localpart", { body: "ping alice" }, "", true],
    ["legacy @room", { body: "@room meeting now" }, "", true],
    ["legacy @room glued to a word", { body: "chat@room" }, "", false],
    [
        "display name with regex characters",
        { body: "hi A.l*ce!" },
        "A.l*ce",
        true,
    ],
    [
        "display name regex chars are literal",
        { body: "hi Axlyce" },
        "A.l*ce",
        false,
    ],
    ["no body, no m.mentions", { msgtype: "m.image" }, "Alice", false],
    ["not an object", "Alice", "Alice", false],
    ["null content", null, "Alice", false],
];

describe("isMentionOfUser", () => {
    it.each(CASES)("%s", (_name, content, displayName, expected) => {
        expect(isMentionOfUser({ content, userId: ME, displayName })).toBe(
            expected,
        );
    });
});

describe("sw.js mirror of isMentionOfUser", () => {
    it("finds the region", () => {
        expect(start).toBeGreaterThan(-1);
        expect(end).toBeGreaterThan(start);
    });

    it("uses the same rule prefix", () => {
        expect(sw.ENCRYPTED_MENTIONS_RULE_PREFIX).toBe(
            ENCRYPTED_MENTIONS_RULE_PREFIX,
        );
    });

    it.each(CASES)("%s", (_name, content, displayName, expected) => {
        expect(sw.isMentionOfUser(content, ME, displayName)).toBe(expected);
    });
});

describe("encrypted mentions rule", () => {
    it("round-trips the room id", () => {
        const id = encryptedMentionsRuleId("!r:example.org");
        expect(id.startsWith(".")).toBe(false);
        expect(roomIdOfEncryptedMentionsRule(id)).toBe("!r:example.org");
        expect(roomIdOfEncryptedMentionsRule("!r:example.org")).toBeNull();
        expect(
            roomIdOfEncryptedMentionsRule(ENCRYPTED_MENTIONS_RULE_PREFIX),
        ).toBeNull();
        expect(roomIdOfEncryptedMentionsRule(undefined)).toBeNull();
    });

    it("matches only the room's encrypted events and notifies quietly", () => {
        expect(encryptedMentionsRuleBody("!r:x")).toEqual({
            conditions: [
                { kind: "event_match", key: "room_id", pattern: "!r:x" },
                {
                    kind: "event_match",
                    key: "type",
                    pattern: "m.room.encrypted",
                },
            ],
            actions: ["notify"],
        });
    });
});

describe("planEncryptedMentionRules", () => {
    const ours = (roomId: string, extra: object = {}) => ({
        rule_id: encryptedMentionsRuleId(roomId),
        actions: ["notify"],
        ...extra,
    });

    it("adds a rule for each mentions-only room that lacks one", () => {
        expect(
            planEncryptedMentionRules({
                room: [
                    { rule_id: "!a", actions: [] },
                    { rule_id: "!b", actions: ["dont_notify"] },
                    { rule_id: "!all", actions: ["notify"] },
                ],
                override: [ours("!b")],
            }),
        ).toEqual({ add: ["!a"], remove: [] });
    });

    it("removes rules whose room is no longer mentions-only", () => {
        expect(
            planEncryptedMentionRules({
                room: [{ rule_id: "!all", actions: ["notify"] }],
                override: [ours("!all"), ours("!gone")],
            }),
        ).toEqual({
            add: [],
            remove: [
                encryptedMentionsRuleId("!all"),
                encryptedMentionsRuleId("!gone"),
            ],
        });
    });

    it("a muted room needs none, even with a mentions-only room rule", () => {
        expect(
            planEncryptedMentionRules({
                room: [{ rule_id: "!m", actions: [] }],
                override: [{ rule_id: "!m", actions: [] }, ours("!m")],
            }),
        ).toEqual({ add: [], remove: [encryptedMentionsRuleId("!m")] });
    });

    it("ignores disabled room rules and leaves a disabled rule of ours alone", () => {
        expect(
            planEncryptedMentionRules({
                room: [
                    { rule_id: "!off", actions: [], enabled: false },
                    { rule_id: "!kept", actions: [] },
                ],
                override: [ours("!kept", { enabled: false })],
            }),
        ).toEqual({ add: [], remove: [] });
    });

    it("tolerates missing rule sets", () => {
        expect(planEncryptedMentionRules(undefined)).toEqual({
            add: [],
            remove: [],
        });
        expect(planEncryptedMentionRules({ room: null })).toEqual({
            add: [],
            remove: [],
        });
    });
});
