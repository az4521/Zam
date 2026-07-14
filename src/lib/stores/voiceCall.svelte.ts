import {
    joinVoiceCall,
    leaveVoiceCall,
    setMicMuted,
    setVoicePlaybackMuted,
    onVoiceSessionsChanged,
    onVoiceConnStateChanged,
    onActiveSpeakersChanged,
    onVoiceCallError,
} from "$lib/matrix/client";
import {
    toggleMute,
    toggleDeafen,
    type MuteState,
    type VoiceConnState,
} from "$lib/utils/voiceCall";
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
}

export const voiceCallState = new VoiceCallState();

/** Subscribe the store to client voice events. Call once from the app shell. */
export function initVoiceCall(): () => void {
    const unsubSessions = onVoiceSessionsChanged(() => {
        voiceCallState.voiceTick++;
    });
    const unsubConn = onVoiceConnStateChanged((state, roomId) => {
        voiceCallState.connState = state;
        voiceCallState.roomId = state === null ? null : roomId;
        if (state === null) {
            voiceCallState.micMuted = false;
            voiceCallState.deafened = false;
            voiceCallState.mutedByDeafen = false;
            voiceCallState.speakingMemberIds = [];
        }
        voiceCallState.voiceTick++;
    });
    const unsubSpeakers = onActiveSpeakersChanged((ids) => {
        voiceCallState.speakingMemberIds = ids;
    });
    const unsubError = onVoiceCallError((msg) => showErrorToast(msg));
    return () => {
        unsubSessions();
        unsubConn();
        unsubSpeakers();
        unsubError();
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

function applyMuteState(next: MuteState): void {
    voiceCallState.micMuted = next.micMuted;
    voiceCallState.deafened = next.deafened;
    voiceCallState.mutedByDeafen = next.mutedByDeafen;
    setMicMuted(next.micMuted);
    setVoicePlaybackMuted(next.deafened);
}

export function toggleCallMute(): void {
    applyMuteState(toggleMute(currentMuteState()));
}

export function toggleCallDeafen(): void {
    applyMuteState(toggleDeafen(currentMuteState()));
}

function currentMuteState(): MuteState {
    return {
        micMuted: voiceCallState.micMuted,
        deafened: voiceCallState.deafened,
        mutedByDeafen: voiceCallState.mutedByDeafen,
    };
}
