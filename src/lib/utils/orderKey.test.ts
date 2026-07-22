import { describe, it, expect } from "vitest";
import {
    ORDER_MIN_CHAR,
    ORDER_MAX_CHAR,
    ORDER_MAX_LEN,
    OrderRebalanceError,
    keyBetween,
    rebalancedKeys,
    compareOrder,
    numberBetween,
    rebalancedNumbers,
} from "./orderKey";

// Every char of a spec-legal key must sit in the printable-ASCII digit range.
const inRange = (key: string): boolean => {
    for (let i = 0; i < key.length; i++) {
        const c = key.charCodeAt(i);
        if (c < ORDER_MIN_CHAR || c > ORDER_MAX_CHAR) return false;
    }
    return true;
};

const sign = (n: number): number => (n < 0 ? -1 : n > 0 ? 1 : 0);

describe("constants", () => {
    it("exposes the spec bounds", () => {
        expect(ORDER_MIN_CHAR).toBe(0x20);
        expect(ORDER_MAX_CHAR).toBe(0x7e);
        expect(ORDER_MAX_LEN).toBe(50);
    });
});

describe("compareOrder — never-throwing, numeric-aware order comparison", () => {
    it("compares numbers numerically", () => {
        expect(sign(compareOrder(0.2, 0.7))).toBe(-1);
        expect(sign(compareOrder(0.7, 0.2))).toBe(1);
        expect(compareOrder(0.5, 0.5)).toBe(0);
    });

    it("compares numeric strings numerically, not lexicographically", () => {
        expect(sign(compareOrder("0.2", "0.7"))).toBe(-1);
        // The whole point: "10" > "2" numerically even though "10" < "2" as text.
        expect(sign(compareOrder("10", "2"))).toBe(1);
        expect(sign(compareOrder("2", "10"))).toBe(-1);
    });

    it("treats a number and an equal numeric string as equal", () => {
        expect(compareOrder(0.5, "0.5")).toBe(0);
        expect(compareOrder("0.5", 0.5)).toBe(0);
    });

    it("compares two non-numeric strings by code point", () => {
        expect(sign(compareOrder("a", "b"))).toBe(-1);
        expect(sign(compareOrder("b", "a"))).toBe(1);
        expect(sign(compareOrder("m.x", "m.y"))).toBe(-1);
        expect(compareOrder("abc", "abc")).toBe(0);
    });

    it("sorts numeric before non-numeric when mixed", () => {
        expect(sign(compareOrder(0.5, "abc"))).toBe(-1);
        expect(sign(compareOrder("abc", 0.5))).toBe(1);
        expect(sign(compareOrder("0.5", "abc"))).toBe(-1);
    });

    it("treats null / undefined / empty / non-string-non-number as missing (sorts last)", () => {
        // NaN is a present-but-non-numeric number; the rest are genuinely missing.
        // Either way a present numeric value sorts before them.
        for (const notNumeric of [null, undefined, "", {}, [], true, NaN]) {
            expect(sign(compareOrder(0.5, notNumeric))).toBe(-1);
            expect(sign(compareOrder(notNumeric, 0.5))).toBe(1);
        }
        expect(sign(compareOrder(0.5, null))).toBe(-1);
        expect(sign(compareOrder(null, 0.5))).toBe(1);
        expect(sign(compareOrder("abc", undefined))).toBe(-1);
        expect(sign(compareOrder(undefined, "abc"))).toBe(1);
    });

    it("returns 0 when both values are missing", () => {
        expect(compareOrder(null, undefined)).toBe(0);
        expect(compareOrder("", null)).toBe(0);
        expect(compareOrder({}, [])).toBe(0);
        expect(compareOrder(undefined, undefined)).toBe(0);
    });

    it("treats a whitespace-only string as non-numeric (not zero)", () => {
        // Number("  ") === 0, so guard against it: "  " must NOT count as numeric.
        expect(sign(compareOrder(0.5, "   "))).toBe(-1); // numeric before non-numeric
        expect(sign(compareOrder("   ", 0.5))).toBe(1);
        // Two non-numeric strings compare by code point (space < 'a').
        expect(sign(compareOrder("   ", "abc"))).toBe(-1);
    });

    it("still parses numeric strings with surrounding whitespace", () => {
        expect(compareOrder(" 5 ", 5)).toBe(0);
        expect(sign(compareOrder(" 5 ", " 6 "))).toBe(-1);
    });

    it("never throws on hostile inputs and always returns a finite number", () => {
        const hostile: unknown[] = [
            "😀",
            "a".repeat(10000),
            "!@#$%^&*()",
            NaN,
            Infinity,
            -Infinity,
            [],
            {},
            true,
            Symbol("x"),
            () => 1,
            null,
            undefined,
            "",
            "0x10",
            "1e3",
        ];
        for (const x of hostile) {
            for (const y of hostile) {
                let r: number = 0;
                expect(() => {
                    r = compareOrder(x, y);
                }).not.toThrow();
                expect(typeof r).toBe("number");
                expect(Number.isFinite(r)).toBe(true);
            }
        }
    });

    it("drives a correct sort of a mixed array (numeric asc, then non-numeric, then missing)", () => {
        const arr: unknown[] = [null, "abc", 0.9, "", 0.1, "0.5", "aaa"];
        const sorted = [...arr].sort(compareOrder);
        // numerics ascending first: 0.1, 0.5, 0.9
        expect(sorted.slice(0, 3)).toEqual([0.1, "0.5", 0.9]);
        // then non-numeric strings by code point: "aaa" < "abc"
        expect(sorted.slice(3, 5)).toEqual(["aaa", "abc"]);
        // missing last (order among the two missings is stable/irrelevant)
        expect(new Set(sorted.slice(5))).toEqual(new Set([null, ""]));
    });
});

describe("keyBetween — code-point strictly-between key generation", () => {
    it("returns a single spec-legal key for the empty (null,null) case", () => {
        const k = keyBetween(null, null);
        expect(typeof k).toBe("string");
        expect(k.length).toBeGreaterThan(0);
        expect(k.length).toBeLessThanOrEqual(ORDER_MAX_LEN);
        expect(inRange(k)).toBe(true);
    });

    it("head (null, b) → key strictly before b", () => {
        const k = keyBetween(null, "n");
        expect(k < "n").toBe(true);
        expect(inRange(k)).toBe(true);
    });

    it("tail (a, null) → key strictly after a", () => {
        const k = keyBetween("n", null);
        expect(k > "n").toBe(true);
        expect(inRange(k)).toBe(true);
    });

    it("between (a, b) → key strictly between by code point", () => {
        const k = keyBetween("a", "c");
        expect("a" < k && k < "c").toBe(true);
        expect(inRange(k)).toBe(true);
    });

    it("adjacent neighbours descend to a longer key still strictly between", () => {
        const k = keyBetween("a", "b");
        expect(k.length).toBeGreaterThan(1);
        expect("a" < k && k < "b").toBe(true);
        expect(inRange(k)).toBe(true);
    });

    it("uses code-point ordering for the guard, not numeric ordering", () => {
        // "10" < "2" as text, so this is a legal strict-between request...
        const k = keyBetween("10", "2");
        expect("10" < k && k < "2").toBe(true);
        expect(inRange(k)).toBe(true);
        // ...but "2" > "10" as text, so this is out-of-order and must throw,
        // even though numerically 2 < 10.
        expect(() => keyBetween("2", "10")).toThrow(OrderRebalanceError);
    });

    it("is robust to arbitrary / hostile neighbour strings", () => {
        // Spec-illegal control chars (DEL 0x7f, NUL 0x00) written as escapes so the
        // source file stays clean printable ASCII while still exercising the clamp path.
        const cases: [string, string][] = [
            ["m.foo", "zzz"],
            [" ", "~"],
            ["A", "a"], // mixed case
            ["a\x7f", "c"], // trailing DEL; a gap exists at index 0 → "b"
            ["A\x00z", "z"], // embedded NUL; a gap exists at index 0
            ["m.abc", "m.abd"],
        ];
        for (const [a, b] of cases) {
            const k = keyBetween(a, b);
            expect(a < k).toBe(true);
            expect(k < b).toBe(true);
            expect(inRange(k)).toBe(true);
        }
    });

    it("property: for ordered spec-legal pairs, a < keyBetween(a,b) < b", () => {
        const pairs: [string, string][] = [
            ["a", "z"],
            ["a", "b"],
            ["A", "z"],
            [" ", "~"],
            ["ab", "ac"],
            ["m", "n"],
            ["0", "9"],
            ["aaa", "aab"],
            ["!", "~"],
            ["MW", "MX"],
        ];
        for (const [a, b] of pairs) {
            const k = keyBetween(a, b);
            expect(a < k).toBe(true);
            expect(k < b).toBe(true);
            expect(inRange(k)).toBe(true);
        }
    });

    it("keeps a deterministic chain of inserts strictly monotonic", () => {
        let keys = rebalancedKeys(4);
        // fixed, reproducible slot sequence (no Math.random)
        const seq = [
            0, 3, 1, 2, 0, 4, 2, 1, 3, 5, 2, 4, 1, 3, 0, 6, 3, 2, 5, 1,
        ];
        for (const raw of seq) {
            const slot = raw % (keys.length + 1);
            const a = slot === 0 ? null : keys[slot - 1];
            const b = slot === keys.length ? null : keys[slot];
            const k = keyBetween(a, b);
            keys.splice(slot, 0, k);
            for (let i = 1; i < keys.length; i++) {
                expect(keys[i - 1] < keys[i]).toBe(true);
            }
        }
        for (const k of keys) expect(inRange(k)).toBe(true);
    });

    it("throws OrderRebalanceError on a collision (equal neighbours)", () => {
        expect(() => keyBetween("q", "q")).toThrow(OrderRebalanceError);
    });

    it("throws OrderRebalanceError on out-of-order neighbours", () => {
        expect(() => keyBetween("z", "a")).toThrow(OrderRebalanceError);
    });

    it("throws OrderRebalanceError once a repeated same-slot insert exceeds the length cap", () => {
        const lo = "a";
        let hi = "b";
        let threw = false;
        for (let i = 0; i < 5000; i++) {
            try {
                const k = keyBetween(lo, hi);
                expect(k.length).toBeLessThanOrEqual(ORDER_MAX_LEN);
                hi = k; // keep subdividing toward "a" — key length grows unboundedly
            } catch (e) {
                expect(e).toBeInstanceOf(OrderRebalanceError);
                threw = true;
                break;
            }
        }
        expect(threw).toBe(true);
    });

    it("throws when no key exists strictly below the range floor (null, ' ')", () => {
        // 0x20 (' ') is the smallest legal char, so nothing sorts strictly below
        // it — the walk must NOT fabricate a longer " O" > " ".
        expect(() => keyBetween(null, " ")).toThrow(OrderRebalanceError);
    });

    it("throws when b is a's floor-descendant with no gap ('a', 'a ')", () => {
        // "a " is the immediate successor of "a" by appending the floor char, so
        // there is no key k with "a" < k < "a ".
        expect(() => keyBetween("a", "a ")).toThrow(OrderRebalanceError);
    });

    it("throws for two floor-adjacent whitespace neighbours (' ', '  ')", () => {
        expect(() => keyBetween(" ", "  ")).toThrow(OrderRebalanceError);
    });

    it("throws when out-of-range neighbours clamp-collapse ('\\x80', '\\x81')", () => {
        // Both chars are above the 0x7e ceiling and clamp to '~'; the raw pair is
        // ordered but no in-range key sits between the clamped bounds.
        expect(() => keyBetween("\x80", "\x81")).toThrow(OrderRebalanceError);
    });

    it("range-extreme fuzz: every pair throws OrderRebalanceError or returns a strictly-between key", () => {
        // Deterministic (no Math.random). Includes the 0x20 floor and 0x7e
        // ceiling as neighbours plus a fixed nested sequence tightening toward
        // the floor. The invariant under test: keyBetween NEVER returns a key
        // outside (a, b) by code point.
        const pairs: [string | null, string | null][] = [
            [null, " "],
            [" ", "!"],
            ["}", "~"],
            ["~", null],
            ["a", "a "],
            [" ~", "!"],
            // fixed nested sequence
            [null, "!"],
            [" ", "  "],
            ["  ", "   "],
            ["!", '"'],
            ["A", "B"],
            ["AA", "AB"],
            ["~", "~ "],
            [null, null],
        ];
        for (const [a, b] of pairs) {
            let k: string;
            try {
                k = keyBetween(a, b);
            } catch (e) {
                expect(e).toBeInstanceOf(OrderRebalanceError);
                continue;
            }
            // Returned → MUST be strictly between by code point and in range.
            expect(a === null || a < k).toBe(true);
            expect(b === null || k < b).toBe(true);
            expect(inRange(k)).toBe(true);
        }
    });
});

describe("rebalancedKeys — evenly spread spec-legal keys", () => {
    it("returns [] for 0", () => {
        expect(rebalancedKeys(0)).toEqual([]);
    });

    it("returns a single spec-legal mid key for 1", () => {
        const keys = rebalancedKeys(1);
        expect(keys.length).toBe(1);
        expect(inRange(keys[0])).toBe(true);
        expect(keys[0].length).toBeLessThanOrEqual(ORDER_MAX_LEN);
    });

    it("returns n strictly-increasing spec-legal keys for n=5", () => {
        const keys = rebalancedKeys(5);
        expect(keys.length).toBe(5);
        for (let i = 1; i < keys.length; i++) {
            expect(keys[i - 1] < keys[i]).toBe(true);
        }
        for (const k of keys) {
            expect(k.length).toBeLessThanOrEqual(ORDER_MAX_LEN);
            expect(inRange(k)).toBe(true);
        }
    });

    it("stays strictly increasing and spec-legal for a large n (multi-char)", () => {
        const keys = rebalancedKeys(300);
        expect(keys.length).toBe(300);
        for (let i = 1; i < keys.length; i++) {
            expect(keys[i - 1] < keys[i]).toBe(true);
        }
        for (const k of keys) {
            expect(k.length).toBeLessThanOrEqual(ORDER_MAX_LEN);
            expect(inRange(k)).toBe(true);
        }
    });
});

describe("numberBetween — m.tag numeric midpoint", () => {
    it("returns 0.5 for the empty (null,null) case", () => {
        expect(numberBetween(null, null)).toBe(0.5);
    });

    it("head (null, x) → strictly inside (0, x)", () => {
        const v = numberBetween(null, 0.4);
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(0.4);
    });

    it("tail (x, null) → strictly inside (x, 1)", () => {
        const v = numberBetween(0.6, null);
        expect(v).toBeGreaterThan(0.6);
        expect(v).toBeLessThan(1);
    });

    it("between → the midpoint", () => {
        expect(numberBetween(0.25, 0.75)).toBe(0.5);
    });

    it("throws on equal or out-of-order bounds", () => {
        expect(() => numberBetween(0.5, 0.5)).toThrow(OrderRebalanceError);
        expect(() => numberBetween(0.75, 0.25)).toThrow(OrderRebalanceError);
    });

    it("throws on a non-finite bound (NaN / Infinity) instead of returning NaN", () => {
        expect(() => numberBetween(NaN, 0.5)).toThrow(OrderRebalanceError);
        expect(() => numberBetween(0.5, NaN)).toThrow(OrderRebalanceError);
        expect(() => numberBetween(Infinity, null)).toThrow(
            OrderRebalanceError,
        );
        expect(() => numberBetween(null, -Infinity)).toThrow(
            OrderRebalanceError,
        );
    });

    it("throws when precision is exhausted between two adjacent doubles", () => {
        const before = 0.5;
        const after = before + Number.EPSILON / 2; // the next representable double after 0.5
        expect(after).toBeGreaterThan(before);
        expect(() => numberBetween(before, after)).toThrow(OrderRebalanceError);
    });
});

describe("rebalancedNumbers — evenly spread m.tag orders in (0,1)", () => {
    it("returns [] for 0", () => {
        expect(rebalancedNumbers(0)).toEqual([]);
    });

    it("returns [0.5] for 1", () => {
        expect(rebalancedNumbers(1)).toEqual([0.5]);
    });

    it("returns n strictly-increasing symmetric values in (0,1) for n=4", () => {
        const o = rebalancedNumbers(4);
        expect(o.length).toBe(4);
        for (let i = 0; i < o.length; i++) {
            expect(o[i]).toBeGreaterThan(0);
            expect(o[i]).toBeLessThan(1);
        }
        for (let i = 1; i < o.length; i++) {
            expect(o[i - 1]).toBeLessThan(o[i]);
        }
        for (let i = 0; i < o.length; i++) {
            expect(o[i] + o[o.length - 1 - i]).toBe(1);
        }
    });
});
