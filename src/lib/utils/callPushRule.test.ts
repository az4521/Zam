import { describe, it, expect } from "vitest";
import { buildCallNotifyPushRule, CALL_NOTIFY_RULE_ID } from "./callPushRule";

describe("buildCallNotifyPushRule", () => {
    it("matches on the unstable MSC4075 type that is actually stored/pushed", () => {
        // Regression guard: the rule must key on org.matrix.msc4075.call.notify,
        // NOT the stable m.call.notify (which never appears on the wire).
        expect(buildCallNotifyPushRule()).toEqual({
            ruleId: "moe.crafty.rule.call_notify",
            kind: "underride",
            body: {
                conditions: [
                    {
                        kind: "event_match",
                        key: "type",
                        pattern: "org.matrix.msc4075.call.notify",
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
