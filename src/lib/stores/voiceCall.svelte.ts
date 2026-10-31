import { t } from "$lib/i18n";
import { untrack } from "svelte";
import { bindingFor } from "$lib/stores/keybinds.svelte";
import {
    joinVoiceCall,
    leaveVoiceCall,
    setMicMuted,
    setMicClosedAtJoin,
    setVoicePlaybackMuted,
    onVoiceSessionsChanged,
    onVoiceConnStateChanged,
    onActiveSpeakersChanged,
    onVoiceCallError,
    onVoiceNotice,
    onVoicePlaybackBlockedChanged,
    onParticipantMuteChanged,
    setParticipantVolume,
    setParticipantShareVolume,
    setParticipantSoundVolume,
    setParticipantLocalMute,
    setParticipantVideoHidden,
    primeParticipantAudio,
    getRoom,
    getMemberName,
    getDirectRoomIds,
    getRoomCallMemberships,
    setScreenShareEnabled,
    setCameraEnabled,
    setVideoInputDevice,
    onVideoTracksChanged,
    onCallCodecsChanged,
    onCallEncryptionChanged,
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
import {
    nextFocus,
    newRemoteShares,
    type VideoTileDescriptor,
} from "$lib/utils/videoTiles";
import type { CallCodecState, CallEncryptionState } from "$lib/matrix/client";
import {
    DEFAULT_PARTICIPANT_AUDIO,
    withVolume,
    withShareVolume,
    withSoundVolume,
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
import { showErrorToast, showToast } from "$lib/stores/toasts.svelte";
import { interfaceState, showCallView } from "$lib/stores/interface.svelte";
import { navigateToRoom, roomsState } from "$lib/stores/rooms.svelte";
import { callPipState } from "$lib/stores/callPip.svelte";
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
import { prefetchDenoiser } from "$lib/audio/prepareDenoiser";

/** Leaves startup (sync, crypto, room list) the bandwidth first. */
const MODEL_PREFETCH_DELAY_MS = 15_000;

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
    /** Which video codecs we can send in this call, which everyone can
     *  watch, and the one in use. Null outside a call. */
    codecs = $state<CallCodecState | null>(null);
    /** Whether the call is end-to-end encrypted, and who isn't. Null
     *  outside a call. */
    encryption = $state<CallEncryptionState | null>(null);
    /** Whether WE are currently publishing a screen share / camera. Derived
     *  from videoTiles so the browser's native "Stop sharing" bar flips it. */
    screenSharing = $state(false);
    cameraOn = $state(false);
    /** The tile promoted to the spotlight, or null for the plain grid. */
    focusedTileKey = $state<string | null>(null);
    /** Android: the system held the call (a cellular call was answered).
     *  Mic and playback are muted underneath the user's own mute state. */
    onHold = $state(false);
    /** Push to talk is held / push to mute is held (Settings > Keybinds).
     *  Like a system hold, they close the mic underneath the user's own
     *  mute state without changing it. */
    pushToTalkHeld = $state(false);
    pushToMuteHeld = $state(false);
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
    // A call joined in push to talk starts with the mic closed.
    setMicClosedAtJoin(() => micGated());
    // The sound engine mirrors persisted settings once per boot (account
    // switches hard-reload, so this is also the per-account init).
    configureCallSounds({
        volume: settingsState.callSoundsVolume,
        enabled: settingsState.callSoundsEnabled,
        sinkId: settingsState.audioOutputDeviceId,
    });
    primeParticipantAudio(settingsState.participantAudio);
    // Get the noise filter's files onto the device ahead of the first call,
    // once startup has settled (DeepFilterNet3's on web/PWA only: the apps
    // ship it; a plugin filter's wherever it runs).
    const prefetchTimer = setTimeout(() => {
        const mode = settingsState.noiseSuppressionMode;
        // A plugin filter's files, or DeepFilterNet3's (also where the
        // plugin filter can't run here).
        if (mode !== "browser" && mode !== "off") void prefetchDenoiser(mode);
    }, MODEL_PREFETCH_DELAY_MS);

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
        // Desktop: run the call's processes above normal priority.
        if (state === "connected") window.desktop?.call?.setActive(true);
        else if (state === null) window.desktop?.call?.setActive(false);
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
            callPipState.dismissed = false;
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
    const unsubCodecs = onCallCodecsChanged((codecs) => {
        voiceCallState.codecs = codecs;
    });
    const unsubEncryption = onCallEncryptionChanged((encryption) => {
        voiceCallState.encryption = encryption;
    });
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
        const newShares = newRemoteShares(prevVideoKeys, tiles);
        announceNewShares(newShares);
        if (newShares.length > 0) callPipState.dismissed = false;
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
        clearTimeout(prefetchTimer);
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
        unsubCodecs();
        unsubEncryption();
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

/** Push to talk is on when the setting is on and it has a key: then the mic
 *  only opens while that key is held. */
export function pushToTalkEnabled(): boolean {
    return settingsState.pushToTalk && bindingFor("pushToTalk") !== null;
}

/** The mic is closed for a reason other than the user's own mute. */
function micGated(): boolean {
    return (
        voiceCallState.onHold ||
        voiceCallState.pushToMuteHeld ||
        (pushToTalkEnabled() && !voiceCallState.pushToTalkHeld)
    );
}

function applyMicGate(): void {
    if (!voiceCallState.roomId) return;
    void setMicMuted(voiceCallState.micMuted || micGated());
}

export function setPushToTalkHeld(held: boolean): void {
    if (voiceCallState.pushToTalkHeld === held) return;
    voiceCallState.pushToTalkHeld = held;
    if (voiceCallState.roomId && pushToTalkEnabled())
        playCallSound(held ? "pttOn" : "pttOff");
    applyMicGate();
}

export function setPushToMuteHeld(held: boolean): void {
    if (voiceCallState.pushToMuteHeld === held) return;
    voiceCallState.pushToMuteHeld = held;
    applyMicGate();
}

/** Re-apply the gate after push to talk was bound or unbound. */
export function refreshMicGate(): void {
    applyMicGate();
}

function applyMuteState(next: MuteState, prev: MuteState): void {
    voiceCallState.micMuted = next.micMuted;
    voiceCallState.deafened = next.deafened;
    voiceCallState.mutedByDeafen = next.mutedByDeafen;
    // A system hold keeps both muted underneath, whatever the user toggles.
    setVoicePlaybackMuted(next.deafened || voiceCallState.onHold);
    void setMicMuted(next.micMuted || micGated()).then((ok) => {
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

/** The same for the sound of the screen or application they share. */
export function setUserShareVolume(userId: string, volume: number): void {
    const next = withShareVolume(participantAudioFor(userId), volume);
    setParticipantAudioSetting(userId, next);
    setParticipantShareVolume(userId, next.shareVolume);
}

/** The same for their soundboard clips. */
export function setUserSoundVolume(userId: string, volume: number): void {
    const next = withSoundVolume(participantAudioFor(userId), volume);
    setParticipantAudioSetting(userId, next);
    setParticipantSoundVolume(userId, next.soundVolume);
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
    void setMicMuted(voiceCallState.micMuted || micGated());
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

/** Whether the call this device is in fills the main pane right now. Reactive
 *  when read from a $derived. */
export function isCallViewShowing(): boolean {
    const roomId = voiceCallState.roomId;
    return (
        !!roomId &&
        interfaceState.callViewRoomId === roomId &&
        roomsState.activeRoomId === roomId &&
        !roomsState.showInbox &&
        !roomsState.draftDm
    );
}

/** Promote a tile to the spotlight; clicking the focused tile again clears it. */
/**
 * Someone started sharing their screen while this device isn't showing the
 * call: say so, with a button that opens the call on their share. A share
 * only shows in the call view, so without this it went unnoticed.
 */
function announceNewShares(shares: VideoTileDescriptor[]): void {
    const roomId = voiceCallState.roomId;
    if (!roomId || shares.length === 0) return;
    if (isCallViewShowing()) return;
    const share = shares[0];
    const room = getRoom(roomId);
    const name = (room && getMemberName(room, share.userId)) || share.userId;
    showToast(t("voiceCall.startedSharing", { name }), {
        tone: "accent",
        action: {
            label: t("voiceCall.watch"),
            run: () => {
                navigateToRoom(roomId);
                showCallView(roomId);
                voiceCallState.focusedTileKey = share.key;
            },
        },
    });
}

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
