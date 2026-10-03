import {
    CALL_NOTIFY_EVENT_TYPE,
    RTC_NOTIFICATION_EVENT_TYPE,
} from "./callNotify";

export const CALL_NOTIFY_RULE_ID = "moe.crafty.rule.call_notify";
export const RTC_NOTIFICATION_RULE_ID = "moe.crafty.rule.rtc_notification";

/** Underride push rules that ring on an MSC4075 ring event, so a device whose
 *  app is closed still gets pushed. One per wire type: the SDK's
 *  `org.matrix.msc4075.rtc.notification` (what we and current Element clients
 *  send) and the older UNSTABLE `org.matrix.msc4075.call.notify` (older Zam;
 *  continuwuity rewrites even a stable `m.call.notify` to it, verified live
 *  2026-08-21, so matching the stable string would never fire). On
 *  continuwuity these are belt-and-suspenders (it pushes every message by
 *  default); on Synapse/tuwunel-family servers they are load-bearing. */
export function buildCallNotifyPushRules() {
    return [
        [RTC_NOTIFICATION_RULE_ID, RTC_NOTIFICATION_EVENT_TYPE],
        [CALL_NOTIFY_RULE_ID, CALL_NOTIFY_EVENT_TYPE],
    ].map(([ruleId, pattern]) => ({
        ruleId,
        kind: "underride" as const,
        body: {
            conditions: [{ kind: "event_match", key: "type", pattern }],
            actions: ["notify", { set_tweak: "sound", value: "ring" }],
        },
    }));
}
