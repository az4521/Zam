import {
    ConditionKind,
    PushRuleActionName,
    PushRuleKind,
    type MatrixClient,
    type MatrixError,
} from "matrix-js-sdk";

export type RoomNotificationSetting = "default" | "all" | "mentions" | "mute";

export type PushRuleLevel = "loud" | "silent" | "off";

/** A single push-rule action: the "notify" string, "dont_notify", or a tweak. */
type PushAction = string | { set_tweak?: string; value?: unknown };

/**
 * Build the actions array for a default push rule at a chosen level, derived
 * from that rule's spec-default actions.
 *   - loud   → the default actions verbatim (sound + any highlight tweak)
 *   - silent → the default actions minus the sound tweak (highlight is KEPT)
 *   - off    → []
 *
 * The highlight tweak is preserved verbatim and NEVER rewritten to
 * `{ set_tweak: "highlight", value: false }`, so a mention rule keeps
 * highlighting even when its sound is silenced.
 */
export function actionsForLevel(
    defaultActions: PushAction[],
    level: PushRuleLevel,
): PushAction[] {
    if (level === "off") return [];
    if (level === "loud") return [...defaultActions];
    // silent: drop only the sound tweak, keep everything else (incl. highlight).
    return defaultActions.filter(
        (a) =>
            !(
                typeof a === "object" &&
                a !== null &&
                (a as { set_tweak?: string }).set_tweak === "sound"
            ),
    );
}

/** The evaluated push actions for an event, as returned by
 *  MatrixClient.getPushActionsForEvent (notify + resolved tweaks). */
interface EvaluatedPushActions {
    notify?: boolean;
    tweaks?: { highlight?: boolean; sound?: unknown };
}

/**
 * Should an event that matched a push rule be visually highlighted in the
 * timeline? ONLY the spec's `highlight` tweak — that is the "this concerns you
 * personally" signal, set by the mention, display-name, @room and keyword rules
 * (a reply lands here too, via the sender's `m.mentions`).
 *
 * Deliberately NOT `sound`: sound means "make a noise", which plenty of
 * non-mentions do. The default DM rule `.m.rule.room_one_to_one` sets sound with
 * no highlight, so union-ing sound in painted EVERY incoming message in a DM
 * with the mention styling. Reported 2026-07-25.
 */
export function isHighlightAction(
    actions: EvaluatedPushActions | null | undefined,
): boolean {
    return actions?.tweaks?.highlight === true;
}

function globalRules(client: MatrixClient): Record<string, any[]> | undefined {
    return (client as any).pushRules?.global as
        | Record<string, any[]>
        | undefined;
}

function isMissingRule(error: unknown): boolean {
    const matrixError = error as MatrixError;
    return (
        matrixError.httpStatus === 404 ||
        (matrixError as any).errcode === "M_NOT_FOUND" ||
        (matrixError.data as any)?.errcode === "M_NOT_FOUND"
    );
}

function updateCachedSetting(
    client: MatrixClient,
    roomId: string,
    setting: RoomNotificationSetting,
): void {
    const current = (client as any).pushRules;
    if (!current?.global) return;
    const global = {
        ...current.global,
        room: [...(current.global.room ?? [])].filter(
            (rule: any) => rule.rule_id !== roomId,
        ),
        override: [...(current.global.override ?? [])].filter(
            (rule: any) => rule.rule_id !== roomId,
        ),
    };
    if (setting === "all" || setting === "mentions") {
        global.room.push({
            rule_id: roomId,
            default: false,
            enabled: true,
            actions: setting === "all" ? [PushRuleActionName.Notify] : [],
        });
    } else if (setting === "mute") {
        global.override.push({
            rule_id: roomId,
            default: false,
            enabled: true,
            actions: [],
            conditions: [
                {
                    kind: ConditionKind.EventMatch,
                    key: "room_id",
                    pattern: roomId,
                },
            ],
        });
    }
    client.setPushRules({ ...current, global });
}

async function deleteRuleIfPresent(
    client: MatrixClient,
    kind: PushRuleKind,
    roomId: string,
): Promise<void> {
    try {
        await client.deletePushRule("global", kind, roomId);
    } catch (error) {
        if (!isMissingRule(error)) throw error;
    }
}

export function getRoomNotificationSettingForClient(
    client: MatrixClient,
    roomId: string,
): RoomNotificationSetting {
    const global = globalRules(client);
    const overrideRule = (global?.override ?? []).find(
        (rule: any) => rule.rule_id === roomId,
    );
    if (
        overrideRule &&
        (overrideRule.actions.length === 0 ||
            overrideRule.actions[0] === "dont_notify")
    ) {
        return "mute";
    }

    const roomRule = (global?.room ?? []).find(
        (rule: any) => rule.rule_id === roomId,
    );
    if (!roomRule) return "default";
    return roomRule.actions[0] === PushRuleActionName.Notify
        ? "all"
        : "mentions";
}

export async function setRoomNotificationSettingForClient(
    client: MatrixClient,
    roomId: string,
    setting: RoomNotificationSetting,
): Promise<void> {
    let updated = false;
    try {
        if (setting === "all") {
            await client.addPushRule(
                "global",
                PushRuleKind.RoomSpecific,
                roomId,
                { actions: [PushRuleActionName.Notify] },
            );
            await deleteRuleIfPresent(client, PushRuleKind.Override, roomId);
        } else if (setting === "mentions") {
            // Override mention rules run before room-specific rules. A silent
            // room rule therefore suppresses ordinary messages while keeping
            // mentions and keyword notifications intact.
            await client.addPushRule(
                "global",
                PushRuleKind.RoomSpecific,
                roomId,
                { actions: [] },
            );
            await deleteRuleIfPresent(client, PushRuleKind.Override, roomId);
        } else if (setting === "mute") {
            await client.addPushRule("global", PushRuleKind.Override, roomId, {
                actions: [],
                conditions: [
                    {
                        kind: ConditionKind.EventMatch,
                        key: "room_id",
                        pattern: roomId,
                    },
                ],
            });
            await deleteRuleIfPresent(
                client,
                PushRuleKind.RoomSpecific,
                roomId,
            );
        } else {
            await deleteRuleIfPresent(
                client,
                PushRuleKind.RoomSpecific,
                roomId,
            );
            await deleteRuleIfPresent(client, PushRuleKind.Override, roomId);
        }
        updated = true;
    } finally {
        // SDK push-rule mutation methods only update the server. Pull the
        // canonical rules back so push processing and settings UI agree.
        try {
            await client.getPushRules();
        } catch (error) {
            console.warn("[push rules] could not refresh rules", error);
            if (updated) updateCachedSetting(client, roomId, setting);
        }
    }
}
