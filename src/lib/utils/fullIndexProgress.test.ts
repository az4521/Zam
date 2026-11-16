import { describe, it, expect } from "vitest";
import {
    fullIndexPercent,
    groupThousands,
    unfinishedRoomCount,
} from "./fullIndexProgress";

describe("fullIndexPercent", () => {
    it("floors the share of rooms done", () => {
        expect(fullIndexPercent(0, 40)).toBe(0);
        expect(fullIndexPercent(12, 40)).toBe(30);
        expect(fullIndexPercent(1, 3)).toBe(33);
        expect(fullIndexPercent(40, 40)).toBe(100);
    });

    it("treats no candidate rooms as finished", () => {
        expect(fullIndexPercent(0, 0)).toBe(100);
    });

    it("clamps out-of-range inputs", () => {
        expect(fullIndexPercent(50, 40)).toBe(100);
        expect(fullIndexPercent(-3, 40)).toBe(0);
        expect(fullIndexPercent(1, Number.NaN)).toBe(100);
    });
});

describe("unfinishedRoomCount", () => {
    it("counts rooms not yet done", () => {
        expect(unfinishedRoomCount(12, 40)).toBe(28);
        expect(unfinishedRoomCount(40, 40)).toBe(0);
    });

    it("never goes negative", () => {
        expect(unfinishedRoomCount(45, 40)).toBe(0);
        expect(unfinishedRoomCount(-1, 4)).toBe(4);
    });
});

describe("groupThousands", () => {
    it("groups digits in threes", () => {
        expect(groupThousands(0)).toBe("0");
        expect(groupThousands(999)).toBe("999");
        expect(groupThousands(1000)).toBe("1,000");
        expect(groupThousands(3210)).toBe("3,210");
        expect(groupThousands(1234567)).toBe("1,234,567");
    });

    it("drops fractions and clamps bad input to zero", () => {
        expect(groupThousands(1234.9)).toBe("1,234");
        expect(groupThousands(-5)).toBe("0");
        expect(groupThousands(Number.NaN)).toBe("0");
    });
});
