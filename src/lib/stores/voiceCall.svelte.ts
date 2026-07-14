import {
    joinVoiceCall,
    leaveVoiceCall,
    setMicMuted,
    setVoicePlaybackMuted,
    onVoiceSessionsChanged,
    onVoiceConnStateChanged,
    onActiveSpeakersChanged,
    onVoiceCallError,
    onVoiceNotice,
    onVoicePlaybackBlockedChanged,
    getRoom,
    getRoomCallMemberships,
} from "$lib/matrix/client";
import {
    toggleMute,
    toggleDeafen,
    type MuteState,
    type VoiceConnState,
} from "$lib/utils/voiceCall";
import {
    diffPeerSounds,
    nextSelfSound,
    flagCallError,
    soundGate,
    INITIAL_SELF_SOUND_STATE,
    type SelfSoundState,
    type CallSoundName,
} from "$lib/utils/callSounds";
import { playCallSound, configureCallSounds } from "$lib/audio/soundEffects";
import { settingsState } from "$lib/stores/settings.svelte";
import { auth } from "$lib/stores/auth.svelte";
import { showErrorToast } from "$lib/stores/toasts.svelte";
import { matrixErrorMessage } from "$lib/utils/knock";

// Active-call view state plus a tick for "who is in a call" derivations
// anywhere in the app (room list, banners). Media/SDK wiring stays in
// $lib/matrix/client; this store only mirrors it for the UI.
class VoiceCallState {
    roomId = $state<string | null>(null);
    connState = $state<VoiceConnState>(null);
    micMuted = $state(false);
    deafened = $state(false);
    mutedByDeafen = $state(false);
    speakingMemberIds = $state<string[]>([]);
    voiceTick = $state(0);
    /** Room id of a join in flight (gUM prompt → connected); UI disables
     *  join buttons while set. */
    joinPendingRoomId = $state<string | null>(null);
    /** Autoplay policy blocked remote audio ("Enable audio" in the panel). */
    playbackBlocked = $state(false);
}

export const voiceCallState = new VoiceCallState();

/** Subscribe the store to client voice events. Call once from the app shell. */
export function initVoiceCall(): () => void {
    // The sound engine mirrors persisted settings once per boot (account
    // switches hard-reload, so this is also the per-account init).
    configureCallSounds({
        volume: settingsState.callSoundsVolume,
        enabled: settingsState.callSoundsEnabled,
        sinkId: settingsState.audioOutputDeviceId,
    });

    let selfSound: SelfSoundState = INITIAL_SELF_SOUND_STATE;
    let peerIds: string[] | null = null;
    const lastPlayed = new Map<CallSoundName, number>();
    const playGated = (name: CallSoundName) => {
        const now = Date.now();
        if (!soundGate(lastPlayed.get(name) ?? null, now)) return;
        lastPlayed.set(name, now);
        playCallSound(name);
    };
    const rosterIds = (roomId: string | null): string[] => {
        const room = roomId ? getRoom(roomId) : null;
        return room
            ? getRoomCallMemberships(room).map(
                  (m) => `${m.userId}:${m.deviceId}`,
              )
            : [];
    };

    const unsubSessions = onVoiceSessionsChanged(() => {
        voiceCallState.voiceTick++;
        if (voiceCallState.connState !== "connected" || !voiceCallState.roomId)
            return;
        const ids = rosterIds(voiceCallState.roomId);
        for (const sound of diffPeerSounds(peerIds, ids, auth.userId ?? ""))
            playGated(sound);
        peerIds = ids;
    });
    const unsubConn = onVoiceConnStateChanged((state, roomId) => {
        const { sound, state: nextState } = nextSelfSound(state, selfSound);
        selfSound = nextState;
        if (sound) playCallSound(sound);
        if (state === "connected" && voiceCallState.connState !== "connected") {
            // Baseline the roster silently: peers already in the call when
            // we arrive must not bloop.
            peerIds = rosterIds(roomId);
        }
        voiceCallState.connState = state;
        voiceCallState.roomId = state === null ? null : roomId;
        if (state === null) {
            peerIds = null;
            voiceCallState.micMuted = false;
            voiceCallState.deafened = false;
            voiceCallState.mutedByDeafen = false;
            voiceCallState.speakingMemberIds = [];
            voiceCallState.playbackBlocked = false;
        }
        voiceCallState.voiceTick++;
    });
    const unsubSpeakers = onActiveSpeakersChanged((ids) => {
        voiceCallState.speakingMemberIds = ids;
    });
    const unsubError = onVoiceCallError((msg) => {
        selfSound = flagCallError(selfSound);
        showErrorToast(msg);
    });
    const unsubNotice = onVoiceNotice((msg) => showErrorToast(msg));
    const unsubBlocked = onVoicePlaybackBlockedChanged((blocked) => {
        voiceCallState.playbackBlocked = blocked;
    });
    return () => {
        unsubSessions();
        unsubConn();
        unsubSpeakers();
        unsubError();
        unsubNotice();
        unsubBlocked();
    };
}

export async function joinCall(roomId: string): Promise<void> {
    if (voiceCallState.joinPendingRoomId) return; // a join is already in flight
    voiceCallState.joinPendingRoomId = roomId;
    try {
        await joinVoiceCall(roomId);
    } catch (err) {
        console.error("Failed to join voice call:", err);
        showErrorToast(
            matrixErrorMessage(err, "Could not join the voice call"),
        );
    } finally {
        voiceCallState.joinPendingRoomId = null;
    }
}

export function leaveCall(): void {
    void leaveVoiceCall();
}

function applyMuteState(next: MuteState, prev: MuteState): void {
    voiceCallState.micMuted = next.micMuted;
    voiceCallState.deafened = next.deafened;
    voiceCallState.mutedByDeafen = next.mutedByDeafen;
    setVoicePlaybackMuted(next.deafened);
    void setMicMuted(next.micMuted).then((ok) => {
        if (ok || voiceCallState.roomId === null) return;
        // The device refused — roll the UI back to the truth and say so.
        voiceCallState.micMuted = prev.micMuted;
        voiceCallState.deafened = prev.deafened;
        voiceCallState.mutedByDeafen = prev.mutedByDeafen;
        setVoicePlaybackMuted(prev.deafened);
        showErrorToast(
            next.micMuted
                ? "Could not mute your microphone"
                : "Could not unmute your microphone — check your input device",
        );
    });
}

export function toggleCallMute(): void {
    const prev = currentMuteState();
    const next = toggleMute(prev);
    if (voiceCallState.roomId) playCallSound(next.micMuted ? "mute" : "unmute");
    applyMuteState(next, prev);
}

export function toggleCallDeafen(): void {
    const prev = currentMuteState();
    const next = toggleDeafen(prev);
    if (voiceCallState.roomId)
        playCallSound(next.deafened ? "deafen" : "undeafen");
    applyMuteState(next, prev);
}

function currentMuteState(): MuteState {
    return {
        micMuted: voiceCallState.micMuted,
        deafened: voiceCallState.deafened,
        mutedByDeafen: voiceCallState.mutedByDeafen,
    };
}
