import { describe, it, expect } from "vitest";
import type { IPushRule, PushRuleAction } from "matrix-js-sdk";
import {
    keywordActions,
    behaviorFromActions,
    keywordRuleToView,
    keywordRulesFromContent,
    normalizeKeyword,
    validateKeyword,
} from "./keywordRules";

const rule = (over: Partial<IPushRule>): IPushRule => ({
    rule_id: "foo",
    default: false,
    enabled: true,
    pattern: "foo",
    actions: ["notify"] as unknown as PushRuleAction[],
    ...over,
});

describe("keywordActions", () => {
    it("highlight_sound -> notify + sound + highlight", () => {
        const a = keywordActions("highlight_sound");
        expect(a).toContain("notify");
        expect(a).toContainEqual({ set_tweak: "sound", value: "default" });
        expect(a).toContainEqual({ set_tweak: "highlight" });
    });
    it("highlight -> notify + highlight, no sound", () => {
        const a = keywordActions("highlight");
        expect(a).toContain("notify");
        expect(a).toContainEqual({ set_tweak: "highlight" });
        expect(
            a.some((x) => typeof x === "object" && x.set_tweak === "sound"),
        ).toBe(false);
    });
    it("notify -> notify + highlight:false", () => {
        const a = keywordActions("notify");
        expect(a).toContain("notify");
        expect(a).toContainEqual({ set_tweak: "highlight", value: false });
    });
});

describe("behaviorFromActions", () => {
    it("round-trips every behavior", () => {
        for (const b of ["highlight_sound", "highlight", "notify"] as const) {
            expect(behaviorFromActions(keywordActions(b))).toBe(b);
        }
    });
    it("['notify'] -> notify", () => {
        expect(
            behaviorFromActions(["notify"] as unknown as PushRuleAction[]),
        ).toBe("notify");
    });
    it("sound without highlight -> notify", () => {
        expect(
            behaviorFromActions([
                "notify",
                { set_tweak: "sound", value: "default" },
            ] as unknown as PushRuleAction[]),
        ).toBe("notify");
    });
    it("sound WITH highlight -> highlight_sound", () => {
        expect(
            behaviorFromActions([
                "notify",
                { set_tweak: "sound", value: "default" },
                { set_tweak: "highlight" },
            ] as unknown as PushRuleAction[]),
        ).toBe("highlight_sound");
    });
    it("highlight value:false -> notify", () => {
        expect(
            behaviorFromActions([
                "notify",
                { set_tweak: "highlight", value: false },
            ] as unknown as PushRuleAction[]),
        ).toBe("notify");
    });
    // Spec "Historical Actions": ["dont_notify"] and [] both mean "no
    // notification" — a muted keyword, not a notifying one.
    it("undefined / [] -> mute", () => {
        expect(behaviorFromActions(undefined)).toBe("mute");
        expect(behaviorFromActions([])).toBe("mute");
    });
    it("['dont_notify'] -> mute", () => {
        expect(
            behaviorFromActions(["dont_notify"] as unknown as PushRuleAction[]),
        ).toBe("mute");
    });
});

describe("keywordRuleToView", () => {
    it("server-default contains_user_name -> null", () => {
        expect(
            keywordRuleToView(
                rule({
                    rule_id: ".m.rule.contains_user_name",
                    default: true,
                    pattern: "alice",
                }),
            ),
        ).toBeNull();
    });
    it("dotted id even if default false -> null", () => {
        expect(
            keywordRuleToView(rule({ rule_id: ".m.rule.foo", default: false })),
        ).toBeNull();
    });
    it("user rule -> view with matching pattern/behavior", () => {
        const v = keywordRuleToView(
            rule({
                rule_id: "foo",
                pattern: "foo",
                enabled: true,
                actions: [
                    "notify",
                    { set_tweak: "highlight" },
                ] as unknown as PushRuleAction[],
            }),
        );
        expect(v).toEqual({
            ruleId: "foo",
            pattern: "foo",
            enabled: true,
            behavior: "highlight",
        });
    });
    it("enabled:false preserved", () => {
        expect(keywordRuleToView(rule({ enabled: false }))?.enabled).toBe(
            false,
        );
    });
    it("missing/empty pattern -> null", () => {
        expect(keywordRuleToView(rule({ pattern: undefined }))).toBeNull();
        expect(keywordRuleToView(rule({ pattern: "" }))).toBeNull();
    });
});

describe("keywordRulesFromContent", () => {
    it("filters server default, sorts user rules by pattern", () => {
        const content: IPushRule[] = [
            rule({ rule_id: "zebra", pattern: "zebra" }),
            rule({
                rule_id: ".m.rule.contains_user_name",
                default: true,
                pattern: "me",
            }),
            rule({ rule_id: "apple", pattern: "apple", enabled: false }),
        ];
        const views = keywordRulesFromContent(content);
        expect(views.map((v) => v.pattern)).toEqual(["apple", "zebra"]);
        expect(views[0].enabled).toBe(false);
    });
    it("undefined -> []", () => {
        expect(keywordRulesFromContent(undefined)).toEqual([]);
    });
});

describe("normalizeKeyword / validateKeyword", () => {
    it("trims", () => {
        expect(normalizeKeyword("  hi  ")).toBe("hi");
    });
    it("empty / whitespace -> error", () => {
        expect(validateKeyword("", [])).toEqual({
            ok: false,
            error: "Keyword cannot be empty",
        });
        expect(validateKeyword("   ", [])).toEqual({
            ok: false,
            error: "Keyword cannot be empty",
        });
    });
    it("case-insensitive duplicate -> error", () => {
        expect(validateKeyword("FOO", ["foo"])).toEqual({
            ok: false,
            error: "You already have a rule for this keyword",
        });
    });
    it("glob passes through", () => {
        expect(validateKeyword("foo*", [])).toEqual({
            ok: true,
            pattern: "foo*",
        });
    });
    it("leading dot -> error (reserved for server rule ids)", () => {
        expect(validateKeyword(".foo", [])).toEqual({
            ok: false,
            error: "Keyword cannot start with '.'",
        });
        expect(validateKeyword("  .bar", [])).toEqual({
            ok: false,
            error: "Keyword cannot start with '.'",
        });
    });
    it("fresh keyword against non-empty list -> ok", () => {
        expect(validateKeyword("bar", ["foo"])).toEqual({
            ok: true,
            pattern: "bar",
        });
    });
});
