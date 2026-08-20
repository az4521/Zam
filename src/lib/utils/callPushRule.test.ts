import { describe, it, expect } from "vitest";
import { buildCallNotifyPushRule, CALL_NOTIFY_RULE_ID } from "./callPushRule";

describe("buildCallNotifyPushRule", () => {
    it("matches the exact shape the Task-0 spike proved works", () => {
        // Regression guard: the rule must not silently drift from the verified body.
        expect(buildCallNotifyPushRule()).toEqual({
            ruleId: "moe.crafty.rule.call_notify",
            kind: "underride",
            body: {
                conditions: [
                    {
                        kind: "event_match",
                        key: "type",
                        pattern: "m.call.notify",
                    },
                ],
                actions: ["notify", { set_tweak: "sound", value: "ring" }],
            },
        });
    });

    it("exposes the rule id constant", () => {
        expect(CALL_NOTIFY_RULE_ID).toBe("moe.crafty.rule.call_notify");
        expect(buildCallNotifyPushRule().ruleId).toBe(CALL_NOTIFY_RULE_ID);
    });
});
