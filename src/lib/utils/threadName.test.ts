import { describe, it, expect } from "vitest";
import {
    MAX_THREAD_NAME_LENGTH,
    THREAD_NAME_REL_TYPE,
    buildThreadNameContent,
    latestThreadName,
    mayNameThread,
    normalizeThreadName,
    parseThreadName,
    threadNameTarget,
} from "./threadName";

describe("normalizeThreadName", () => {
    it("collapses whitespace and trims", () => {
        expect(normalizeThreadName("  release \n  plan\t")).toBe(
            "release plan",
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
        expect(parseThreadName({ name: " a\n b " })).toBe("a b");
    });
});

describe("buildThreadNameContent / threadNameTarget", () => {
    it("relates the cleaned name to the root", () => {
        expect(buildThreadNameContent("$root", "  Release  plan ")).toEqual({
            name: "Release plan",
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

    it("rejects other relations and contents without a string name", () => {
        expect(
            threadNameTarget({
                name: "x",
                "m.relates_to": { rel_type: "m.thread", event_id: "$r" },
            }),
        ).toBeNull();
        expect(
            threadNameTarget({
                "m.relates_to": {
                    rel_type: THREAD_NAME_REL_TYPE,
                    event_id: "$r",
                },
            }),
        ).toBeNull();
        expect(threadNameTarget({ name: "x" })).toBeNull();
        expect(threadNameTarget(null)).toBeNull();
    });
});

describe("mayNameThread", () => {
    const base = {
        senderId: "@a:x",
        rootSenderId: "@b:x",
        senderPowerLevel: 0,
        moderatorLevel: 50,
    };

    it("lets the root's sender name their thread", () => {
        expect(mayNameThread({ ...base, senderId: "@b:x" })).toBe(true);
    });

    it("lets moderators name any thread", () => {
        expect(mayNameThread({ ...base, senderPowerLevel: 50 })).toBe(true);
    });

    it("refuses everyone else", () => {
        expect(mayNameThread(base)).toBe(false);
    });

    it("refuses non-moderators when the root's sender is unknown", () => {
        expect(mayNameThread({ ...base, rootSenderId: null })).toBe(false);
    });
});

describe("latestThreadName", () => {
    const named = (
        eventId: string,
        senderId: string,
        ts: number,
        name: string,
    ) => ({
        eventId,
        senderId,
        ts,
        content: buildThreadNameContent("$root", name),
    });
    const anyone = () => true;

    it("picks the newest allowed naming event", () => {
        const out = latestThreadName(
            "$root",
            [
                named("$1", "@a:x", 100, "Old"),
                named("$2", "@a:x", 300, "New"),
                named("$3", "@a:x", 200, "Middle"),
            ],
            anyone,
        );
        expect(out).toEqual({ name: "New", eventId: "$2", ts: 300 });
    });

    it("skips senders who may not name the thread", () => {
        const out = latestThreadName(
            "$root",
            [
                named("$1", "@ok:x", 100, "Good"),
                named("$2", "@bad:x", 200, "Spam"),
            ],
            (s) => s === "@ok:x",
        );
        expect(out?.name).toBe("Good");
    });

    it("reports a clear as a null name, not a missing result", () => {
        const out = latestThreadName(
            "$root",
            [named("$1", "@a:x", 100, "Name"), named("$2", "@a:x", 200, "")],
            anyone,
        );
        expect(out).toEqual({ name: null, eventId: "$2", ts: 200 });
    });

    it("ignores events naming another root, and returns null for none", () => {
        const other = {
            eventId: "$9",
            senderId: "@a:x",
            ts: 999,
            content: buildThreadNameContent("$other", "Elsewhere"),
        };
        expect(latestThreadName("$root", [other], anyone)).toBeNull();
        expect(latestThreadName("$root", [], anyone)).toBeNull();
    });
});
