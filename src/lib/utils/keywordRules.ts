import type { IPushRule, PushRuleAction } from "matrix-js-sdk";

export type KeywordBehavior = "highlight_sound" | "highlight" | "notify";

export interface KeywordRuleView {
    ruleId: string; // == pattern (Element/spec convention)
    pattern: string;
    enabled: boolean;
    behavior: KeywordBehavior;
}

// The SDK's PushRuleActionName / TweakName are string enums whose runtime values
// are exactly these strings. We build actions as plain literals so this module
// stays runtime-SDK-free (type-only import) and unit-testable in isolation.
const NOTIFY = "notify" as unknown as PushRuleAction;
const SOUND = { set_tweak: "sound", value: "default" } as PushRuleAction;
const HIGHLIGHT = { set_tweak: "highlight" } as PushRuleAction;
const HIGHLIGHT_OFF = {
    set_tweak: "highlight",
    value: false,
} as PushRuleAction;

/** Canonical actions array for a chosen behavior. "notify" always present; the
 *  highlight tweak is explicitly false for "notify" so it overrides any prior highlight. */
export function keywordActions(behavior: KeywordBehavior): PushRuleAction[] {
    switch (behavior) {
        case "highlight_sound":
            return [NOTIFY, SOUND, HIGHLIGHT];
        case "highlight":
            return [NOTIFY, HIGHLIGHT];
        case "notify":
            return [NOTIFY, HIGHLIGHT_OFF];
    }
}

type TweakLike = { set_tweak?: string; value?: unknown };

/** A highlight tweak present with value !== false. */
function hasHighlight(actions: PushRuleAction[] | undefined): boolean {
    return (actions ?? []).some(
        (a) =>
            typeof a === "object" &&
            (a as TweakLike).set_tweak === "highlight" &&
            (a as TweakLike).value !== false,
    );
}

/** Any sound tweak present. Mirrors ruleHasSound in client.ts. */
function hasSound(actions: PushRuleAction[] | undefined): boolean {
    return (actions ?? []).some(
        (a) => typeof a === "object" && (a as TweakLike).set_tweak === "sound",
    );
}

/** Inverse of keywordActions: read a rule's actions back into a behavior. */
export function behaviorFromActions(
    actions: PushRuleAction[] | undefined,
): KeywordBehavior {
    const highlight = hasHighlight(actions);
    const sound = hasSound(actions);
    if (highlight && sound) return "highlight_sound";
    if (highlight) return "highlight";
    return "notify";
}

/** One raw content push-rule -> view, or null if it is NOT a user keyword rule
 *  (dotted rule_id, default===true, or missing pattern). enabled = rule.enabled !== false. */
export function keywordRuleToView(rule: IPushRule): KeywordRuleView | null {
    if (!rule) return null;
    const ruleId = rule.rule_id;
    if (typeof ruleId !== "string" || ruleId.startsWith(".")) return null;
    if (rule.default === true) return null;
    if (typeof rule.pattern !== "string" || rule.pattern.length === 0)
        return null;
    return {
        ruleId,
        pattern: rule.pattern,
        enabled: rule.enabled !== false,
        behavior: behaviorFromActions(rule.actions),
    };
}

/** All user keyword rules from global.content[], sorted by pattern. Undefined/empty -> []. */
export function keywordRulesFromContent(
    content: IPushRule[] | undefined,
): KeywordRuleView[] {
    if (!content) return [];
    return content
        .map((r) => keywordRuleToView(r))
        .filter((v): v is KeywordRuleView => v !== null)
        .sort((a, b) => a.pattern.localeCompare(b.pattern));
}

/** Trim only (glob wildcards * ? are legal Matrix patterns — pass them through). */
export function normalizeKeyword(input: string): string {
    return input.trim();
}

/** Validate a candidate against existing patterns (case-insensitive dedup). */
export function validateKeyword(
    input: string,
    existingPatterns: string[],
): { ok: true; pattern: string } | { ok: false; error: string } {
    const pattern = normalizeKeyword(input);
    if (pattern.length === 0) {
        return { ok: false, error: "Keyword cannot be empty" };
    }
    const lower = pattern.toLocaleLowerCase();
    if (existingPatterns.some((p) => p.toLocaleLowerCase() === lower)) {
        return { ok: false, error: "You already have a rule for this keyword" };
    }
    return { ok: true, pattern };
}
