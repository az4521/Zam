export const CALL_NOTIFY_RULE_ID = "moe.crafty.rule.call_notify";

/** Body for the underride push rule that rings on an MSC4075 m.call.notify.
 *  Must match what the Task-0 spike proved works. On homeservers that already
 *  push m.call.notify by default (continuwuity) this is belt-and-suspenders;
 *  on Synapse/tuwunel-family servers, whose default rules won't push an
 *  unknown event type, it is load-bearing. */
export function buildCallNotifyPushRule() {
    return {
        ruleId: CALL_NOTIFY_RULE_ID,
        kind: "underride" as const,
        body: {
            conditions: [
                { kind: "event_match", key: "type", pattern: "m.call.notify" },
            ],
            actions: ["notify", { set_tweak: "sound", value: "ring" }],
        },
    };
}
