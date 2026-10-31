import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { parseRule, scriptsFor, referrerFor, frameReferrer } = require(
    join(__dirname, "../../../electron/pluginFrames.cjs"),
);

const rule = (over: Record<string, unknown> = {}) => ({
    id: "com.example.p:1",
    urlPrefixes: ["https://www.youtube.com/"],
    script: "1",
    ...over,
});

describe("parseRule", () => {
    it("accepts a well-formed rule", () => {
        expect(parseRule(rule())).toEqual(rule());
        const both = rule({ referrer: "https://example.com/" });
        expect(parseRule(both)).toEqual(both);
        const { script: _s, ...refOnly } = both;
        expect(parseRule(refOnly)).toEqual(refOnly);
    });

    it("needs a script or a referrer, and a referrer naming an origin", () => {
        const { script: _s, ...neither } = rule();
        expect(parseRule(neither)).toBeNull();
        for (const r of [
            "",
            "example.com",
            "https://example.com",
            "javascript:1",
            5,
        ])
            expect(parseRule(rule({ referrer: r }))).toBeNull();
    });

    it("rejects prefixes that don't name a whole origin", () => {
        for (const p of [
            "",
            "https://",
            "https://www.youtube.com",
            "https://www.you",
            "javascript:alert(1)",
            "file:///C:/",
            "*",
        ]) {
            expect(parseRule(rule({ urlPrefixes: [p] }))).toBeNull();
        }
    });

    it("rejects malformed input", () => {
        expect(parseRule(null)).toBeNull();
        expect(parseRule("x")).toBeNull();
        expect(parseRule(rule({ id: "" }))).toBeNull();
        expect(parseRule(rule({ id: "a b" }))).toBeNull();
        expect(parseRule(rule({ urlPrefixes: [] }))).toBeNull();
        expect(parseRule(rule({ urlPrefixes: "https://a/" }))).toBeNull();
        expect(parseRule(rule({ script: 5 }))).toBeNull();
        expect(
            parseRule(rule({ script: "x".repeat(1024 * 1024 + 1) })),
        ).toBeNull();
    });
});

describe("scriptsFor", () => {
    it("returns the scripts of matching rules in order", () => {
        const rules = new Map([
            ["a", rule({ id: "a", script: "A" })],
            [
                "b",
                rule({
                    id: "b",
                    urlPrefixes: ["https://example.com/"],
                    script: "B",
                }),
            ],
            [
                "c",
                rule({
                    id: "c",
                    urlPrefixes: [
                        "https://example.com/",
                        "https://www.youtube.com/embed/",
                    ],
                    script: "C",
                }),
            ],
        ]);
        expect(scriptsFor(rules, "https://www.youtube.com/embed/x")).toEqual([
            "A",
            "C",
        ]);
        expect(scriptsFor(rules, "https://www.youtube.com/watch?v=x")).toEqual([
            "A",
        ]);
        expect(scriptsFor(rules, "https://www.youtube.com.evil/")).toEqual([]);
        expect(scriptsFor(rules, undefined)).toEqual([]);
    });
});

describe("referrerFor", () => {
    it("returns the first matching rule's referrer, or null", () => {
        const rules = new Map([
            ["s", rule({ id: "s" })],
            [
                "a",
                rule({
                    id: "a",
                    urlPrefixes: ["https://www.youtube.com/embed/"],
                    referrer: "https://a.example/",
                }),
            ],
            ["b", rule({ id: "b", referrer: "https://b.example/" })],
        ]);
        expect(referrerFor(rules, "https://www.youtube.com/embed/x")).toBe(
            "https://a.example/",
        );
        expect(referrerFor(rules, "https://www.youtube.com/watch")).toBe(
            "https://b.example/",
        );
        expect(referrerFor(rules, "https://example.com/")).toBeNull();
    });
});

describe("frameReferrer", () => {
    it("gives YouTube players a hostname Referer, like the Android app's", () => {
        const none = new Map();
        for (const url of [
            "https://www.youtube.com/embed/x",
            "https://www.youtube-nocookie.com/embed/x",
        ])
            expect(frameReferrer(none, url)).toBe("https://localhost/");
    });

    it("leaves everything else alone", () => {
        const none = new Map();
        expect(frameReferrer(none, "https://www.youtube.com/watch")).toBeNull();
        expect(frameReferrer(none, "https://example.com/embed/x")).toBeNull();
    });

    it("lets a plugin's referrer win", () => {
        const rules = new Map([
            ["a", rule({ id: "a", referrer: "https://a.example/" })],
        ]);
        expect(frameReferrer(rules, "https://www.youtube.com/embed/x")).toBe(
            "https://a.example/",
        );
    });
});
