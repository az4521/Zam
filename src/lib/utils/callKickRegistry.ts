/**
 * Which kicked devices other clients treat as gone from the call for a while
 * (the window in callKick.ts). In memory only: it lasts for this page's session.
 * A reload drops it, which is acceptable: the kicked client's membership is
 * only re-sent when it rejoins.
 */
import { CALL_KICK_WINDOW_MS, callKickKey } from "./callKick";

const untilByKey = new Map<string, number>();

/** Record a kick and return the time its window ends. */
export function recordCallKick(
    roomId: string,
    userId: string,
    deviceId: string | undefined,
    nowMs: number,
): number {
    const key = callKickKey(roomId, userId, deviceId);
    const end = Math.max(nowMs + CALL_KICK_WINDOW_MS, untilByKey.get(key) ?? 0);
    untilByKey.set(key, end);
    for (const [k, t] of untilByKey) if (t <= nowMs) untilByKey.delete(k);
    return end;
}

/** Whether a membership's device is inside an active kick window: either a
 *  kick naming that device, or one naming the whole user. */
export function isCallDeviceKicked(
    roomId: string,
    userId: string,
    deviceId: string,
    nowMs: number = Date.now(),
): boolean {
    if (untilByKey.size === 0) return false;
    const perDevice = untilByKey.get(callKickKey(roomId, userId, deviceId));
    if (perDevice !== undefined && nowMs < perDevice) return true;
    const wholeUser = untilByKey.get(callKickKey(roomId, userId));
    return wholeUser !== undefined && nowMs < wholeUser;
}

/** Forget every kick (on leaving a call or switching accounts). */
export function clearCallKicks(): void {
    untilByKey.clear();
}
