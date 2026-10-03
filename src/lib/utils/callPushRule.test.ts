import { describe, it, expect } from "vitest";
import {
    buildCallNotifyPushRules,
    CALL_NOTIFY_RULE_ID,
    RTC_NOTIFICATION_RULE_ID,
} from "./callPushRule";

const ring = (ruleId: string, pattern: string) => ({
    ruleId,
    kind: "underride",
    body: {
        conditions: [{ kind: "event_match", key: "type", pattern }],
        actions: ["notify", { set_tweak: "sound", value: "ring" }],
    },
});

describe("buildCallNotifyPushRules", () => {
    it("rings on the SDK's rtc.notification and the older unstable call-notify", () => {
        // Regression guard: the old rule must key on org.matrix.msc4075.call.notify,
        // NOT the stable m.call.notify (which never appears on the wire).
        expect(buildCallNotifyPushRules()).toEqual([
            ring(
                "moe.crafty.rule.rtc_notification",
                "org.matrix.msc4075.rtc.notification",
            ),
            ring(
                "moe.crafty.rule.call_notify",
                "org.matrix.msc4075.call.notify",
            ),
        ]);
    });

    it("exposes the rule id constants", () => {
        expect(CALL_NOTIFY_RULE_ID).toBe("moe.crafty.rule.call_notify");
        expect(RTC_NOTIFICATION_RULE_ID).toBe(
            "moe.crafty.rule.rtc_notification",
        );
    });
});
