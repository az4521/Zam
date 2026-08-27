import { describe, it, expect } from "vitest";
import { applyReplacements, type ReplaceRule } from "./textReplace";

const rule = (p: Partial<ReplaceRule>): ReplaceRule => ({
    match: "",
    replacement: "",
    isRegex: false,
    caseInsensitive: false,
    ...p,
});

describe("applyReplacements", () => {
    it("returns text unchanged with no rules (identity)", () => {
        expect(applyReplacements("hello world", [])).toBe("hello world");
    });

    it("literal replace-all replaces every occurrence", () => {
        expect(
            applyReplacements("a a a", [
                rule({ match: "a", replacement: "b" }),
            ]),
        ).toBe("b b b");
    });

    it("literal match treats regex metacharacters as literal", () => {
        expect(
            applyReplacements("1.2.3", [
                rule({ match: ".", replacement: "-" }),
            ]),
        ).toBe("1-2-3");
        // '.' matched the literal dots, not every char
    });

    it("literal replacement with $ / $1 / $& stays literal (no backref surprise)", () => {
        expect(
            applyReplacements("price", [
                rule({ match: "price", replacement: "$5 for $1 item" }),
            ]),
        ).toBe("$5 for $1 item");
        expect(
            applyReplacements("x", [rule({ match: "x", replacement: "$&$$" })]),
        ).toBe("$&$$");
    });

    it("applies rules in order (each sees the prior output)", () => {
        expect(
            applyReplacements("a", [
                rule({ match: "a", replacement: "b" }),
                rule({ match: "b", replacement: "c" }),
            ]),
        ).toBe("c");
    });

    it("case-insensitive literal replaces regardless of case", () => {
        expect(
            applyReplacements("Foo FOO foo", [
                rule({
                    match: "foo",
                    replacement: "bar",
                    caseInsensitive: true,
                }),
            ]),
        ).toBe("bar bar bar");
    });

    it("case-sensitive literal only replaces exact case", () => {
        expect(
            applyReplacements("Foo foo", [
                rule({ match: "foo", replacement: "bar" }),
            ]),
        ).toBe("Foo bar");
    });

    it("regex rule replaces matches globally", () => {
        expect(
            applyReplacements("a1b2c3", [
                rule({ match: "\\d", replacement: "#", isRegex: true }),
            ]),
        ).toBe("a#b#c#");
    });

    it("regex replacement stays literal ($1 not interpreted) (D1)", () => {
        expect(
            applyReplacements("word", [
                rule({
                    match: "(w)(ord)",
                    replacement: "$1-$2",
                    isRegex: true,
                }),
            ]),
        ).toBe("$1-$2");
    });

    it("invalid regex rule is skipped, others still apply (D3)", () => {
        expect(
            applyReplacements("ab", [
                rule({ match: "(", replacement: "X", isRegex: true }),
                rule({ match: "b", replacement: "Y" }),
            ]),
        ).toBe("aY");
    });

    it("empty match is skipped (D2)", () => {
        expect(
            applyReplacements("hi", [rule({ match: "", replacement: "X" })]),
        ).toBe("hi");
        expect(
            applyReplacements("hi", [
                rule({ match: "", replacement: "X", isRegex: true }),
            ]),
        ).toBe("hi");
    });

    it("non-string replacement coalesces to empty (defense in depth)", () => {
        expect(
            applyReplacements("hi there", [
                {
                    match: "hi",
                    replacement: undefined as unknown as string,
                    isRegex: false,
                    caseInsensitive: false,
                },
            ]),
        ).toBe(" there");
    });

    it("global zero-width regex does not loop or throw (D3/safety)", () => {
        // 'x*' matches empty positions; String.replace handles lastIndex safely.
        const out = applyReplacements("ab", [
            rule({ match: "x*", replacement: "-", isRegex: true }),
        ]);
        expect(typeof out).toBe("string");
    });
});
