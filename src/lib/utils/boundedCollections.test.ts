import { describe, expect, it } from "vitest";
import { setBounded, trimMapOldest, trimSetOldest } from "./boundedCollections";

describe("setBounded", () => {
    it("inserts without evicting while under the cap", () => {
        const m = new Map<string, number>();
        setBounded(m, "a", 1, 3);
        setBounded(m, "b", 2, 3);
        expect([...m.keys()]).toEqual(["a", "b"]);
    });

    it("evicts the oldest entry past the cap", () => {
        const m = new Map<string, number>();
        for (const k of ["a", "b", "c"]) setBounded(m, k, 0, 3);
        setBounded(m, "d", 0, 3);
        expect([...m.keys()]).toEqual(["b", "c", "d"]);
    });

    it("moves a re-set key to the newest position instead of evicting it", () => {
        const m = new Map<string, number>();
        for (const k of ["a", "b", "c"]) setBounded(m, k, 0, 3);
        setBounded(m, "a", 9, 3);
        expect([...m.keys()]).toEqual(["b", "c", "a"]);
        expect(m.get("a")).toBe(9);
    });
});

describe("trimMapOldest", () => {
    it("is a no-op at or under the cap", () => {
        const m = new Map([
            ["a", 1],
            ["b", 2],
        ]);
        trimMapOldest(m, 2);
        expect(m.size).toBe(2);
    });

    it("trims down to exactly the cap, oldest first", () => {
        const m = new Map<number, number>();
        for (let i = 0; i < 10; i++) m.set(i, i);
        trimMapOldest(m, 4);
        expect([...m.keys()]).toEqual([6, 7, 8, 9]);
    });
});

describe("trimSetOldest", () => {
    it("trims a set down to the cap, oldest first", () => {
        const s = new Set(["a", "b", "c", "d", "e"]);
        trimSetOldest(s, 2);
        expect([...s]).toEqual(["d", "e"]);
    });

    it("leaves a set under the cap alone", () => {
        const s = new Set(["a"]);
        trimSetOldest(s, 5);
        expect([...s]).toEqual(["a"]);
    });
});
