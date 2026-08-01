import {
    ConditionKind,
    PushRuleActionName,
    PushRuleKind,
    type MatrixClient,
    type MatrixError,
} from "matrix-js-sdk";
import {
    classifyPushRuleWriteError,
    planPushRuleCacheUpdate,
    pushRuleFailureMessage,
    shouldAttemptRuleCreate,
    verifyPushRuleLevel,
    type PushRuleWriteFailure,
} from "$lib/utils/pushRuleWrite";

export type RoomNotificationSetting = "default" | "all" | "mentions" | "mute";

export type PushRuleLevel = "loud" | "silent" | "off";

/** A single push-rule action: the "notify" string, "dont_notify", or a tweak. */
export type PushAction = string | { set_tweak?: string; value?: unknown };

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
        const refreshed = await refreshCachedPushRules(client);
        if (!refreshed && updated) {
            updateCachedSetting(client, roomId, setting);
        }
    }
}

/**
 * Re-pull the canonical push rules into the SDK cache. Never throws; returns
 * whether the cache now holds server truth. SDK push-rule mutation methods only
 * update the server, so this is the only way the cache and the server agree.
 */
export async function refreshCachedPushRules(
    client: MatrixClient,
): Promise<boolean> {
    try {
        await client.getPushRules();
        return true;
    } catch (error) {
        console.warn("[push rules] could not refresh rules", error);
        return false;
    }
}

/** One requested level change for a default push rule. The caller supplies the
 *  id resolution, the create path and the cache accessors; this module owns the
 *  ordering and the honesty rules. */
export interface DefaultRuleLevelWrite {
    /** Id the UI reads back (the default rule's primary id). */
    ruleId: string;
    /** Id to write to: the primary or legacy fallback that exists, else ruleId. */
    targetId: string;
    kind: PushRuleKind;
    level: PushRuleLevel;
    /** This rule's spec-default actions, fed to actionsForLevel. */
    defaultActions: PushAction[];
    /** Human label, used in the user-facing error copy. */
    label: string;
    /** Creates targetId with the given actions. `null` for server-default
     *  (dotted) ids, which cannot be created — only enabled/actions updated. */
    createRule: ((actions: PushAction[]) => Promise<void>) | null;
    /** The level the cached rules currently report for `ruleId`. */
    readLevel: () => PushRuleLevel;
    /** Mirror the change into the cached rules. Called ONLY when a successful
     *  write could not be confirmed by re-reading. */
    applyOptimistic: (actions: PushAction[]) => void;
}

async function writeLevel(
    client: MatrixClient,
    write: DefaultRuleLevelWrite,
    actions: PushAction[],
): Promise<void> {
    if (write.level === "off") {
        await client.setPushRuleEnabled(
            "global",
            write.kind,
            write.targetId,
            false,
        );
        return;
    }
    await client.setPushRuleActions(
        "global",
        write.kind,
        write.targetId,
        actions as any,
    );
    await client.setPushRuleEnabled("global", write.kind, write.targetId, true);
}

/**
 * Read back the level the refreshed cache reports, defensively. The reader is
 * injected, so it can throw (a malformed rule, a client torn down mid-flight);
 * an unreadable cache is UNKNOWN, which `verifyPushRuleLevel` treats as
 * "unverified". Letting it propagate would reject with a raw error message where
 * the caller's contract promises user-facing copy — and the settings UI toasts
 * that message verbatim.
 */
function observedLevel(write: DefaultRuleLevelWrite): PushRuleLevel | null {
    try {
        return write.readLevel();
    } catch (error) {
        console.warn("[push rules] could not read back", write.ruleId, error);
        return null;
    }
}

/**
 * Set a default push rule's level and report the outcome HONESTLY (NOTIF-01).
 *
 * The old shape optimistically mutated the cached rule after ANY failure, so a
 * network blip while muting showed "muted" while the homeserver kept notifying.
 * Instead: attempt the write, re-pull canonical rules (which also discards a
 * half-applied write), and compare. The cached rules are only mutated locally
 * when a *confirmed* write could not be re-read.
 *
 * Rejects with a user-facing message when the requested level is not what the
 * refreshed rules report; resolves when they agree.
 *
 * "Agree" is judged against the SDK's cache, which is NOT raw server truth:
 * `getPushRules()` feeds `setPushRules()`, which runs
 * `PushProcessor.rewriteDefaultRules` and re-injects the client-side default
 * rules a homeserver omits — in matrix-js-sdk 41 those are
 * `.m.rule.is_room_mention`, `.m.rule.reaction`,
 * `.org.matrix.msc3786.rule.room.server_acl` and
 * `.org.matrix.msc3914.rule.room.call`. So "the rule does not exist and you asked
 * for off, therefore success" holds only for ids OUTSIDE that set. Asking for
 * "off" on `.m.rule.is_room_mention` reads back "silent" — it is re-injected
 * enabled with notify + highlight and no sound — and correctly rejects with the
 * rule-missing copy, because the SDK goes on evaluating that rule locally no
 * matter what the server does or does not store.
 */
export async function setDefaultPushRuleLevelForClient(
    client: MatrixClient,
    write: DefaultRuleLevelWrite,
): Promise<void> {
    const actions = actionsForLevel(write.defaultActions, write.level);
    let wrote = false;
    let failure: PushRuleWriteFailure | undefined;

    try {
        await writeLevel(client, write, actions);
        wrote = true;
    } catch (error) {
        failure = classifyPushRuleWriteError(error);
        console.warn("[push rules] write failed", write.targetId, error);
        if (
            write.createRule &&
            shouldAttemptRuleCreate(failure, write.createRule !== null)
        ) {
            // A custom rule the server does not have yet (or refused to update)
            // can be created outright. "off" is created silent, then disabled.
            try {
                await write.createRule(
                    write.level === "off"
                        ? actionsForLevel(write.defaultActions, "silent")
                        : actions,
                );
                if (write.level === "off") {
                    await client.setPushRuleEnabled(
                        "global",
                        write.kind,
                        write.targetId,
                        false,
                    );
                }
                wrote = true;
                failure = undefined;
            } catch (createError) {
                failure = classifyPushRuleWriteError(createError);
                console.warn(
                    "[push rules] create failed",
                    write.targetId,
                    createError,
                );
            }
        }
    }

    const refreshed = await refreshCachedPushRules(client);
    if (planPushRuleCacheUpdate({ wrote, refreshed }) === "optimistic") {
        write.applyOptimistic(actions);
    }

    // Read AFTER the refresh, never before: the pre-write level is the old value
    // by definition, so verifying against it would fail every successful change.
    const verdict = verifyPushRuleLevel({
        requested: write.level,
        observed: refreshed ? observedLevel(write) : null,
    });
    // The refreshed rules report what was asked for. For a rule the server does
    // not have, this is only reachable when the SDK does not re-inject it.
    if (verdict.status === "applied") return;
    if (!wrote) {
        throw new Error(
            pushRuleFailureMessage(write.label, failure ?? "transport"),
        );
    }
    if (verdict.status === "mismatch") {
        throw new Error(pushRuleFailureMessage(write.label, "mismatch"));
    }
    // Wrote, but could not re-read: the local mirror above is the best truth we
    // have. Not an error.
}
