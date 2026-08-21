import { CALL_NOTIFY_EVENT_TYPE } from "./callNotify";

export const CALL_NOTIFY_RULE_ID = "moe.crafty.rule.call_notify";

/** Body for the underride push rule that rings on an MSC4075 call-notify. The
 *  pattern is the UNSTABLE `org.matrix.msc4075.call.notify` — that is the type
 *  actually stored/pushed (matrix-js-sdk sends it, and continuwuity rewrites
 *  even a stable `m.call.notify` to it; verified live 2026-08-21). Matching the
 *  stable string here would never fire. On continuwuity this rule is
 *  belt-and-suspenders (it pushes every message by default); on
 *  Synapse/tuwunel-family servers it is load-bearing. */
export function buildCallNotifyPushRule() {
    return {
        ruleId: CALL_NOTIFY_RULE_ID,
        kind: "underride" as const,
        body: {
            conditions: [
                {
                    kind: "event_match",
                    key: "type",
                    pattern: CALL_NOTIFY_EVENT_TYPE,
                },
            ],
            actions: ["notify", { set_tweak: "sound", value: "ring" }],
        },
    };
}
