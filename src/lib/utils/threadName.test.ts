import { describe, it, expect } from "vitest";
import {
    MAX_THREAD_NAME_LENGTH,
    DEFAULT_THREAD_NAME_LEVEL,
    THREAD_NAME_POWER_LEVEL_KEY,
    THREAD_NAME_REL_TYPE,
    buildThreadNameContent,
    buildThreadNamePushRule,
    latestThreadNameEvent,
    mayNameThread,
    normalizeThreadName,
    parseThreadName,
    threadNameLevel,
    threadNameTarget,
} from "./threadName";

describe("normalizeThreadName", () => {
    it("trims the ends but keeps inner whitespace", () => {
        expect(normalizeThreadName("  release \n  plan\t")).toBe(
            "release \n  plan",
        );
    });

    it("trims whitespace the cap leaves at the end", () => {
        const name = "a".repeat(MAX_THREAD_NAME_LENGTH - 1) + "  b";
        expect(normalizeThreadName(name)).toBe(
            "a".repeat(MAX_THREAD_NAME_LENGTH - 1),
        );
    });

    it("caps the length", () => {
        const long = "a".repeat(MAX_THREAD_NAME_LENGTH + 20);
        expect(normalizeThreadName(long)).toHaveLength(MAX_THREAD_NAME_LENGTH);
    });
});

describe("parseThreadName", () => {
    it("reads a string name", () => {
        expect(parseThreadName({ name: "Release plan" })).toBe("Release plan");
    });

    it("treats empty, blank, missing and junk content as unnamed", () => {
        expect(parseThreadName({})).toBeNull();
        expect(parseThreadName({ name: "" })).toBeNull();
        expect(parseThreadName({ name: "   " })).toBeNull();
        expect(parseThreadName({ name: 42 })).toBeNull();
        expect(parseThreadName(null)).toBeNull();
        expect(parseThreadName("name")).toBeNull();
    });

    it("normalises what another client wrote", () => {
        expect(parseThreadName({ name: " a  b " })).toBe("a  b");
    });
});

describe("buildThreadNameContent / threadNameTarget", () => {
    it("relates the cleaned name to the root", () => {
        expect(buildThreadNameContent("$root", "  Release  plan ")).toEqual({
            name: "Release  plan",
            "m.relates_to": {
                rel_type: THREAD_NAME_REL_TYPE,
                event_id: "$root",
            },
        });
    });

    it("clears with an empty name, still targeting the root", () => {
        const c = buildThreadNameContent("$root", "   ");
        expect(c.name).toBe("");
        expect(threadNameTarget(c)).toBe("$root");
        expect(parseThreadName(c)).toBeNull();
    });

    it("rejects other relations", () => {
        expect(
            threadNameTarget({
                name: "x",
                "m.relates_to": { rel_type: "m.thread", event_id: "$r" },
            }),
        ).toBeNull();
        expect(threadNameTarget({ name: "x" })).toBeNull();
        expect(threadNameTarget(null)).toBeNull();
    });

    it("targets the root from the relation alone", () => {
        // An encrypted event's wire content, which is also a missing name:
        // the event still counts, and reads as the thread having no name.
        const wire = {
            algorithm: "m.megolm.v1.aes-sha2",
            ciphertext: "...",
            "m.relates_to": { rel_type: THREAD_NAME_REL_TYPE, event_id: "$r" },
        };
        expect(threadNameTarget(wire)).toBe("$r");
        expect(parseThreadName(wire)).toBeNull();
    });
});

describe("threadNameLevel", () => {
    it("reads the room's key, numeric strings included", () => {
        const level = (value: unknown) =>
            threadNameLevel({ [THREAD_NAME_POWER_LEVEL_KEY]: value });
        expect(level(100)).toBe(100);
        expect(level(0)).toBe(0);
        expect(level("75")).toBe(75);
    });

    it("defaults when the key, or the whole event, is absent", () => {
        expect(threadNameLevel({ redact: 0 })).toBe(DEFAULT_THREAD_NAME_LEVEL);
        expect(threadNameLevel(undefined)).toBe(DEFAULT_THREAD_NAME_LEVEL);
        expect(threadNameLevel({ [THREAD_NAME_POWER_LEVEL_KEY]: "x" })).toBe(
            DEFAULT_THREAD_NAME_LEVEL,
        );
    });
});

describe("mayNameThread", () => {
    const base = {
        senderId: "@a:x",
        rootSenderId: "@b:x",
        senderPowerLevel: 0,
        moderatorLevel: 25,
    };

    it("lets the root's sender name their thread", () => {
        expect(mayNameThread({ ...base, senderId: "@b:x" })).toBe(true);
    });

    it("lets moderators name any thread", () => {
        expect(mayNameThread({ ...base, senderPowerLevel: 25 })).toBe(true);
    });

    it("refuses everyone else, just below the moderator level too", () => {
        expect(mayNameThread(base)).toBe(false);
        expect(mayNameThread({ ...base, senderPowerLevel: 24 })).toBe(false);
    });

    it("refuses non-moderators when the root's sender is unknown", () => {
        expect(mayNameThread({ ...base, rootSenderId: null })).toBe(false);
    });
});

describe("latestThreadNameEvent", () => {
    const named = (sender: string, name: string, root = "$root") => ({
        sender,
        content: buildThreadNameContent(root, name),
    });
    const anyone = () => true;

    it("takes the first event: the input is newest first", () => {
        const newest = named("@a:x", "New");
        expect(
            latestThreadNameEvent(
                "$root",
                [newest, named("@a:x", "Old")],
                anyone,
            ),
        ).toBe(newest);
    });

    it("skips senders who may not name the thread", () => {
        const good = named("@ok:x", "Good");
        expect(
            latestThreadNameEvent(
                "$root",
                [named("@bad:x", "Spam"), good],
                (s) => s === "@ok:x",
            ),
        ).toBe(good);
    });

    it("stops at a clear: older names don't show through", () => {
        const clear = named("@a:x", "");
        const out = latestThreadNameEvent(
            "$root",
            [clear, named("@a:x", "Name")],
            anyone,
        );
        expect(out).toBe(clear);
        expect(parseThreadName(out?.content)).toBeNull();
    });

    it("works on an event it can't read yet", () => {
        const encrypted = {
            sender: "@a:x",
            content: {
                ciphertext: "...",
                "m.relates_to": {
                    rel_type: THREAD_NAME_REL_TYPE,
                    event_id: "$root",
                },
            },
        };
        expect(latestThreadNameEvent("$root", [encrypted], anyone)).toBe(
            encrypted,
        );
    });

    it("ignores events naming another root, and returns null for none", () => {
        const other = named("@a:x", "Elsewhere", "$other");
        expect(latestThreadNameEvent("$root", [other], anyone)).toBeNull();
        expect(latestThreadNameEvent("$root", [], anyone)).toBeNull();
    });
});

describe("buildThreadNamePushRule", () => {
    it("silences the relation, which needs no decrypting", () => {
        const { kind, body } = buildThreadNamePushRule();
        expect(kind).toBe("override");
        expect(body.actions).toEqual([]);
        expect(body.conditions).toEqual([
            {
                kind: "event_property_is",
                key: "content.m\\.relates_to.rel_type",
                value: THREAD_NAME_REL_TYPE,
            },
        ]);
    });
});
