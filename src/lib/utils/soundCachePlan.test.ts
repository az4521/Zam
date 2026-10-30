import { describe, expect, it } from "vitest";
import { parseSoundCacheIndex, planSoundCacheEviction } from "./soundCachePlan";

describe("planSoundCacheEviction", () => {
    const index = {
        a: { size: 10, used: 1 },
        b: { size: 10, used: 3 },
        c: { size: 10, used: 2 },
    };

    it("drops nothing within the limits", () => {
        expect(planSoundCacheEviction(index, 30, 3)).toEqual([]);
    });

    it("drops the least recently used first, by bytes", () => {
        expect(planSoundCacheEviction(index, 20, 3)).toEqual(["a"]);
        expect(planSoundCacheEviction(index, 10, 3)).toEqual(["a", "c"]);
    });

    it("drops by entry count too", () => {
        expect(planSoundCacheEviction(index, 1000, 1)).toEqual(["a", "c"]);
    });

    it("never drops the entry just written", () => {
        expect(planSoundCacheEviction(index, 0, 0, "a")).toEqual(["c", "b"]);
    });
});

describe("parseSoundCacheIndex", () => {
    it("keeps well-formed entries only", () => {
        expect(
            parseSoundCacheIndex({
                ok: { size: 5, used: 9 },
                bad: { size: "5", used: 9 },
                worse: null,
                neg: { size: -1, used: 1 },
            }),
        ).toEqual({ ok: { size: 5, used: 9 } });
        expect(parseSoundCacheIndex(null)).toEqual({});
        expect(parseSoundCacheIndex([])).toEqual({});
    });
});
