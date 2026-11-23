import { describe, it, expect } from "vitest";
import {
    PERMISSION_CATALOG,
    applyEventsDiff,
    catalogTypeSet,
    customEventTypes,
    eventsMapEqual,
    isLockedByEncryption,
    rowState,
    validateCustomType,
    visibleEntries,
    withRowLevel,
    type PermEntry,
    type PlDefaults,
} from "./permissionCatalog";

const defaults: PlDefaults = { events_default: 0, state_default: 50 };

const entry = (id: string): PermEntry => {
    const e = PERMISSION_CATALOG.find((x) => x.id === id);
    if (!e) throw new Error(`missing catalog entry ${id}`);
    return e;
};

const custom = (
    types: PermEntry["types"],
    combine?: PermEntry["combine"],
): PermEntry => ({
    id: "custom",
    group: "room",
    labelKey: "roomSettings.perm.react",
    types,
    combine,
});

describe("rowState", () => {
    it("reports inherited with catch-all levels when no type is set", () => {
        const msg = rowState({}, entry("react"), defaults);
        expect(msg).toEqual({ level: 0, inherited: true, mixed: false });
        const st = rowState({}, entry("roomName"), defaults);
        expect(st).toEqual({ level: 50, inherited: true, mixed: false });
    });

    it("uses state_default for state types and events_default for messages", () => {
        const d = { events_default: 10, state_default: 90 };
        expect(rowState({}, entry("liveLocation"), d).level).toBe(90);
        expect(rowState({}, entry("react"), d).level).toBe(10);
    });

    it("reports explicit levels and not inherited", () => {
        const r = rowState({ "m.room.name": 75 }, entry("roomName"), defaults);
        expect(r).toEqual({ level: 75, inherited: false, mixed: false });
    });

    it("ignores non-numeric own values as unset", () => {
        const r = rowState(
            { "m.room.name": "bad" as unknown as number },
            entry("roomName"),
            defaults,
        );
        expect(r.inherited).toBe(true);
        expect(r.level).toBe(50);
    });

    it("does not treat prototype keys as set", () => {
        const r = rowState({}, entry("react"), defaults);
        expect(r.inherited).toBe(true);
        const p = rowState({}, custom([["constructor", "message"]]), defaults);
        expect(p.inherited).toBe(true);
    });

    it("combines mixed levels with max by default", () => {
        const e = custom([
            ["a", "state"],
            ["b", "state"],
        ]);
        const r = rowState({ a: 10 }, e, defaults);
        // a=10, b=state_default 50 -> max 50
        expect(r).toEqual({ level: 50, inherited: false, mixed: true });
    });

    it("combines mixed levels with min when asked", () => {
        const e = custom(
            [
                ["a", "state"],
                ["b", "state"],
            ],
            "min",
        );
        const r = rowState({ a: 10 }, e, defaults);
        expect(r).toEqual({ level: 10, inherited: false, mixed: true });
    });

    it("joinCalls uses min across call types", () => {
        const r = rowState(
            { "org.matrix.msc3401.call.member": 0 },
            entry("joinCalls"),
            defaults,
        );
        expect(r.level).toBe(0);
        expect(r.mixed).toBe(true);
        expect(r.inherited).toBe(false);
    });

    it("is not mixed when all types share a level", () => {
        const r = rowState(
            { "m.room.message": 5, "m.room.encrypted": 5 },
            entry("sendMessages"),
            defaults,
        );
        expect(r).toEqual({ level: 5, inherited: false, mixed: false });
    });
});

describe("withRowLevel", () => {
    it("sets every type of the entry", () => {
        const out = withRowLevel({}, entry("sendMessages"), 25);
        expect(out).toEqual({ "m.room.message": 25, "m.room.encrypted": 25 });
    });

    it("deletes every type of the entry on null", () => {
        const input = {
            "m.room.message": 1,
            "m.room.encrypted": 2,
            "m.room.name": 3,
        };
        const out = withRowLevel(input, entry("sendMessages"), null);
        expect(out).toEqual({ "m.room.name": 3 });
    });

    it("never mutates the input", () => {
        const input = { "m.room.name": 3 };
        const snapshot = { ...input };
        const out = withRowLevel(input, entry("roomName"), 7);
        expect(input).toEqual(snapshot);
        expect(out).not.toBe(input);
        expect(out).toEqual({ "m.room.name": 7 });
        const out2 = withRowLevel(input, entry("roomName"), null);
        expect(input).toEqual(snapshot);
        expect(out2).toEqual({});
    });
});

describe("visibleEntries", () => {
    it("hides room-scoped entries in spaces and shows space-scoped ones", () => {
        const ids = visibleEntries(true).map((e) => e.id);
        expect(ids).toContain("spaceChildren");
        expect(ids).not.toContain("sendMessages");
        expect(ids).not.toContain("pins");
        expect(ids).toContain("roomName");
    });

    it("hides space-scoped entries in rooms", () => {
        const ids = visibleEntries(false).map((e) => e.id);
        expect(ids).not.toContain("spaceChildren");
        expect(ids).toContain("sendMessages");
        expect(ids).toContain("pins");
        expect(ids).toContain("roomName");
    });
});

describe("isLockedByEncryption", () => {
    it("locks only encryptable entries in encrypted rooms", () => {
        expect(isLockedByEncryption(entry("createPolls"), true)).toBe(true);
        expect(isLockedByEncryption(entry("createPolls"), false)).toBe(false);
        expect(isLockedByEncryption(entry("react"), true)).toBe(false);
        expect(isLockedByEncryption(entry("sendMessages"), true)).toBe(false);
    });
});

describe("customEventTypes", () => {
    it("excludes catalog types and sorts the rest", () => {
        const events = {
            "m.room.message": 0,
            "zz.custom": 1,
            "aa.custom": 2,
            "m.room.name": 50,
        };
        expect(customEventTypes(events)).toEqual(["aa.custom", "zz.custom"]);
    });

    it("returns an empty list when all keys are catalog types", () => {
        expect(customEventTypes({ "m.room.name": 50 })).toEqual([]);
    });
});

describe("validateCustomType", () => {
    const events = { "org.example.own": 0 };

    it("reports empty for blank input", () => {
        expect(validateCustomType("", events)).toBe("empty");
        expect(validateCustomType("   ", events)).toBe("empty");
    });

    it("reports invalid for whitespace or control characters inside", () => {
        expect(validateCustomType("a b", events)).toBe("invalid");
        expect(validateCustomType("a\tb", events)).toBe("invalid");
        expect(validateCustomType("a\u0001b", events)).toBe("invalid");
        expect(validateCustomType("a\u007fb", events)).toBe("invalid");
    });

    it("reports tooLong above 255 UTF-8 bytes", () => {
        expect(validateCustomType("a".repeat(255), events)).toBe(null);
        expect(validateCustomType("a".repeat(256), events)).toBe("tooLong");
        // 'é' is 2 bytes: 128 of them = 256 bytes
        expect(validateCustomType("é".repeat(128), events)).toBe("tooLong");
        expect(validateCustomType("é".repeat(127), events)).toBe(null);
    });

    it("reports exists for own keys and catalog types", () => {
        expect(validateCustomType("org.example.own", events)).toBe("exists");
        expect(validateCustomType("m.room.name", events)).toBe("exists");
    });

    it("accepts a valid new type, trimming surrounding whitespace", () => {
        expect(validateCustomType("  org.example.new  ", events)).toBe(null);
    });
});

describe("eventsMapEqual", () => {
    it("compares own keys and values", () => {
        expect(eventsMapEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
        expect(eventsMapEqual({ a: 1 }, { a: 2 })).toBe(false);
        expect(eventsMapEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
        expect(eventsMapEqual({}, {})).toBe(true);
    });
});

describe("applyEventsDiff", () => {
    it("applies an edit onto live", () => {
        const out = applyEventsDiff({ a: 1 }, { a: 5 }, { a: 1 });
        expect(out).toEqual({ a: 5 });
    });

    it("applies a deletion", () => {
        const out = applyEventsDiff({ a: 1, b: 2 }, { b: 2 }, { a: 1, b: 2 });
        expect(out).toEqual({ b: 2 });
    });

    it("applies an addition", () => {
        const out = applyEventsDiff({}, { c: 3 }, {});
        expect(out).toEqual({ c: 3 });
    });

    it("keeps live value for keys the user did not touch", () => {
        // someone else changed "b" on the server; the user only edited "a"
        const out = applyEventsDiff(
            { a: 1, b: 2 },
            { a: 9, b: 2 },
            { a: 1, b: 7 },
        );
        expect(out).toEqual({ a: 9, b: 7 });
    });

    it("keeps a concurrent live-only key", () => {
        const out = applyEventsDiff({ a: 1 }, { a: 2 }, { a: 1, x: 4 });
        expect(out).toEqual({ a: 2, x: 4 });
    });

    it("does not mutate its inputs", () => {
        const live = { a: 1 };
        const initial = { a: 1 };
        const draft = { a: 2 };
        applyEventsDiff(initial, draft, live);
        expect(live).toEqual({ a: 1 });
        expect(initial).toEqual({ a: 1 });
        expect(draft).toEqual({ a: 2 });
    });
});

describe("catalog integrity", () => {
    it("has unique ids", () => {
        const ids = PERMISSION_CATALOG.map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("has no duplicate event types across entries", () => {
        const seen = new Set<string>();
        for (const e of PERMISSION_CATALOG) {
            for (const [type] of e.types) {
                expect(seen.has(type), `duplicate type ${type}`).toBe(false);
                seen.add(type);
            }
        }
        expect(catalogTypeSet().size).toBe(seen.size);
    });

    it("gives every entry at least one type and a label key", () => {
        for (const e of PERMISSION_CATALOG) {
            expect(e.types.length).toBeGreaterThan(0);
            expect(e.labelKey.length).toBeGreaterThan(0);
        }
    });
});
