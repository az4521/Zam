import { t } from "$lib/i18n";
import { untrack } from "svelte";
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
    onParticipantMuteChanged,
    setParticipantVolume,
    setParticipantLocalMute,
    setParticipantVideoHidden,
    primeParticipantAudio,
    getRoom,
    getDirectRoomIds,
    getRoomCallMemberships,
    setScreenShareEnabled,
    setCameraEnabled,
    setVideoInputDevice,
    onVideoTracksChanged,
    fetchOwnExtendedProfile,
    selfHasActiveCall,
    setOwnProfileField,
} from "$lib/matrix/client";
import {
    PROFILE_FIELDS,
    buildCall,
    planFieldWrite,
    type ExtendedProfile,
} from "$lib/utils/extendedProfile";
import { setCachedProfile } from "$lib/stores/profileFields.svelte";
import { nextFocus, type VideoTileDescriptor } from "$lib/utils/videoTiles";
import {
    DEFAULT_PARTICIPANT_AUDIO,
    withVolume,
    withLocalMute,
    withVideoHidden,
    type ParticipantAudio,
} from "$lib/utils/participantAudio";
import {
    toggleMute,
    toggleDeafen,
    usersFromIdentities,
    RECENTLY_LEFT_WINDOW_MS,
    type MuteState,
    type VoiceConnState,
    type LastLeftCall,
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
import {
    settingsState,
    setParticipantAudioSetting,
} from "$lib/stores/settings.svelte";
import { auth } from "$lib/stores/auth.svelte";
import { showErrorToast } from "$lib/stores/toasts.svelte";
import { matrixErrorMessage } from "$lib/utils/knock";
import { micErrorMessage } from "$lib/utils/micErrorMessage";
import { isChunkLoadError } from "$lib/utils/chunkLoadError";
import {
    startNativeCall,
    stopNativeCall,
    onNativeCallEvent,
    releaseNativeLockScreen,
    resumeNativeCall,
    setNativeAudioRoute,
    getNativeAudioRoute,
    type NativeAudioRoute,
} from "$lib/nativeCall";

/** LiveKit now arrives in its own chunk, so joining can fail on the chunk
 *  fetch rather than on anything Matrix-shaped. The browser caches a failed
 *  module fetch in its module map and never evicts it, so every later join in
 *  this page fails instantly and identically — retrying is pointless and only
 *  a reload clears it. Say that, instead of toasting the raw
 *  "Failed to fetch dynamically imported module: …/CkYjDUEM.js". */
const CHUNK_LOAD_MESSAGE = t("voiceCall.couldnTLoadTheCallComponent");

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
    /** Remote identities ("@user:server:DEVICE") whose mic is muted. Only
     *  populated for the call we are connected to. */
    mutedIdentities = $state<string[]>([]);
    /** Speaking users, aggregated across all their devices — the roster is
     *  per-user (earliest device) but LiveKit speaking/mute is per user:device,
     *  so a second-device speak/mute must still light the single row. */
    speakingUserIds = $derived(usersFromIdentities(this.speakingMemberIds));
    mutedUserIds = $derived(usersFromIdentities(this.mutedIdentities));
    /** When the current call first connected — held across reconnects so a
     *  blip doesn't reset the timer. Null when not in a call. */
    connectedAt = $state<number | null>(null);
    /** Set when THIS device leaves/tears down a room's call; read by the call
     *  surfaces to suppress the solo-leave "Join" flicker for a short window
     *  (isRecentlyLeftHere). Per-room. Cleared on connect. */
    lastLeftCall = $state<LastLeftCall | null>(null);
    /** Renderable video tiles for the current call (remote + local). */
    videoTiles = $state<VideoTileDescriptor[]>([]);
    /** Whether WE are currently publishing a screen share / camera. Derived
     *  from videoTiles so the browser's native "Stop sharing" bar flips it. */
    screenSharing = $state(false);
    cameraOn = $state(false);
    /** The tile promoted to the spotlight, or null for the plain grid. */
    focusedTileKey = $state<string | null>(null);
    /** Android: the system held the call (a cellular call was answered).
     *  Mic and playback are muted underneath the user's own mute state. */
    onHold = $state(false);
    /** Android: current audio route and the routes on offer, as the system
     *  call stack reports them. Null route = no route control here. */
    audioRoute = $state<NativeAudioRoute | null>(null);
    availableAudioRoutes = $state<NativeAudioRoute[]>([]);
}

export const voiceCallState = new VoiceCallState();

// ── Call presence on the profile (MSC4426 m.call) ──────────────────────────
// Best effort throughout: a server without extended profiles, or one that
// disallows the field, must never get in the way of a call.

/** Profile keys we wrote for the current call, so leaving deletes only those. */
let publishedCallKeys: string[] = [];

async function publishCallStatus(joinedAtMs: number): Promise<void> {
    if (!settingsState.shareCallStatus) return;
    try {
        const profile = await fetchOwnExtendedProfile();
        if (!profile) return;
        const ops = planFieldWrite(
            profile,
            PROFILE_FIELDS.call,
            buildCall(joinedAtMs),
        );
        for (const op of ops) await setOwnProfileField(op.key, op.value);
        publishedCallKeys = ops.map((op) => op.key);
        refreshOwnProfileCache();
    } catch {
        // Not supported, not allowed, or offline: the call carries on.
    }
}

async function clearCallStatus(): Promise<void> {
    const keys = publishedCallKeys;
    publishedCallKeys = [];
    if (keys.length === 0) return;
    await Promise.allSettled(keys.map((key) => setOwnProfileField(key, null)));
    refreshOwnProfileCache();
}

function refreshOwnProfileCache(): void {
    fetchOwnExtendedProfile()
        .then((profile: ExtendedProfile | null) => {
            if (auth.userId) setCachedProfile(auth.userId, profile);
        })
        .catch(() => {});
}

/**
 * A crashed or closed app never got to clear its call field. Once synced, drop
 * one that no device of ours is actually in a call for.
 */
async function clearStaleCallStatus(): Promise<void> {
    try {
        if (voiceCallState.roomId || selfHasActiveCall()) return;
        const profile = await fetchOwnExtendedProfile();
        if (!profile) return;
        const keys = [
            PROFILE_FIELDS.call.stable,
            PROFILE_FIELDS.call.unstable,
        ].filter((key) => profile[key] !== undefined);
        await Promise.allSettled(
            keys.map((key) => setOwnProfileField(key, null)),
        );
        if (keys.length > 0) refreshOwnProfileCache();
    } catch {
        // Best effort.
    }
}

/** Subscribe the store to client voice events. Call once from the app shell. */
export function initVoiceCall(): () => void {
    // The sound engine mirrors persisted settings once per boot (account
    // switches hard-reload, so this is also the per-account init).
    configureCallSounds({
        volume: settingsState.callSoundsVolume,
        enabled: settingsState.callSoundsEnabled,
        sinkId: settingsState.audioOutputDeviceId,
    });
    primeParticipantAudio(settingsState.participantAudio);

    let selfSound: SelfSoundState = INITIAL_SELF_SOUND_STATE;
    let peerIds: string[] | null = null;
    const lastPlayed = new Map<CallSoundName, number>();
    let recentlyLeftTimer: ReturnType<typeof setTimeout> | null = null;
    const clearRecentlyLeftTimer = () => {
        if (recentlyLeftTimer !== null) {
            clearTimeout(recentlyLeftTimer);
            recentlyLeftTimer = null;
        }
    };
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
        const prevRoomId = voiceCallState.roomId;
        const { sound, state: nextState } = nextSelfSound(state, selfSound);
        selfSound = nextState;
        if (sound) playCallSound(sound);
        if (state === "connected" && voiceCallState.connState !== "connected") {
            // Baseline the roster silently: peers already in the call when
            // we arrive must not bloop.
            peerIds = rosterIds(roomId);
            // Only the FIRST connect anchors the clock: a reconnect arrives
            // here as reconnecting → connected without passing through null.
            if (voiceCallState.connectedAt === null) {
                voiceCallState.connectedAt = Date.now();
                void publishCallStatus(voiceCallState.connectedAt);
            }
            voiceCallState.lastLeftCall = null;
            clearRecentlyLeftTimer();
            // The system may have reported the route before we were
            // listening for it; later changes arrive as events.
            void getNativeAudioRoute().then((info) => {
                if (info?.route && voiceCallState.roomId) {
                    voiceCallState.audioRoute = info.route;
                    voiceCallState.availableAudioRoutes = info.available;
                }
            });
        }
        // Android: run the call as a phone call — a foreground service so it
        // survives backgrounding / screen-off, registered with the system
        // call stack. Re-sent on every state change (idempotent natively) so
        // a mic permission granted mid-join reaches the service on connect.
        if (state !== null && roomId && state !== voiceCallState.connState)
            startNativeCall(
                roomId,
                getRoom(roomId)?.name ?? "",
                getDirectRoomIds().has(roomId),
            );
        voiceCallState.connState = state;
        voiceCallState.roomId = state === null ? null : roomId;
        if (state === null) {
            stopNativeCall();
            voiceCallState.onHold = false;
            voiceCallState.audioRoute = null;
            voiceCallState.availableAudioRoutes = [];
            peerIds = null;
            voiceCallState.micMuted = false;
            voiceCallState.deafened = false;
            voiceCallState.mutedByDeafen = false;
            voiceCallState.speakingMemberIds = [];
            voiceCallState.mutedIdentities = [];
            voiceCallState.connectedAt = null;
            voiceCallState.playbackBlocked = false;
            voiceCallState.videoTiles = [];
            voiceCallState.screenSharing = false;
            voiceCallState.cameraOn = false;
            voiceCallState.focusedTileKey = null;
            void clearCallStatus();
            if (prevRoomId) {
                clearRecentlyLeftTimer();
                voiceCallState.lastLeftCall = {
                    roomId: prevRoomId,
                    ts: Date.now(),
                };
                // Date.now() in the call-surface $deriveds is not reactive, so a
                // persistent self-only roster would otherwise stay frozen at
                // recentlyLeftHere=true past the window with no tick to recompute it.
                // One deterministic tick bump at window expiry restores "Join".
                recentlyLeftTimer = setTimeout(() => {
                    recentlyLeftTimer = null;
                    untrack(() => {
                        voiceCallState.voiceTick++;
                    });
                }, RECENTLY_LEFT_WINDOW_MS);
            }
        }
        voiceCallState.voiceTick++;
    });
    const unsubSpeakers = onActiveSpeakersChanged((ids) => {
        voiceCallState.speakingMemberIds = ids;
    });
    const unsubMutes = onParticipantMuteChanged((ids) => {
        voiceCallState.mutedIdentities = ids;
    });
    const unsubError = onVoiceCallError((msg) => {
        selfSound = flagCallError(selfSound);
        showErrorToast(msg);
    });
    const unsubNotice = onVoiceNotice((msg) => showErrorToast(msg));
    // Android system call stack: hang-up / hold / mute from the notification,
    // a headset, the car, or a cellular call taking over.
    const unsubNative = [
        onNativeCallEvent("hangUp", () => leaveCall()),
        onNativeCallEvent("hold", ({ held }) => applySystemHold(held)),
        onNativeCallEvent("systemMute", ({ muted }) => {
            if (voiceCallState.roomId && muted !== voiceCallState.micMuted)
                toggleCallMute();
        }),
        onNativeCallEvent("audioRoute", ({ route, available }) => {
            voiceCallState.audioRoute = route ?? null;
            voiceCallState.availableAudioRoutes = available ?? [];
        }),
    ];
    const unsubBlocked = onVoicePlaybackBlockedChanged((blocked) => {
        voiceCallState.playbackBlocked = blocked;
    });
    let prevVideoKeys: string[] = [];
    const unsubVideo = onVideoTracksChanged((tiles) => {
        voiceCallState.videoTiles = tiles;
        voiceCallState.screenSharing = tiles.some(
            (t) => t.isLocal && t.source === "screenshare",
        );
        voiceCallState.cameraOn = tiles.some(
            (t) => t.isLocal && t.source === "camera",
        );
        voiceCallState.focusedTileKey = nextFocus(
            prevVideoKeys,
            tiles,
            voiceCallState.focusedTileKey,
        );
        prevVideoKeys = tiles.map((t) => t.key);
        voiceCallState.voiceTick++;
    });
    // Once the first sync lands, sweep a call field left behind by a crash.
    let swept = false;
    const stopSweep = $effect.root(() => {
        $effect(() => {
            const synced =
                auth.syncState === "SYNCING" || auth.syncState === "PREPARED";
            if (!synced || swept) return;
            swept = true;
            untrack(() => void clearStaleCallStatus());
        });
    });
    return () => {
        stopSweep();
        clearRecentlyLeftTimer();
        unsubSessions();
        unsubConn();
        unsubSpeakers();
        unsubMutes();
        unsubError();
        unsubNotice();
        for (const unsub of unsubNative) unsub();
        unsubBlocked();
        unsubVideo();
    };
}

export async function joinCall(roomId: string): Promise<void> {
    if (voiceCallState.joinPendingRoomId) return; // a join is already in flight
    voiceCallState.joinPendingRoomId = roomId;
    try {
        await joinVoiceCall(roomId);
    } catch (err) {
        console.error("Failed to join voice call:", err);
        // An Accept from the lock screen that never became a call must not
        // leave the app showing over it.
        releaseNativeLockScreen();
        showErrorToast(
            isChunkLoadError(err)
                ? CHUNK_LOAD_MESSAGE
                : (micErrorMessage(err) ??
                      matrixErrorMessage(
                          err,
                          t("voiceCall.couldNotJoinTheVoiceCall"),
                      )),
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
    // A system hold keeps both muted underneath, whatever the user toggles.
    const held = voiceCallState.onHold;
    setVoicePlaybackMuted(next.deafened || held);
    void setMicMuted(next.micMuted || held).then((ok) => {
        if (ok || voiceCallState.roomId === null) return;
        // The device refused — roll the UI back to the truth and say so.
        voiceCallState.micMuted = prev.micMuted;
        voiceCallState.deafened = prev.deafened;
        voiceCallState.mutedByDeafen = prev.mutedByDeafen;
        setVoicePlaybackMuted(prev.deafened);
        showErrorToast(
            next.micMuted
                ? t("voiceCall.couldNotMuteYourMicrophone")
                : t("voiceCall.couldNotUnmuteYourMicrophoneCheck"),
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

export function participantAudioFor(userId: string): ParticipantAudio {
    return (
        settingsState.participantAudio.get(userId) ?? DEFAULT_PARTICIPANT_AUDIO
    );
}

/** Set a user's local volume: persist it and apply it to any live elements.
 *  Settable for a call we haven't joined — it applies when they subscribe. */
export function setUserVolume(userId: string, volume: number): void {
    const next = withVolume(participantAudioFor(userId), volume);
    setParticipantAudioSetting(userId, next);
    setParticipantVolume(userId, next.volume);
}

export function setUserLocalMute(userId: string, muted: boolean): void {
    const next = withLocalMute(participantAudioFor(userId), muted);
    setParticipantAudioSetting(userId, next);
    setParticipantLocalMute(userId, next.muted);
}

export function setUserVideoHidden(userId: string, hidden: boolean): void {
    const next = withVideoHidden(participantAudioFor(userId), hidden);
    setParticipantAudioSetting(userId, next);
    setParticipantVideoHidden(userId, next.videoHidden);
}

export async function toggleScreenShare(): Promise<void> {
    await setScreenShareEnabled(!voiceCallState.screenSharing);
}

export async function toggleCamera(): Promise<void> {
    const turningOn = !voiceCallState.cameraOn;
    await setCameraEnabled(turningOn);
    // A video call is not held to the ear: move it off the earpiece.
    if (turningOn && voiceCallState.audioRoute === "earpiece")
        setNativeAudioRoute("speaker");
}

/** Mute both ways while the system holds the call, then restore whatever the
 *  user's own mute / deafen state is. Their state is never touched. */
function applySystemHold(held: boolean): void {
    if (!voiceCallState.roomId) return;
    voiceCallState.onHold = held;
    setVoicePlaybackMuted(held || voiceCallState.deafened);
    void setMicMuted(held || voiceCallState.micMuted);
}

/** Take the call off a system hold (the other call is over). */
export function resumeHeldCall(): void {
    resumeNativeCall();
    applySystemHold(false);
}

/** Android: speaker on, or back to the private route (headset if one is
 *  connected, else the earpiece). */
export function toggleSpeaker(): void {
    const available = voiceCallState.availableAudioRoutes;
    if (voiceCallState.audioRoute !== "speaker") {
        setNativeAudioRoute("speaker");
        return;
    }
    const next = (["bluetooth", "wired", "earpiece"] as const).find((r) =>
        available.includes(r),
    );
    if (next) setNativeAudioRoute(next);
}

/** Promote a tile to the spotlight; clicking the focused tile again clears it. */
export function focusTile(key: string): void {
    voiceCallState.focusedTileKey =
        voiceCallState.focusedTileKey === key ? null : key;
}

export function clearFocus(): void {
    voiceCallState.focusedTileKey = null;
}

export function setCallVideoInputDevice(deviceId: string | null): void {
    void setVideoInputDevice(deviceId);
}
