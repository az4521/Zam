/**
 * Pure rules for "disconnect from voice": a moderator removes someone from a
 * call without kicking them from the room. The command is a room event,
 * `com.zam.call.kick`; every Zam client in the call applies it on receipt.
 */

export const CALL_KICK_EVENT_TYPE = "com.zam.call.kick";

/** How long other clients treat a kicked device as gone from the call. */
export const CALL_KICK_WINDOW_MS = 5 * 60 * 1000;

/** A kick older than this is history (initial sync, a backfill), not a command. */
export const CALL_KICK_MAX_AGE_MS = 2 * 60 * 1000;

/** Tolerated clock skew between the sender's timestamp and ours. */
const CALL_KICK_MAX_FUTURE_MS = 60 * 1000;

export interface CallKickContent {
    /** The member to remove. */
    user_id: string;
    /** One device to remove; omitted removes all of the user's devices. */
    device_id?: string;
    reason?: string;
    /** The call slot, as the membership uses it. */
    call_id?: string;
}

/** Validates event content from the wire. Null when it is not a kick. */
export function parseCallKickContent(
    content: Record<string, unknown>,
): CallKickContent | null {
    const userId = content.user_id;
    if (typeof userId !== "string" || !userId.startsWith("@")) return null;
    const deviceId = content.device_id;
    if (deviceId !== undefined && (typeof deviceId !== "string" || !deviceId))
        return null;
    const out: CallKickContent = { user_id: userId };
    if (deviceId) out.device_id = deviceId;
    if (typeof content.reason === "string") out.reason = content.reason;
    if (typeof content.call_id === "string") out.call_id = content.call_id;
    return out;
}

/** May an actor disconnect a target from voice? The same bar as a room kick:
 *  the actor meets the room kick level and outranks the target. Ranks are the
 *  room power ranks (the creator counts as the top). */
export function canDisconnectFromVoice(
    actorRank: number,
    targetRank: number,
    kickLevel: number,
): boolean {
    return actorRank >= kickLevel && actorRank > targetRank;
}

/** Whether a kick event is recent enough to act on. */
export function isLiveCallKick(eventTs: number, nowMs: number): boolean {
    const age = nowMs - eventTs;
    return age <= CALL_KICK_MAX_AGE_MS && age >= -CALL_KICK_MAX_FUTURE_MS;
}

/** Whether a kick covers one membership's device. */
export function kickCoversDevice(
    kick: Pick<CallKickContent, "user_id" | "device_id">,
    userId: string,
    deviceId: string,
): boolean {
    return (
        kick.user_id === userId &&
        (!kick.device_id || kick.device_id === deviceId)
    );
}

/** Key for one kicked device (or, without a device, every device of the user)
 *  in one room. */
export function callKickKey(
    roomId: string,
    userId: string,
    deviceId?: string,
): string {
    return `${roomId}\n${userId}\n${deviceId ?? "*"}`;
}
