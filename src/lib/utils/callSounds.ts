/**
 * Pure decisions for call-sound feedback: which UI transition plays which
 * sound. The WebAudio engine lives in $lib/audio/soundEffects; wiring lives
 * in the voiceCall store.
 */

import type { VoiceConnState } from "./voiceCall";

export type CallSoundName =
    | "selfJoin"
    | "selfLeave"
    | "peerJoin"
    | "peerLeave"
    | "mute"
    | "unmute"
    | "deafen"
    | "undeafen"
    | "error";

export interface SelfSoundState {
    connectedOnce: boolean;
    errorFlagged: boolean;
}

export const INITIAL_SELF_SOUND_STATE: SelfSoundState = {
    connectedOnce: false,
    errorFlagged: false,
};

/** Mark the active call as failing — its teardown plays "error", not "selfLeave". */
export function flagCallError(s: SelfSoundState): SelfSoundState {
    return { ...s, errorFlagged: true };
}

/**
 * Reducer over conn-state transitions. selfJoin only on the FIRST connect of
 * a call (reconnects are silent); teardown picks error > selfLeave > silence
 * (a join that never connected makes no sound).
 */
export function nextSelfSound(
    next: VoiceConnState,
    s: SelfSoundState,
): { sound: CallSoundName | null; state: SelfSoundState } {
    if (next === "connected" && !s.connectedOnce)
        return { sound: "selfJoin", state: { ...s, connectedOnce: true } };
    if (next === null) {
        const sound: CallSoundName | null = s.errorFlagged
            ? "error"
            : s.connectedOnce
              ? "selfLeave"
              : null;
        return { sound, state: INITIAL_SELF_SOUND_STATE };
    }
    return { sound: null, state: s };
}

/**
 * Peer sounds from membership diffs ("userId:deviceId" ids). prev === null is
 * the initial roster snapshot and stays silent; many changes in one diff
 * coalesce to at most one peerJoin + one peerLeave.
 */
export function diffPeerSounds(
    prev: string[] | null,
    next: string[],
    ownUserId: string,
): CallSoundName[] {
    if (prev === null) return [];
    const isOwn = (id: string) => id.startsWith(ownUserId + ":");
    const prevSet = new Set(prev.filter((id) => !isOwn(id)));
    const nextSet = new Set(next.filter((id) => !isOwn(id)));
    const sounds: CallSoundName[] = [];
    if ([...nextSet].some((id) => !prevSet.has(id))) sounds.push("peerJoin");
    if ([...prevSet].some((id) => !nextSet.has(id))) sounds.push("peerLeave");
    return sounds;
}

/** Cross-tick rate limiter: at most one play of a given sound per minGapMs. */
export function soundGate(
    lastPlayedMs: number | null,
    nowMs: number,
    minGapMs = 1000,
): boolean {
    return lastPlayedMs === null || nowMs - lastPlayedMs >= minGapMs;
}
