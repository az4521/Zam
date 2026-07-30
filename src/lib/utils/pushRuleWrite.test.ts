import { describe, expect, it } from "vitest";
import {
    classifyPushRuleWriteError,
    planPushRuleCacheUpdate,
    pushRuleFailureMessage,
    shouldAttemptRuleCreate,
    verifyPushRuleLevel,
} from "./pushRuleWrite";

describe("classifyPushRuleWriteError", () => {
    it("404 means the server has no such rule", () => {
        expect(classifyPushRuleWriteError({ httpStatus: 404 })).toBe(
            "rule-missing",
        );
    });
    it("M_NOT_FOUND on the error itself means the rule is missing", () => {
        expect(classifyPushRuleWriteError({ errcode: "M_NOT_FOUND" })).toBe(
            "rule-missing",
        );
    });
    it("M_NOT_FOUND nested under data means the rule is missing", () => {
        expect(
            classifyPushRuleWriteError({ data: { errcode: "M_NOT_FOUND" } }),
        ).toBe("rule-missing");
    });
    it("M_BAD_JSON is a rejection of the body, not a transport failure", () => {
        expect(
            classifyPushRuleWriteError({
                httpStatus: 400,
                errcode: "M_BAD_JSON",
            }),
        ).toBe("rule-rejected");
    });
    it("a bare 400 is a rejection", () => {
        expect(classifyPushRuleWriteError({ httpStatus: 400 })).toBe(
            "rule-rejected",
        );
    });
    // These MUST be transport: the write may actually have landed, so nothing
    // about server state may be assumed and no create may be attempted.
    it.each([
        ["429 rate limit", { httpStatus: 429, errcode: "M_LIMIT_EXCEEDED" }],
        ["500 server error", { httpStatus: 500 }],
        ["403 forbidden", { httpStatus: 403, errcode: "M_FORBIDDEN" }],
        ["401 unauthorized", { httpStatus: 401, errcode: "M_UNKNOWN_TOKEN" }],
        ["a plain network Error", new Error("Failed to fetch")],
    ])("%s is transport", (_label, error) => {
        expect(classifyPushRuleWriteError(error)).toBe("transport");
    });
    it.each([
        ["null", null],
        ["undefined", undefined],
        ["a string", "boom"],
        ["a number", 42],
        ["a non-string errcode", { errcode: 404 }],
        ["a non-number httpStatus", { httpStatus: "404" }],
    ])("%s is transport and does not throw", (_label, error) => {
        expect(classifyPushRuleWriteError(error)).toBe("transport");
    });
});

describe("shouldAttemptRuleCreate", () => {
    it("never creates after a transport failure, even for a creatable rule", () => {
        expect(shouldAttemptRuleCreate("transport", true)).toBe(false);
    });
    it("creates a creatable rule the server does not have", () => {
        expect(shouldAttemptRuleCreate("rule-missing", true)).toBe(true);
    });
    it("creates a creatable rule the server refused to update", () => {
        expect(shouldAttemptRuleCreate("rule-rejected", true)).toBe(true);
    });
    it("never creates a server-default rule", () => {
        expect(shouldAttemptRuleCreate("rule-missing", false)).toBe(false);
        expect(shouldAttemptRuleCreate("rule-rejected", false)).toBe(false);
    });
});

describe("verifyPushRuleLevel", () => {
    it("no canonical read means unverified, not success", () => {
        expect(
            verifyPushRuleLevel({ requested: "off", observed: null }),
        ).toEqual({ status: "unverified" });
    });
    it("observed equals requested means applied", () => {
        expect(
            verifyPushRuleLevel({ requested: "silent", observed: "silent" }),
        ).toEqual({ status: "applied" });
    });
    it("observed differs means mismatch and reports what the server has", () => {
        expect(
            verifyPushRuleLevel({ requested: "off", observed: "loud" }),
        ).toEqual({ status: "mismatch", observed: "loud" });
    });
});

describe("planPushRuleCacheUpdate", () => {
    // The NOTIF-01 invariant: a write that did not succeed may NEVER touch the
    // cache, because the cache is what the settings UI reports back to the user.
    it("no write, no refresh -> touch nothing", () => {
        expect(
            planPushRuleCacheUpdate({ wrote: false, refreshed: false }),
        ).toBe("none");
    });
    it("no write, refreshed -> touch nothing (the refresh is the truth)", () => {
        expect(planPushRuleCacheUpdate({ wrote: false, refreshed: true })).toBe(
            "none",
        );
    });
    it("wrote and refreshed -> the cache already holds server truth", () => {
        expect(planPushRuleCacheUpdate({ wrote: true, refreshed: true })).toBe(
            "canonical",
        );
    });
    it("wrote but the re-read failed -> mirror it locally", () => {
        expect(planPushRuleCacheUpdate({ wrote: true, refreshed: false })).toBe(
            "optimistic",
        );
    });
});

describe("pushRuleFailureMessage", () => {
    it.each([
        ["rule-missing" as const],
        ["rule-rejected" as const],
        ["transport" as const],
        ["mismatch" as const],
    ])("%s names the rule so the user knows what failed", (reason) => {
        expect(pushRuleFailureMessage("@room mentions", reason)).toContain(
            "@room mentions",
        );
    });
    it("gives a different explanation per reason", () => {
        const messages = new Set(
            (
                [
                    "rule-missing",
                    "rule-rejected",
                    "transport",
                    "mismatch",
                ] as const
            ).map((r) => pushRuleFailureMessage("Rooms", r)),
        );
        expect(messages.size).toBe(4);
    });
});
