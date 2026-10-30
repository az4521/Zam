import { AUTO_AWAY_MS } from "$lib/utils/presence";

export interface ApplyMoment {
    /** In, joining or reconnecting to a call. */
    inCall: boolean;
    /** A call is ringing here. */
    ringing: boolean;
    /** The window is on screen: not in the tray, minimised or hidden. */
    windowVisible: boolean;
    /** Time since the last input (the whole desktop's, where known). */
    idleMs: number;
}

/**
 * Whether a downloaded update may be applied now. Applying reloads the page
 * (a web bundle) or restarts the app (an installer), so it waits for a moment
 * the user is not in the middle of anything: never in or near a call, and only
 * when the window is out of sight or the user has been away as long as it
 * takes to be marked away.
 */
export function canApplyUpdateNow(m: ApplyMoment): boolean {
    if (m.inCall || m.ringing) return false;
    return !m.windowVisible || m.idleMs >= AUTO_AWAY_MS;
}
