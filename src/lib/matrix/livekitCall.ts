/**
 * The LiveKit side of MatrixRTC voice/video calls: joining and leaving, the
 * SFU connections, local mic/camera/screen-share tracks, remote audio
 * playback and per-participant volume, device switching, and the subscriber
 * hooks the call UI binds to.
 *
 * Split out of `client.ts`, which keeps the MatrixRTC membership side (who is
 * in which call, call summaries) and re-exports this module's API. Reads the
 * client through the runtime slot, like `media.ts`.
 */
import { t } from "$lib/i18n";
import type { MatrixClient, Room } from "matrix-js-sdk";
import type * as LivekitClient from "livekit-client";
import { matrixClient } from "./runtime";
import { getDirectRoomIds, getRoomCallMemberships } from "./client";
import {
    callEndedMembershipMessage,
    pickLivekitTransport,
    pickOwnLivekitTransport,
    remoteLivekitTargets,
    livekitTargetKey,
    type LivekitTarget,
    sfuJwtUrl,
    screenShareCaptureResolution,
} from "$lib/utils/voiceCall";
import {
    screenShareEncodingFor,
    applyScreenShareEncoding,
} from "$lib/utils/screenShareEncoding";
import {
    buildVideoTiles,
    type VideoPublicationInput,
    type VideoTileDescriptor,
    type VideoSource,
} from "$lib/utils/videoTiles";
import {
    voiceDeviceNotices,
    type VoiceInputKind,
} from "$lib/utils/voiceDeviceWatch";
import {
    effectiveVolume,
    needsBoost,
    withVolume,
    withLocalMute,
    withVideoHidden,
    DEFAULT_PARTICIPANT_AUDIO,
    type ParticipantAudio,
} from "$lib/utils/participantAudio";
import {
    settingsState,
    setAudioInputDeviceId,
    setVideoInputDeviceId,
    setCallVideoCodec,
} from "$lib/stores/settings.svelte";
import { lazyModule } from "$lib/utils/lazyModule";
import {
    availableOutgoingBitrate,
    type RawStat,
    type StreamOwner,
    type VideoTrackDebug,
} from "$lib/utils/callStats";
import { clampBitrate } from "$lib/utils/screenShareBitrate";
import {
    codecsFromMimeTypes,
    planCodecs,
    DECODE_ATTRIBUTE,
    encodeDecodeAttribute,
    parseDecodeAttribute,
    type VideoCodec,
} from "$lib/utils/videoCodecs";
import {
    clearLiveUploadEstimate,
    noteUploadEstimate,
    screenShareBitrateCeiling,
} from "$lib/stores/uploadEstimate.svelte";
import {
    createCallAudioGraph,
    type CallAudioGraph,
} from "$lib/audio/callAudioGraph";
import {
    createMicProcessor,
    PASSTHROUGH_CHAIN,
    type MicProcessor,
} from "$lib/audio/micProcessor";
import { deepFilterSupported } from "$lib/audio/deepFilter";
import { prepareDenoiser } from "$lib/audio/prepareDenoiser";
import type { MicGainMode } from "$lib/utils/micGainMode";
import type { NoiseSuppressionMode } from "$lib/utils/noiseSuppressionMode";
import {
    planMicProcessing,
    type MicProcessingPlan,
    type MicTuning,
} from "$lib/utils/micProcessing";
import { matrixErrorMessage } from "$lib/utils/knock";
import { shouldRingPeers } from "$lib/utils/callNotify";
import {
    pickerOffersShareAudio,
    takeShareAudio,
    cancelShareAudioWait,
    releaseShareAudio,
    stopShareAudioCapture,
} from "$lib/desktopScreenShare";
import {
    openShareAudioTrack,
    type ShareAudioTrack,
} from "$lib/audio/shareAudioTrack";

type LivekitModule = typeof import("livekit-client");
type LivekitRoom = LivekitClient.Room;
type RemoteTrack = LivekitClient.RemoteTrack;
type RemoteTrackPublication = LivekitClient.RemoteTrackPublication;
type RemoteParticipant = LivekitClient.RemoteParticipant;
type LocalParticipant = LivekitClient.LocalParticipant;
type TrackPublication = LivekitClient.TrackPublication;
type Track = LivekitClient.Track;

/** livekit-client is ~half a megabyte of WebRTC that a text-only session
 *  never touches. It is fetched when a call starts; every value use in
 *  this file is inside the call region, and the loaded namespace is
 *  carried on ActiveVoiceCall so those uses cannot outrun the fetch. */
const livekit = lazyModule<LivekitModule>(() => import("livekit-client"));

interface ActiveVoiceCall {
    roomId: string;
    session: ReturnType<MatrixClient["matrixRTC"]["getRoomSession"]>;
    /** Where we publish: our own homeserver's SFU (multi-SFU), or the
     *  shared one when our homeserver advertises none. */
    lkRoom: LivekitRoom;
    publishKey: string;
    /** Multi-SFU: listen-only connections to the SFUs other members publish
     *  on, keyed by livekitTargetKey. lk-jwt-service only lets a homeserver's
     *  own users publish on its SFU, so everyone publishes at home and
     *  listens everywhere else. */
    remotes: Map<string, LivekitRoom>;
    /** Keys with a connect in flight, so a burst of membership changes
     *  doesn't open the same SFU twice. */
    remotesConnecting: Set<string>;
    /** SFUs we already told the user we couldn't reach (once per call). */
    remoteFailuresNotified: Set<string>;
    /** Active speakers per connection; the UI gets their union. */
    speakersByRoom: Map<LivekitRoom, string[]>;
    onMembershipsChanged: () => void;
    /** The loaded livekit-client namespace. Held here rather than read from
     *  a module global so the synchronous helpers below cannot reach for a
     *  Track enum before the chunk exists — an ActiveVoiceCall can only be
     *  constructed after the await. */
    lk: LivekitModule;
    audioEls: Set<HTMLAudioElement>;
    /** identity ("@user:server:DEVICE") → that publication's elements, so a
     *  per-user volume can be applied without disturbing anyone else. */
    elsByIdentity: Map<string, Set<HTMLAudioElement>>;
    /** Each subscribed audio track's element. Not `track.detach()`: LiveKit
     *  detaches before it emits TrackUnsubscribed, so that returns nothing
     *  there. */
    elByTrack: Map<RemoteTrack, HTMLAudioElement>;
    /** Web Audio path for boosted (>100%) and normalized users, built on
     *  first need. `false` once building failed: stay on plain elements. */
    audioGraph: CallAudioGraph | null | false;
    onMmError: (err: unknown) => void;
    onMyMembership: (room: Room, membership: string) => void;
    /** What this device can send and decode (localVideoCodecs). */
    codecs: LocalVideoCodecs;
    /** End-to-end encryption, when the room is encrypted (setupCallE2EE). */
    e2ee: CallE2EE | null;
    /** identity -> media from them that failed to decrypt (debug panel). */
    decryptErrors: Map<string, number>;
}

/** The SFU URL each connection was opened to (debug panel). */
const sfuUrlOf = new WeakMap<LivekitRoom, string>();

let activeVoice: ActiveVoiceCall | null = null;

/** Every LiveKit connection of a call: the publishing one first. */
function callLkRooms(call: ActiveVoiceCall): LivekitRoom[] {
    return [call.lkRoom, ...call.remotes.values()];
}
// Monotonic token for joinVoiceCall: a newer join bumps it, and any older
// in-flight invocation bails out at its next staleness check instead of
// reconnecting a room it no longer owns.
let voiceJoinSeq = 0;
// Serialize screen-share quality changes so concurrent setScreenShareQuality
// calls don't interleave their getParameters/setParameters on the sender
// (WebRTC requires each setParameters to be preceded by a fresh getParameters
// with nothing else calling setParameters in between).
let screenShareQualityChain: Promise<void> = Promise.resolve();
/** The desktop app's per-application share audio, published beside the
 *  screen share (LiveKit only publishes audio getDisplayMedia returns). */
let shareAudio: {
    call: ActiveVoiceCall;
    track: LivekitClient.LocalAudioTrack;
    handle: ShareAudioTrack;
} | null = null;
let voicePlaybackMuted = false;
// The mic state the user last asked for; consulted after connect so a mute
// toggled during the connect window isn't clobbered.
let desiredMicMuted = false;
/** Whether a new call should start with the mic closed (push to talk not
 *  held); registered by the voice call store. */
let micClosedAtJoin: () => boolean = () => false;
export function setMicClosedAtJoin(fn: () => boolean): void {
    micClosedAtJoin = fn;
}
// Whether the user currently wants the camera on. Intent, not LiveKit state:
// turning the camera off only MUTES the publication, so "is a camera track
// published" cannot answer this — see ensureVoiceDeviceWatch.
let desiredCameraOn = false;

// Output routing/volume for every tracked <audio> element. Captured from
// settings at join (account switches reload the page and re-read).
let voiceOutputDeviceId: string | null = null;
let voiceOutputVolume = 1;
// Incoming-voice normalization; captured at join like the above.
let voiceNormalize = false;

// Per-user local audio (slider + local mute), keyed by userId — one entry per
// human, applied to every device they are joined from. Primed from persisted
// settings at init and kept here so a track that subscribes later (a late
// joiner, or a reconnect re-subscribing everything) gets the right level.
let participantAudio = new Map<string, ParticipantAudio>();

/** "@user:server:DEVICE" → "@user:server". Device ids never contain ":". */
function userIdFromIdentity(identity: string): string {
    return identity.slice(0, identity.lastIndexOf(":"));
}

function ensureAudioGraph(call: ActiveVoiceCall): CallAudioGraph | null {
    if (call.audioGraph === null) {
        call.audioGraph =
            createCallAudioGraph({
                sinkId: voiceOutputDeviceId,
                muted: voicePlaybackMuted,
                normalize: voiceNormalize,
                onSuspendedChange: () => refreshPlaybackBlocked(call),
            }) ?? false;
    }
    return call.audioGraph || null;
}

/** Apply a user's level to one of their elements. Up to 100% (and without
 *  normalization) the element's own volume does it; past that the element
 *  is routed through the Web Audio graph and muted, and stays routed for
 *  its lifetime so dragging across 100% doesn't hop paths. Where Web Audio
 *  is unavailable the level is capped at 100%. */
function applyElementVolume(el: HTMLAudioElement, identity: string): void {
    const call = activeVoice;
    const gain = effectiveVolume(
        voiceOutputVolume,
        participantAudio.get(userIdFromIdentity(identity)),
    );
    let graph = call?.audioGraph || null;
    if (call && !graph?.has(el) && (voiceNormalize || needsBoost(gain))) {
        graph = ensureAudioGraph(call);
        if (graph?.route(el, userIdFromIdentity(identity)))
            refreshPlaybackBlocked(call);
    }
    if (graph?.has(el)) {
        graph.setGain(el, gain);
        el.muted = true;
    } else {
        el.volume = Math.min(1, gain);
        el.muted = voicePlaybackMuted;
    }
}

function applyVolumeForUser(userId: string): void {
    if (!activeVoice) return;
    for (const [identity, els] of activeVoice.elsByIdentity) {
        if (userIdFromIdentity(identity) !== userId) continue;
        for (const el of els) applyElementVolume(el, identity);
    }
}

/** Seed persisted per-user levels before any call starts. */
export function primeParticipantAudio(
    map: Map<string, ParticipantAudio>,
): void {
    participantAudio = new Map(map);
}

export function setParticipantVolume(userId: string, volume: number): void {
    const current = participantAudio.get(userId) ?? DEFAULT_PARTICIPANT_AUDIO;
    participantAudio.set(userId, withVolume(current, volume));
    applyVolumeForUser(userId);
}

export function setParticipantLocalMute(userId: string, muted: boolean): void {
    const current = participantAudio.get(userId) ?? DEFAULT_PARTICIPANT_AUDIO;
    participantAudio.set(userId, withLocalMute(current, muted));
    applyVolumeForUser(userId);
}

export function setParticipantVideoHidden(
    userId: string,
    hidden: boolean,
): void {
    const current = participantAudio.get(userId) ?? DEFAULT_PARTICIPANT_AUDIO;
    participantAudio.set(userId, withVideoHidden(current, hidden));
    applyVideoHiddenForUser(userId, hidden);
}

function applyVideoHiddenForUser(userId: string, hidden: boolean): void {
    if (!activeVoice) return;
    const lk = activeVoice.lk;
    for (const lkRoom of callLkRooms(activeVoice))
        for (const p of lkRoom.remoteParticipants.values()) {
            if (userIdFromIdentity(p.identity) !== userId) continue;
            for (const pub of p.videoTrackPublications.values()) {
                if (pub.source === lk.Track.Source.Camera)
                    pub.setEnabled(!hidden);
            }
        }
}

function applyVoiceSink(el: HTMLAudioElement): void {
    const sinkEl = el as HTMLAudioElement & {
        setSinkId?: (id: string) => Promise<void>;
    };
    // "" selects the default sink; missing setSinkId (Android) → OS routes.
    void sinkEl.setSinkId?.(voiceOutputDeviceId ?? "").catch(() => {});
}

// Mid-call input unplug: on a track ending (livekit-client 2.20.1
// `handleTrackEnded`) LiveKit restarts the mic against `deviceId: "default"`,
// but restarts the camera against its existing NON-exact constraints — so the
// camera either lands on some other camera or fails and mutes. Hence the mic
// notice can promise a fallback and the camera notice cannot.
// One notice per kind per call.
// The devicechange listener is installed once and lives for the page: it bails
// when no call is active, so there is nothing to tear down.
let voiceDeviceWatchStarted = false;
let audioInputGoneNotified: ActiveVoiceCall | null = null;
let videoInputGoneNotified: ActiveVoiceCall | null = null;

const VOICE_DEVICE_NOTICE: Record<VoiceInputKind, string> = {
    audioinput: t("client.microphoneDisconnectedSwitchedToTheDefault"),
    videoinput: t("client.cameraDisconnected"),
};

/** The camera's REAL capture device, read off the live publication rather than
 *  `settingsState.videoInputDeviceId`: `setCameraEnabled` passes that id as a
 *  non-exact constraint, so the browser may have substituted another camera
 *  and warning about the saved one would be a phantom.
 *
 *  Deliberately NOT `isCameraEnabled`: that is `!isMuted`, and the unplug we
 *  are trying to report is exactly what makes LiveKit mute the track. The
 *  publication and its stopped MediaStreamTrack outlive that mute, which is
 *  what keeps the id readable — but it also means a non-null answer does NOT
 *  mean the camera is on, so callers gate on `desiredCameraOn` first.
 *
 *  Null when nothing was ever published, or if an engine ever stops reporting
 *  `deviceId` for a stopped track — both fail quiet (no notice). */
function activeCameraDeviceId(call: ActiveVoiceCall): string | null {
    const track = call.lkRoom.localParticipant.getTrackPublication(
        call.lk.Track.Source.Camera,
    )?.videoTrack?.mediaStreamTrack;
    return track?.getSettings().deviceId ?? null;
}

function ensureVoiceDeviceWatch(): void {
    if (voiceDeviceWatchStarted || !navigator.mediaDevices?.addEventListener)
        return;
    const onChange = async () => {
        const call = activeVoice;
        if (!call) return;
        // Snapshot before the await: LiveKit reacts to the same unplug, and
        // with a second camera present its restart succeeds onto that one —
        // reading afterwards would find a present device and stay silent.
        const cameraId = desiredCameraOn ? activeCameraDeviceId(call) : null;
        // null (not []) on failure: an empty list means "nothing is plugged
        // in", a rejection means "we do not know" — see voiceDeviceNotices.
        const devices = await navigator.mediaDevices
            .enumerateDevices()
            .catch(() => null);
        if (activeVoice !== call) return;
        const notices = voiceDeviceNotices({
            devices,
            audioInputId: settingsState.audioInputDeviceId,
            videoInputId: cameraId,
            audioNotified: audioInputGoneNotified === call,
            videoNotified: videoInputGoneNotified === call,
        });
        for (const kind of notices) {
            if (kind === "audioinput") audioInputGoneNotified = call;
            else videoInputGoneNotified = call;
            notifyVoiceNotice(VOICE_DEVICE_NOTICE[kind]);
        }
    };
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    voiceDeviceWatchStarted = true;
}

type VoiceConnStateCb = (
    state: "connecting" | "connected" | "reconnecting" | null,
    roomId: string | null,
) => void;
const voiceConnStateSubscribers = new Set<VoiceConnStateCb>();
const activeSpeakerSubscribers = new Set<(memberIds: string[]) => void>();
const participantMuteSubscribers = new Set<
    (mutedIdentities: string[]) => void
>();

function notifyVoiceConnState(
    state: "connecting" | "connected" | "reconnecting" | null,
): void {
    const roomId = activeVoice?.roomId ?? null;
    for (const cb of voiceConnStateSubscribers) cb(state, roomId);
}

export function onVoiceConnStateChanged(cb: VoiceConnStateCb): () => void {
    voiceConnStateSubscribers.add(cb);
    return () => voiceConnStateSubscribers.delete(cb);
}

export function onActiveSpeakersChanged(
    cb: (memberIds: string[]) => void,
): () => void {
    activeSpeakerSubscribers.add(cb);
    return () => activeSpeakerSubscribers.delete(cb);
}

/**
 * Fires with every currently mic-muted remote identity whenever any of them
 * changes. Only meaningful for the call we are connected to — LiveKit reports
 * track mute state only for a room we have joined. Remote deafen is not
 * knowable and is never reported here.
 */
export function onParticipantMuteChanged(
    cb: (mutedIdentities: string[]) => void,
): () => void {
    participantMuteSubscribers.add(cb);
    return () => participantMuteSubscribers.delete(cb);
}

const videoTracksSubscribers = new Set<
    (tiles: VideoTileDescriptor[]) => void
>();

/** Fires with the current renderable video tiles (remote + local camera and
 *  screenshare) whenever any video track is added or removed. Emits [] on
 *  teardown. Only meaningful for the call we are connected to. */
export function onVideoTracksChanged(
    cb: (tiles: VideoTileDescriptor[]) => void,
): () => void {
    videoTracksSubscribers.add(cb);
    return () => videoTracksSubscribers.delete(cb);
}

/** Walk every connection's participants and collect subscribed video tracks
 *  as normalized inputs for buildVideoTiles(). Local tracks live on the
 *  publishing connection only. */
function currentVideoInputs(call: ActiveVoiceCall): VideoPublicationInput[] {
    const lk = call.lk;
    const out: VideoPublicationInput[] = [];
    const addFrom = (
        p: RemoteParticipant | LocalParticipant,
        isLocal: boolean,
    ): void => {
        for (const pub of p.videoTrackPublications.values()) {
            const track = (pub as TrackPublication).track;
            if (!track) continue; // remote: not subscribed yet
            // A dead frame stays published in two ways: turning a camera off
            // MUTES its track (LiveKit unpublishes only screenshares), and a
            // stopped remote share can arrive as an SFU stream *pause* rather
            // than an unpublish. Either way skip it so the tile drops back to
            // the avatar / disappears instead of freezing on a black frame.
            if (
                (pub as TrackPublication).isMuted ||
                track.streamState === lk.Track.StreamState.Paused
            )
                continue;
            let source: VideoSource | null = null;
            if (pub.source === lk.Track.Source.Camera) source = "camera";
            else if (pub.source === lk.Track.Source.ScreenShare)
                source = "screenshare";
            if (!source) continue;
            out.push({
                userId: userIdFromIdentity(p.identity),
                identity: p.identity,
                source,
                isLocal,
                track,
            });
        }
    };
    for (const lkRoom of callLkRooms(call))
        for (const p of lkRoom.remoteParticipants.values()) addFrom(p, false);
    addFrom(call.lkRoom.localParticipant, true);
    return out;
}

const voiceErrorSubscribers = new Set<(message: string) => void>();

/** Fires when an established/joining call fails fatally (e.g. the server
 *  rejects our membership state event) and has been torn down. */
export function onVoiceCallError(cb: (message: string) => void): () => void {
    voiceErrorSubscribers.add(cb);
    return () => voiceErrorSubscribers.delete(cb);
}

const voiceNoticeSubscribers = new Set<(message: string) => void>();

/** Non-fatal call notices (device errors, silent mic): toast, no teardown.
 *  Kept separate from onVoiceCallError so error-sound logic never misfires. */
export function onVoiceNotice(cb: (message: string) => void): () => void {
    voiceNoticeSubscribers.add(cb);
    return () => voiceNoticeSubscribers.delete(cb);
}

function notifyVoiceNotice(message: string): void {
    for (const cb of voiceNoticeSubscribers) cb(message);
}

let voicePlaybackBlocked = false;
const voicePlaybackBlockedSubscribers = new Set<(blocked: boolean) => void>();

/** Autoplay policy blocked remote audio; show "Enable audio" and call
 *  resumeVoicePlayback() from a user gesture. */
export function onVoicePlaybackBlockedChanged(
    cb: (blocked: boolean) => void,
): () => void {
    voicePlaybackBlockedSubscribers.add(cb);
    return () => voicePlaybackBlockedSubscribers.delete(cb);
}

function setVoicePlaybackBlocked(blocked: boolean): void {
    if (voicePlaybackBlocked === blocked) return;
    voicePlaybackBlocked = blocked;
    for (const cb of voicePlaybackBlockedSubscribers) cb(blocked);
}

/** Autoplay-blocked: a LiveKit connection can't play, or the Web Audio
 *  graph's context is held suspended. */
function refreshPlaybackBlocked(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    setVoicePlaybackBlocked(
        callLkRooms(call).some((r) => !r.canPlaybackAudio) ||
            (!!call.audioGraph && call.audioGraph.suspended),
    );
}

export async function resumeVoicePlayback(): Promise<void> {
    const call = activeVoice;
    if (!call) return;
    await Promise.all([
        ...callLkRooms(call).map((r) => r.startAudio().catch(() => {})),
        call.audioGraph ? call.audioGraph.resume() : undefined,
    ]);
    refreshPlaybackBlocked(call);
}

export function getActiveVoiceRoomId(): string | null {
    return activeVoice?.roomId ?? null;
}

/** The homeserver's advertised MatrixRTC foci (MSC4143 .well-known). */
export async function configuredRtcFoci(): Promise<unknown[]> {
    if (!matrixClient) return [];
    let wk = matrixClient.getClientWellKnown() as
        Record<string, unknown> | undefined;
    if (!wk) {
        // startClient() doesn't pass clientWellKnownPollPeriod, so the SDK
        // never fetches .well-known on its own and getClientWellKnown()
        // stays undefined — fetch it once on demand (the SDK caches it). A
        // failed fetch just means no advertised foci, not a failed call.
        wk = (await matrixClient.waitForClientWellKnown().catch(() => {
            return undefined;
        })) as Record<string, unknown> | undefined;
    }
    const foci = wk?.["org.matrix.msc4143.rtc_foci"];
    return Array.isArray(foci) ? foci : [];
}

/** Ask an SFU's lk-jwt-service for a LiveKit token (legacy /sfu/get). On our
 *  own SFU it may publish; on another homeserver's it is listen-only. */
async function fetchSfuJwt(
    target: LivekitTarget,
): Promise<{ url: string; jwt: string }> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const openIdToken = await matrixClient.getOpenIdToken();
    await bypassProxyFor(target.serviceUrl);
    const res = await fetch(sfuJwtUrl(target.serviceUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            room: target.alias,
            openid_token: openIdToken,
            device_id: matrixClient.getDeviceId(),
        }),
    });
    if (!res.ok) {
        throw new Error(
            t("client.voiceServerRejectedTheJoin", { status: res.status }),
        );
    }
    return (await res.json()) as { url: string; jwt: string };
}

/** Remote identities with a muted mic, across every connection. */
function notifyCallMutes(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    const muted = new Set<string>();
    for (const lkRoom of callLkRooms(call))
        for (const p of lkRoom.remoteParticipants.values())
            for (const pub of p.audioTrackPublications.values())
                if (pub.isMuted) {
                    muted.add(p.identity);
                    break;
                }
    for (const cb of participantMuteSubscribers) cb([...muted]);
}

function notifyCallVideo(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    const tiles = buildVideoTiles(currentVideoInputs(call));
    for (const cb of videoTracksSubscribers) cb(tiles);
}

function notifyCallSpeakers(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    const ids = new Set<string>();
    for (const list of call.speakersByRoom.values())
        for (const id of list) ids.add(id);
    for (const cb of activeSpeakerSubscribers) cb([...ids]);
}

/** Remote media for one connection of `call` (publishing or listen-only):
 *  attach audio, honour per-user video hiding, and feed the merged speaker,
 *  mute and video-tile views. */
function wireCallMedia(call: ActiveVoiceCall, lkRoom: LivekitRoom): void {
    const lk = call.lk;
    // Who sends unencrypted media in an encrypted call (the indicator).
    const encryptionChanged = () => notifyCallEncryption(call);
    lkRoom.on(lk.RoomEvent.TrackPublished, encryptionChanged);
    // Counted for the debug panel: a viewer whose video arrives but never
    // decodes is told it doesn't decrypt (an older client, a missing key).
    lkRoom.on(
        lk.RoomEvent.EncryptionError,
        (_err: Error, participant?: { identity: string }) => {
            const id = participant?.identity;
            if (!id || participant === lkRoom.localParticipant) return;
            call.decryptErrors.set(id, (call.decryptErrors.get(id) ?? 0) + 1);
        },
    );
    lkRoom.on(lk.RoomEvent.TrackUnpublished, encryptionChanged);
    lkRoom.on(lk.RoomEvent.ParticipantDisconnected, encryptionChanged);
    // What the people we publish to decode (utils/videoCodecs): LiveKit
    // hands over everyone's attributes on joining and reports changes.
    if (lkRoom === call.lkRoom) {
        const codecsChanged = () => notifyCallCodecs(call);
        lkRoom.on(lk.RoomEvent.ParticipantConnected, codecsChanged);
        lkRoom.on(lk.RoomEvent.ParticipantDisconnected, codecsChanged);
        lkRoom.on(
            lk.RoomEvent.ParticipantAttributesChanged,
            (changed: Record<string, string>) => {
                if (DECODE_ATTRIBUTE in changed) codecsChanged();
            },
        );
    }
    lkRoom.on(
        lk.RoomEvent.TrackSubscribed,
        (
            track: RemoteTrack,
            pub: RemoteTrackPublication,
            participant: RemoteParticipant,
        ) => {
            if (track.kind === lk.Track.Kind.Video) {
                const uid = userIdFromIdentity(participant.identity);
                if (
                    participantAudio.get(uid)?.videoHidden &&
                    pub.source === lk.Track.Source.Camera
                ) {
                    pub.setEnabled(false);
                }
                return;
            }
            if (track.kind !== lk.Track.Kind.Audio) return;
            if (activeVoice !== call) {
                // Call already superseded/left — don't attach at all.
                track.detach().forEach((el) => el.remove());
                return;
            }
            const el = track.attach() as HTMLAudioElement;
            applyVoiceSink(el);
            // LiveKit's startAudio() unmutes every attached element (ours via
            // resumeVoicePlayback, Safari's on each return to the page), which
            // would undo deafen and double up graph-routed audio: put it back.
            el.addEventListener("volumechange", () => {
                if (activeVoice !== call) return;
                const want =
                    voicePlaybackMuted ||
                    (!!call.audioGraph && call.audioGraph.has(el));
                if (el.muted !== want) el.muted = want;
            });
            call.audioEls.add(el);
            call.elByTrack.set(track, el);
            let els = call.elsByIdentity.get(participant.identity);
            if (!els) {
                els = new Set();
                call.elsByIdentity.set(participant.identity, els);
            }
            els.add(el);
            document.body.appendChild(el);
            // Last: routing into the graph reads the attached stream, and the
            // element must already be tracked for later level changes.
            applyElementVolume(el, participant.identity);
        },
    );
    lkRoom.on(lk.RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        const el = call.elByTrack.get(track);
        if (!el) return;
        call.elByTrack.delete(track);
        // Must leave the graph: a remote track is only disabled on
        // unsubscribe, and a rejoin can re-enable the same receiver track,
        // so a forgotten graph source would play again alongside the new
        // one (each rejoin adding another copy).
        if (call.audioGraph) call.audioGraph.remove(el);
        call.audioEls.delete(el);
        for (const [identity, els] of call.elsByIdentity) {
            els.delete(el);
            if (els.size === 0) call.elsByIdentity.delete(identity);
        }
        el.srcObject = null;
        el.remove();
    });
    lkRoom.on(lk.RoomEvent.ActiveSpeakersChanged, (speakers) => {
        call.speakersByRoom.set(
            lkRoom,
            speakers.map((p) => p.identity),
        );
        notifyCallSpeakers(call);
    });
    const mutes = () => notifyCallMutes(call);
    lkRoom.on(lk.RoomEvent.TrackMuted, mutes);
    lkRoom.on(lk.RoomEvent.TrackUnmuted, mutes);
    // A participant arriving already muted fires neither event.
    lkRoom.on(lk.RoomEvent.TrackSubscribed, mutes);
    lkRoom.on(lk.RoomEvent.ParticipantDisconnected, mutes);
    const video = () => notifyCallVideo(call);
    lkRoom.on(lk.RoomEvent.TrackSubscribed, video);
    lkRoom.on(lk.RoomEvent.TrackUnsubscribed, video);
    // Camera off = track.mute(), not unpublish — recompute on mute/unmute
    // too, so the tile drops to the avatar (and returns) as it toggles.
    lkRoom.on(lk.RoomEvent.TrackMuted, video);
    lkRoom.on(lk.RoomEvent.TrackUnmuted, video);
    // A remote stopping a share can surface as a bare TrackUnpublished
    // (no TrackUnsubscribed, if the track was already detached) or as an
    // SFU stream-state pause — recompute on both so their tile clears.
    lkRoom.on(lk.RoomEvent.TrackUnpublished, video);
    lkRoom.on(lk.RoomEvent.TrackStreamStateChanged, video);
    lkRoom.on(lk.RoomEvent.ParticipantDisconnected, video);
    lkRoom.on(lk.RoomEvent.AudioPlaybackStatusChanged, () =>
        refreshPlaybackBlocked(call),
    );
}

// How long a join waits for the noise filter model (see joinVoiceCall).
const DENOISE_JOIN_WAIT_MS = 10_000;

// Retry an SFU we lost or couldn't reach, while the call still needs it.
const REMOTE_SFU_RETRY_MS = 10_000;

/** Bring `call`'s listen-only connections in line with where the other
 *  members publish: connect to new SFUs, drop ones nobody uses any more. */
async function syncRemoteSfus(call: ActiveVoiceCall): Promise<void> {
    if (activeVoice !== call || !matrixClient) return;
    const me = matrixClient.getUserId();
    const myDevice = matrixClient.getDeviceId();
    const oldest = call.session.getOldestMembership();
    const transports = oldest
        ? call.session.memberships
              .filter((m) => !(m.userId === me && m.deviceId === myDevice))
              .map((m) => m.getTransport(oldest))
        : [];
    const wanted = remoteLivekitTargets(
        transports,
        call.publishKey,
        call.roomId,
    );
    for (const [key, lkRoom] of call.remotes) {
        if (wanted.has(key)) continue;
        call.remotes.delete(key);
        call.speakersByRoom.delete(lkRoom);
        void lkRoom.disconnect().catch(() => {});
    }
    for (const [key, target] of wanted)
        if (!call.remotes.has(key) && !call.remotesConnecting.has(key))
            void connectRemoteSfu(call, key, target);
    notifyCallMutes(call);
    notifyCallVideo(call);
    notifyCallSpeakers(call);
}

async function connectRemoteSfu(
    call: ActiveVoiceCall,
    key: string,
    target: LivekitTarget,
): Promise<void> {
    call.remotesConnecting.add(key);
    const lkRoom = new call.lk.Room(
        call.e2ee ? { e2ee: call.e2ee.roomOptions() } : undefined,
    );
    try {
        const { url, jwt } = await fetchSfuJwt(target);
        if (activeVoice !== call) return;
        wireCallMedia(call, lkRoom);
        lkRoom.on(call.lk.RoomEvent.Disconnected, () => {
            // Dropped by the SFU or the network (our own disconnects remove
            // the entry first): forget it and try again shortly.
            if (call.remotes.get(key) !== lkRoom) return;
            call.remotes.delete(key);
            call.speakersByRoom.delete(lkRoom);
            notifyCallMutes(call);
            notifyCallVideo(call);
            notifyCallSpeakers(call);
            setTimeout(() => void syncRemoteSfus(call), REMOTE_SFU_RETRY_MS);
        });
        await bypassProxyFor(url);
        if (call.e2ee) await lkRoom.setE2EEEnabled(true);
        sfuUrlOf.set(lkRoom, url);
        await lkRoom.connect(url, jwt);
        if (activeVoice !== call) {
            await lkRoom.disconnect().catch(() => {});
            return;
        }
        call.remotes.set(key, lkRoom);
        announceCodecs(call, lkRoom);
        notifyCallEncryption(call);
        call.remoteFailuresNotified.delete(key);
        // Settles anything that changed while connecting (incl. the SFU no
        // longer being wanted) and refreshes the merged views.
        void syncRemoteSfus(call);
    } catch (err) {
        await lkRoom.disconnect().catch(() => {});
        if (activeVoice !== call) return;
        console.warn("[voice] couldn't connect to", target.serviceUrl, err);
        if (!call.remoteFailuresNotified.has(key)) {
            call.remoteFailuresNotified.add(key);
            let server = target.serviceUrl;
            try {
                server = new URL(target.serviceUrl).host;
            } catch {
                /* not a URL: show it as-is */
            }
            notifyVoiceNotice(t("client.couldNotReachCallServer", { server }));
        }
        setTimeout(() => void syncRemoteSfus(call), REMOTE_SFU_RETRY_MS);
    } finally {
        call.remotesConnecting.delete(key);
    }
}

/**
 * Join the MatrixRTC voice call in a room.
 *
 * Resolves without joining when superseded mid-flight by a newer
 * `joinVoiceCall` or an explicit `leaveVoiceCall`; rejects on
 * mic-permission, JWT, or SFU failure. Observe the actual state via
 * `onVoiceConnStateChanged` / `getActiveVoiceRoomId`, not the returned
 * promise.
 */
export async function joinVoiceCall(roomId: string): Promise<void> {
    if (!matrixClient) throw new Error(t("client.notLoggedIn"));
    const room = matrixClient.getRoom(roomId);
    if (!room) throw new Error(t("client.unknownRoom"));
    const seq = ++voiceJoinSeq;
    // Start the chunk fetch now so it overlaps leaveVoiceCallInternal(), the
    // mic permission prompt and configuredRtcFoci(); it is awaited just
    // before the Room is constructed. The no-op catch only stops an
    // unhandled rejection if we bail out before that await — awaiting this
    // same promise below still throws.
    const livekitLoad = livekit.load();
    livekitLoad.catch(() => {});
    // Same for the noise filter: compiled now, awaited before the mic exists
    // so the call never starts unfiltered. Bounded, so a first download on a
    // slow link delays the join rather than blocking it.
    const joinDenoise = planMicProcessing(
        settingsState.noiseSuppressionMode,
        settingsState.micGainMode,
        deepFilterSupported(),
        micTuning(),
    ).chain?.denoise;
    const denoiseLoad = joinDenoise
        ? prepareDenoiser(joinDenoise, DENOISE_JOIN_WAIT_MS)
        : Promise.resolve(false);
    await leaveVoiceCallInternal();
    if (seq !== voiceJoinSeq) return; // superseded while leaving

    // Fail fast on mic permission before announcing membership.
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    probe.getTracks().forEach((t) => t.stop());
    if (seq !== voiceJoinSeq) return;

    const session = matrixClient.matrixRTC.getRoomSession(room);
    const oldest = session.getOldestMembership();
    const memberTransports = oldest
        ? session.memberships
              .map((m) => m.getTransport(oldest))
              .filter((t): t is NonNullable<typeof t> => !!t)
        : [];
    const foci = await configuredRtcFoci();
    if (seq !== voiceJoinSeq) return;
    // Multi-SFU: publish on our own homeserver's SFU (the only one whose
    // lk-jwt-service lets us publish) and listen on everyone else's. A
    // homeserver without one falls back to the shared SFU of the oldest member.
    const ownTarget = pickOwnLivekitTransport(foci, roomId);
    const target =
        ownTarget ?? pickLivekitTransport(memberTransports, foci, roomId);
    if (!target) throw new Error("No LiveKit focus available for this call");

    const userId = matrixClient.getUserId()!;
    const deviceId = matrixClient.getDeviceId()!;
    // Snapshot the call's non-self peers BEFORE our own membership publishes,
    // so we can tell "starting a call" (ring the peer) from "answering one"
    // (stay silent). See the ring-send after joinRTCSession below.
    const callPeersBeforeJoin = getRoomCallMemberships(room)
        .map((m) => m.userId)
        .filter((id) => id !== userId);
    const lk = await livekitLoad;
    await denoiseLoad;
    if (seq !== voiceJoinSeq) return; // superseded while loading livekit
    const localCodecs = await localVideoCodecs(lk);
    if (seq !== voiceJoinSeq) return;
    // Element Call's rule: a call in an encrypted room is encrypted end to
    // end. Sending plain media into it would leave everyone else unable to
    // play ours, so a device that can't encrypt doesn't join.
    const encrypted = room.hasEncryptionStateEvent();
    if (encrypted && !lk.isE2EESupported()) {
        throw new Error(t("client.encryptedCallsUnsupported"));
    }
    const e2ee = encrypted ? await setupCallE2EE(lk, session) : null;
    if (seq !== voiceJoinSeq) {
        e2ee?.stop();
        return;
    }
    const micPlan = planMicProcessing(
        settingsState.noiseSuppressionMode,
        settingsState.micGainMode,
        deepFilterSupported(),
        micTuning(),
    );
    const lkRoom = new lk.Room({
        ...(e2ee ? { e2ee: e2ee.roomOptions() } : {}),
        audioCaptureDefaults: {
            deviceId: settingsState.audioInputDeviceId ?? undefined,
            noiseSuppression: micPlan.noiseSuppression,
            echoCancellation: settingsState.echoCancellation,
            autoGainControl: micPlan.autoGainControl,
            // No `processor` here: see setCallMicEnabled.
        },
        // Each video publish sets its own backup codec
        // (videoCodecPublishOptions).
        publishDefaults: { backupCodec: false },
    });
    voiceOutputDeviceId = settingsState.audioOutputDeviceId;
    voiceOutputVolume = settingsState.callOutputVolume;
    voiceNormalize = settingsState.normalizeCallAudio;
    // The SDK's MembershipManager gives up for good on some failures (e.g.
    // a 403 on the call.member state PUT in rooms where we lack power) and
    // only reports it via this session event — without it we'd stay
    // connected to LiveKit, audible but invisible to everyone else.
    const onMmError = (err: unknown) => {
        if (activeVoice !== call) return;
        console.error("Voice call membership failed:", err);
        const detail = matrixErrorMessage(
            err,
            t("client.theServerRejectedItYouMay"),
        );
        for (const cb of voiceErrorSubscribers)
            cb(t("client.callMembershipFailed", { detail }));
        void leaveVoiceCall();
    };
    const onMyMembership = (room: Room, membership: string) => {
        // Someone removed me (kick/ban) or I left elsewhere while in this
        // call: the SFU connection + mic would otherwise stay live in a room
        // I'm no longer in. Tear down and say why.
        if (activeVoice !== call || room.roomId !== call.roomId) return;
        const me = matrixClient!.getUserId();
        if (!me) return;
        // Prefer the member object's cached event, but fall back to the live
        // state event — either can be missing after I leave from another device.
        const sender =
            room.getMember(me)?.events?.member?.getSender() ??
            room.currentState.getStateEvents("m.room.member", me)?.getSender();
        const msg = callEndedMembershipMessage(membership, sender, me);
        if (!msg) return;
        for (const cb of voiceErrorSubscribers) cb(msg);
        void leaveVoiceCall();
    };
    const call: ActiveVoiceCall = {
        roomId,
        session,
        lkRoom,
        publishKey: livekitTargetKey(target),
        remotes: new Map(),
        remotesConnecting: new Set(),
        remoteFailuresNotified: new Set(),
        speakersByRoom: new Map(),
        onMembershipsChanged: () => void syncRemoteSfus(call),
        lk,
        audioEls: new Set(),
        audioGraph: null,
        elsByIdentity: new Map(),
        elByTrack: new Map(),
        onMmError,
        onMyMembership,
        codecs: localCodecs,
        e2ee,
        decryptErrors: new Map(),
    };
    activeVoice = call;
    startUploadSampling(call);
    ensureVoiceDeviceWatch();
    desiredMicMuted = micClosedAtJoin();
    desiredCameraOn = false;
    notifyVoiceConnState("connecting");
    session.on("membership_manager_error" as never, onMmError as never);
    matrixClient.on("Room.myMembership" as never, onMyMembership as never);

    let connected = false;
    try {
        // MSC4075 ring: if WE are the first into a DM call, the SDK sends an
        // rtc.notification ring once our membership lands, so the peer's
        // devices ring even with the app closed. It skips the ring itself if
        // someone else is already in the call by then; answering (a peer
        // already present at snapshot time) never asks for one.
        const ring = shouldRingPeers(
            getDirectRoomIds().has(roomId),
            callPeersBeforeJoin,
        );
        const transport = {
            type: "livekit",
            livekit_service_url: target.serviceUrl,
            livekit_alias: target.alias,
        };
        // multi_sfu advertises the SFU we publish on (the SDK lists it first
        // in foci_preferred); oldest_membership joins the shared SFU instead.
        session.joinRTCSession(
            { userId, deviceId, memberId: `${userId}:${deviceId}` },
            ownTarget ? [] : [transport],
            ownTarget ? transport : undefined,
            {
                membershipEventExpiryMs: 4 * 60 * 60 * 1000,
                // Make our media key, send it to everyone's devices, and
                // report theirs (setupCallE2EE).
                manageMediaKeys: encrypted,
                ...(ring
                    ? { notificationType: "ring" as const, callIntent: "audio" }
                    : {}),
            },
        );

        const { url, jwt } = await fetchSfuJwt(target);
        if (seq !== voiceJoinSeq) return;

        wireCallMedia(call, lkRoom);
        // Our own camera/screenshare tiles: only the publishing connection
        // has local tracks.
        lkRoom.on(lk.RoomEvent.LocalTrackPublished, () =>
            notifyCallVideo(call),
        );
        lkRoom.on(lk.RoomEvent.LocalTrackUnpublished, (publication) => {
            // However the share ended (our button, the OS's stop sharing),
            // its separately published audio ends with it.
            if (
                publication.source === lk.Track.Source.ScreenShare &&
                republishingSource !== publication.source
            ) {
                stopShareAudio();
            }
            notifyCallVideo(call);
        });
        lkRoom.on(lk.RoomEvent.Reconnecting, () => {
            if (activeVoice !== call) return;
            notifyVoiceConnState("reconnecting");
        });
        lkRoom.on(lk.RoomEvent.Reconnected, () => {
            if (activeVoice !== call) return;
            notifyVoiceConnState("connected");
        });
        lkRoom.on(lk.RoomEvent.Disconnected, () => {
            // SFU kicked us or the connection died for good — tear down
            // fully and tell the user. User-initiated leaves null
            // activeVoice first, so this only fires on genuine drops.
            // LiveKit emits Disconnected while still Connecting when the
            // connect fails; the join's own catch reports that failure
            // exactly once, so only act here when we were connected.
            if (connected && activeVoice?.lkRoom === lkRoom) {
                for (const cb of voiceErrorSubscribers)
                    cb(t("client.voiceCallDisconnected"));
                void leaveVoiceCall();
            }
        });
        let silenceNotified = false;
        lkRoom.on(lk.RoomEvent.LocalAudioSilenceDetected, () => {
            if (activeVoice !== call || silenceNotified) return;
            silenceNotified = true;
            notifyVoiceNotice(t("client.yourMicrophoneAppearsSilentCheckYour"));
        });
        lkRoom.on(lk.RoomEvent.MediaDevicesError, (e: Error) => {
            if (activeVoice !== call) return;
            // LiveKit emits this BEFORE it rethrows the getUserMedia/
            // getDisplayMedia rejection, so it also fires on every ordinary
            // dismissal of a picker or permission prompt. Without this guard,
            // cancelling the screen-share picker toasts a bogus "Audio device
            // error", and a denied camera permission double-toasts alongside
            // setCameraEnabled's own (accurate) message.
            if (isUserCancel(e)) return;
            notifyVoiceNotice(
                t("client.audioDeviceError", { message: e.message }),
            );
        });

        await bypassProxyFor(url);
        if (e2ee) await lkRoom.setE2EEEnabled(true);
        sfuUrlOf.set(lkRoom, url);
        await lkRoom.connect(url, jwt);
        connected = true;
        // The server's enabled codecs are known now.
        announceCodecs(call, lkRoom);
        notifyCallCodecs(call);
        notifyCallEncryption(call);
        if (seq !== voiceJoinSeq) {
            await lkRoom.disconnect().catch(() => {});
            return;
        }
        await setCallMicEnabled(call, !desiredMicMuted);
        if (seq !== voiceJoinSeq) {
            await lkRoom.disconnect().catch(() => {});
            return;
        }
        notifyVoiceConnState("connected");
        setVoicePlaybackBlocked(!lkRoom.canPlaybackAudio);
        // Now listen on every other member's SFU, and keep that set in step
        // with the call's membership.
        session.on(
            "memberships_changed" as never,
            call.onMembershipsChanged as never,
        );
        void syncRemoteSfus(call);
    } catch (err) {
        if (activeVoice === call) {
            await leaveVoiceCall();
            throw err;
        } else {
            // Superseded mid-join: tear down our own resources only. The
            // superseder's leave already left the RTC session; don't touch
            // the per-room session object a rejoin may be re-joining. Return
            // without throwing — the superseder owns the outcome, and the
            // function's doc contract says it resolves without joining when
            // superseded.
            for (const el of call.audioEls) el.remove();
            call.audioEls.clear();
            if (call.audioGraph) call.audioGraph.close();
            await Promise.allSettled(
                callLkRooms(call).map((r) => r.disconnect()),
            );
            return;
        }
    }
}

export async function leaveVoiceCall(): Promise<void> {
    // An explicit leave invalidates any in-flight join, which bails at its
    // next staleness check instead of resurrecting the call.
    voiceJoinSeq++;
    await leaveVoiceCallInternal();
}

let voiceLeaveInFlight: Promise<void> | null = null;

async function leaveVoiceCallInternal(): Promise<void> {
    while (voiceLeaveInFlight) await voiceLeaveInFlight;
    const call = activeVoice;
    if (!call) return;
    const run = (async () => {
        activeVoice = null;
        // The room disconnect below unpublishes it; this stops the capture.
        stopShareAudio();
        cancelShareAudioWait();
        // These only ever hold the call they belong to; dropping them here
        // keeps a finished call's LiveKit Room and audio elements collectable.
        audioInputGoneNotified = null;
        videoInputGoneNotified = null;
        // Playback mute (deafen) is per-call state — a stale flag would attach
        // every remote track of the NEXT call muted while the UI shows undeafened.
        voicePlaybackMuted = false;
        // Notify subscribers before the network teardown below so the UI clears
        // instantly; the join seq guard protects a racing join.
        for (const cb of activeSpeakerSubscribers) cb([]);
        for (const cb of participantMuteSubscribers) cb([]);
        for (const cb of videoTracksSubscribers) cb([]);
        for (const cb of codecSubscribers) cb(null);
        for (const cb of encryptionSubscribers) cb(null);
        call.e2ee?.stop();
        notifyVoiceConnState(null);
        setVoicePlaybackBlocked(false);
        call.session.off(
            "membership_manager_error" as never,
            call.onMmError as never,
        );
        matrixClient?.off(
            "Room.myMembership" as never,
            call.onMyMembership as never,
        );
        call.session.off(
            "memberships_changed" as never,
            call.onMembershipsChanged as never,
        );
        for (const el of call.audioEls) el.remove();
        call.audioEls.clear();
        if (call.audioGraph) call.audioGraph.close();
        // In parallel, not SFU-first: the membership leave is what other
        // users' rosters see, and it must fit the account-switch and logout
        // windows even when the LiveKit teardown is slow (audit IMP-1).
        // Both settle quietly: a rejected disconnect means already gone.
        await Promise.allSettled([
            ...callLkRooms(call).map((r) => r.disconnect()),
            call.session.leaveRoomSession(10_000),
        ]);
    })();
    voiceLeaveInFlight = run;
    try {
        await run;
    } finally {
        voiceLeaveInFlight = null;
    }
}

// The first-mic-track creation in flight, so a double unmute can't publish
// two microphones.
let micCreation: Promise<void> | null = null;

/** Turn the call's mic on or off. Once a mic track exists this is LiveKit's
 *  own mute/unmute. Creating the FIRST one with Zam's mic chain on is done
 *  here instead: LiveKit applies an `audioCaptureDefaults.processor` inside
 *  createLocalTracks, before the track has the AudioContext setProcessor
 *  requires, so it always threw ("Audio context needs to be set on
 *  LocalAudioTrack"). localParticipant.createTracks gives the track its
 *  context; the processor goes on before publishing, so nothing unfiltered
 *  is ever sent. */
async function setCallMicEnabled(
    call: ActiveVoiceCall,
    enabled: boolean,
): Promise<void> {
    const lp = call.lkRoom.localParticipant;
    const source = call.lk.Track.Source.Microphone;
    while (micCreation) await micCreation;
    const chain = planMicProcessing(
        settingsState.noiseSuppressionMode,
        settingsState.micGainMode,
        deepFilterSupported(),
        micTuning(),
    ).chain;
    if (!enabled || !chain || lp.getTrackPublication(source)) {
        await lp.setMicrophoneEnabled(enabled);
        return;
    }
    const run = (async () => {
        const [track] = await lp.createTracks({ audio: true });
        if (activeVoice !== call) {
            track.stop();
            return;
        }
        try {
            await (track as LivekitClient.LocalAudioTrack).setProcessor(
                createMicProcessor(chain),
            );
        } catch (err) {
            // Better heard unprocessed than not at all.
            console.error("Mic processing failed, sending raw mic:", err);
            notifyVoiceNotice(
                t("client.couldnTApplyAudioProcessingChange", {
                    error: errorLabel(err),
                }),
            );
        }
        await lp.publishTrack(track, { source });
    })();
    micCreation = run;
    try {
        await run;
    } finally {
        micCreation = null;
    }
}

/** Returns false when the device refused (e.g. unmuting a dead mic) so the
 *  caller can roll the UI back to the truth. */
export async function setMicMuted(muted: boolean): Promise<boolean> {
    desiredMicMuted = muted;
    const call = activeVoice;
    if (!call) return true;
    try {
        await setCallMicEnabled(call, !muted);
        return true;
    } catch {
        // A failed unmute leaves the mic muted in reality.
        if (activeVoice === call && !muted) desiredMicMuted = true;
        return false;
    }
}

export function setVoicePlaybackMuted(muted: boolean): void {
    voicePlaybackMuted = muted;
    if (!activeVoice) return;
    const graph = activeVoice.audioGraph || null;
    graph?.setMuted(muted);
    // Routed elements stay muted: their audio plays from the graph's output.
    for (const el of activeVoice.audioEls)
        if (!graph?.has(el)) el.muted = muted;
}

/** Route call audio to an output device (null = system default). Applies to
 *  the live call and to future attaches; no-op where setSinkId is missing. */
export function setVoiceOutputDevice(deviceId: string | null): void {
    voiceOutputDeviceId = deviceId;
    if (!activeVoice) return;
    for (const el of activeVoice.audioEls) applyVoiceSink(el);
    if (activeVoice.audioGraph) activeVoice.audioGraph.setSink(deviceId);
}

/** Turn incoming-voice normalization on or off for the live call and later
 *  joins. Turning it on routes everyone through the Web Audio graph; turning
 *  it off leaves them routed at unity normalization gain. */
export function setVoiceNormalization(on: boolean): void {
    voiceNormalize = on;
    if (!activeVoice) return;
    const graph = activeVoice.audioGraph || null;
    graph?.setNormalize(on);
    for (const [identity, els] of activeVoice.elsByIdentity)
        for (const el of els) applyElementVolume(el, identity);
}

export function setVoiceOutputVolume(volume: number): void {
    voiceOutputVolume = Math.min(1, Math.max(0, volume));
    if (!activeVoice) return;
    for (const [identity, els] of activeVoice.elsByIdentity) {
        for (const el of els) applyElementVolume(el, identity);
    }
}

/** Switch a live call input device. LiveKit's restart stops the current
 *  track BEFORE acquiring the new device, so a failed switch (device held by
 *  another app, vanished id) leaves the published track ended and silent.
 *  On failure, restore the previous device (else the system default), point
 *  the saved selection back at the device actually in use (callers persist
 *  the pick before switching), and tell the user. Resolves either way; never
 *  throws. A muted mic is not covered: LiveKit defers its restart to unmute. */
async function switchInputWithRecovery(
    call: ActiveVoiceCall,
    kind: "audioinput" | "videoinput",
    deviceId: string,
    exact: boolean,
    what: string,
): Promise<void> {
    const source =
        kind === "audioinput"
            ? call.lk.Track.Source.Microphone
            : call.lk.Track.Source.Camera;
    const track =
        call.lkRoom.localParticipant.getTrackPublication(source)?.track;
    const previousId = track?.mediaStreamTrack.getSettings().deviceId;
    const persist =
        kind === "audioinput" ? setAudioInputDeviceId : setVideoInputDeviceId;
    const trySwitch = async (id: string, ex: boolean): Promise<boolean> => {
        try {
            return (
                (await call.lkRoom.switchActiveDevice(kind, id, ex)) !== false
            );
        } catch {
            return false;
        }
    };
    if (await trySwitch(deviceId, exact)) return;
    if (activeVoice !== call) return;
    // exact: Chromium treats a bare (ideal) deviceId as a hint and hands back
    // the default device, which LiveKit then reports as a failed switch.
    if (
        previousId &&
        previousId !== "default" &&
        (await trySwitch(previousId, true))
    ) {
        persist(previousId);
        if (activeVoice === call)
            notifyVoiceNotice(t("client.couldnTSwitchToThatKept", { what }));
        return;
    }
    const onDefault = await trySwitch("default", false);
    if (onDefault) persist(null);
    if (activeVoice !== call) return;
    notifyVoiceNotice(
        onDefault
            ? t("client.couldnTSwitchToThatUsing", { what })
            : t("client.couldnTSwitchToThatPick", { what }),
    );
}

/** Switch the live call's microphone. A null deviceId selects the system
 *  default device live (previously this was a no-op that only took effect on
 *  the next join). */
export async function setVoiceInputDevice(
    deviceId: string | null,
): Promise<void> {
    const call = activeVoice;
    if (!call) return;
    // A real device uses exact:true (switchActiveDevice's default). System
    // default: LiveKit resolves the "default" sentinel to the OS default
    // input; exact:false so browsers without a literal "default" device id
    // (Firefox) fall back to their default instead of throwing.
    await switchInputWithRecovery(
        call,
        "audioinput",
        deviceId ?? "default",
        !!deviceId,
        t("client.deviceNounMicrophone"),
    );
}

/** getDisplayMedia rejects with NotAllowedError/AbortError when the user
 *  dismisses the OS picker — that is a choice, not a failure, so it must not
 *  toast. */
function isUserCancel(err: unknown): boolean {
    return (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "AbortError")
    );
}

/** The screen-share quality settings, to notice a change mid-picker. */
function screenShareQualityKey(): string {
    return `${settingsState.screenShareResolution}|${settingsState.screenShareFps}|${screenShareBitrateNow()}`;
}

/** Start/stop publishing a screen share (with system audio per settings).
 *  Returns whether a share is now being published. The store drives its UI
 *  state from LocalTrackPublished/Unpublished, so this return is advisory. */
export async function setScreenShareEnabled(on: boolean): Promise<boolean> {
    const call = activeVoice;
    if (!call) return false;
    // The capture and encoding below are read now, but the desktop picker
    // (which offers the quality settings too) answers later: a change made
    // there is applied once the share is up.
    const startedWith = screenShareQualityKey();
    try {
        await call.lkRoom.localParticipant.setScreenShareEnabled(
            on,
            {
                // The desktop picker asks about audio itself (defaulting to
                // this setting), and per-application choices need it asked.
                audio:
                    pickerOffersShareAudio() || settingsState.shareSystemAudio,
                resolution: screenShareCaptureResolution(
                    settingsState.screenShareResolution,
                    Number(settingsState.screenShareFps),
                ),
                // A screen share is mostly text/UI: bias the encoder toward
                // keeping resolution sharp rather than dropping it to hold
                // framerate under load (which blurs text while scrolling).
                // The opposite of camera video — do NOT flip this back to
                // "motion"/"maintain-framerate" for the screen-share path.
                contentHint: "detail",
            },
            {
                screenShareEncoding: screenShareEncodingFor(
                    screenShareBitrateNow(),
                    Number(settingsState.screenShareFps),
                ),
                degradationPreference: "maintain-resolution",
                ...videoCodecPublishOptions(call),
            },
        );
        if (on) void publishShareAudio(call);
        else stopShareAudio();
        if (on && screenShareQualityKey() !== startedWith)
            void setScreenShareQuality(
                settingsState.screenShareResolution,
                Number(settingsState.screenShareFps),
            );
        return on;
    } catch (err) {
        if (on) cancelShareAudioWait();
        if (isUserCancel(err)) return false;
        console.error("Screen share failed:", err);
        // Left the call while the picker was open: LiveKit already dropped
        // the late track, and a failure toast for an ended call is noise.
        if (activeVoice !== call) return false;
        notifyVoiceNotice(t("client.couldNotStartScreenShare"));
        return false;
    }
}

/** Publish the audio the desktop picker set up for the share just started,
 *  if any. Failure leaves the share running without audio. */
async function publishShareAudio(call: ActiveVoiceCall): Promise<void> {
    const audio = await takeShareAudio();
    if (!audio || audio.kind === "none") return;
    let handle: ShareAudioTrack | null = null;
    try {
        if (audio.kind !== "failed") handle = await openShareAudioTrack(audio);
    } catch (err) {
        console.error("Screen share audio failed:", err);
    }
    if (!handle) {
        releaseShareAudio(audio);
        if (activeVoice === call) {
            notifyVoiceNotice(t("client.couldNotShareScreenAudio"));
        }
        return;
    }
    const lp = call.lkRoom.localParticipant;
    const sharing = () =>
        activeVoice === call &&
        !!lp.getTrackPublication(call.lk.Track.Source.ScreenShare);
    if (!sharing()) {
        handle.close();
        stopShareAudioCapture();
        return;
    }
    stopShareAudio();
    const track = new call.lk.LocalAudioTrack(handle.track, undefined, false);
    shareAudio = { call, track, handle };
    try {
        await lp.publishTrack(track, {
            source: call.lk.Track.Source.ScreenShareAudio,
            audioPreset: call.lk.AudioPresets.musicHighQualityStereo,
            forceStereo: true,
            dtx: false,
            red: false,
        });
    } catch (err) {
        console.error("Screen share audio publish failed:", err);
        if (shareAudio?.track === track) stopShareAudio();
        return;
    }
    // The share may have ended while this published.
    if (!sharing() && shareAudio?.track === track) stopShareAudio();
}

/** Stop and unpublish the share's own audio track, if there is one. */
function stopShareAudio(): void {
    const s = shareAudio;
    shareAudio = null;
    if (!s) return;
    s.handle.close();
    stopShareAudioCapture();
    if (activeVoice === s.call) {
        void s.call.lkRoom.localParticipant
            .unpublishTrack(s.track)
            .catch(() => {});
    }
}

/** The picked screen-share bitrate, held under the measured upload. */
function screenShareBitrateNow(): number {
    return clampBitrate(
        settingsState.screenShareBitrate,
        screenShareBitrateCeiling(),
    );
}

/** Re-target the currently published screen share to a new quality without
 *  re-acquiring the capture: applyConstraints moves the running capture's
 *  resolution/fps, then the publish encoding (bitrate/framerate cap) follows.
 *  No-op when nothing is being shared. */
async function applyScreenShareQualityNow(
    resKey: string,
    fps: number,
): Promise<void> {
    const call = activeVoice;
    if (!call) return;
    const track = call.lkRoom.localParticipant.getTrackPublication(
        call.lk.Track.Source.ScreenShare,
    )?.videoTrack;
    const sender = track?.sender;
    if (!track || !sender) return;
    try {
        // Apply the new capture constraints first, so the underlying capture
        // adjusts before we change the encoding bitrate/framerate caps. Use
        // ideal so a smaller capture doesn't throw OverconstrainedError.
        const { width, height, frameRate } = screenShareCaptureResolution(
            resKey,
            fps,
        );
        await track.mediaStreamTrack.applyConstraints({
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: frameRate },
        });

        const params = sender.getParameters();
        if (
            applyScreenShareEncoding(
                params,
                screenShareEncodingFor(screenShareBitrateNow(), fps),
            )
        ) {
            // Match setScreenShareEnabled: screen content prefers a sharp
            // resolution over a steady framerate under load.
            params.degradationPreference = "maintain-resolution";
            await sender.setParameters(params);
        }
    } catch (err) {
        console.error("Screen share quality change failed:", err);
        if (activeVoice === call) {
            notifyVoiceNotice(t("client.couldnTChangeScreenShareQuality"));
        }
    }
}

export function setScreenShareQuality(
    resKey: string,
    fps: number,
): Promise<void> {
    screenShareQualityChain = screenShareQualityChain.then(() =>
        applyScreenShareQualityNow(resKey, fps),
    );
    return screenShareQualityChain;
}

/** Start/stop publishing the camera, using the configured input device. */
export async function setCameraEnabled(on: boolean): Promise<boolean> {
    const call = activeVoice;
    if (!call) return false;
    try {
        await call.lkRoom.localParticipant.setCameraEnabled(
            on,
            { deviceId: settingsState.videoInputDeviceId ?? undefined },
            videoCodecPublishOptions(call),
        );
        if (activeVoice === call) desiredCameraOn = on;
        return on;
    } catch (err) {
        console.error("Camera enable failed:", err);
        // Same as screen share: no toast once the call has ended.
        if (activeVoice !== call) return false;
        notifyVoiceNotice(t("client.couldNotStartTheCameraCheck"));
        return false;
    }
}

/** Switch the live call's camera. Null (system default) takes effect on the
 *  next enable. No-op when not sharing camera. */
export async function setVideoInputDevice(
    deviceId: string | null,
): Promise<void> {
    const call = activeVoice;
    if (!call || !deviceId) return;
    await switchInputWithRecovery(
        call,
        "videoinput",
        deviceId,
        true,
        t("client.deviceNounCamera"),
    );
}

/** Put Zam's mic chain on a live mic track. Once attached the processor
 *  stays and is reconfigured in place (a pass-through when nothing is
 *  wanted): LiveKit's swap and stop paths can throw and drop the mic (see
 *  $lib/audio/micProcessor). A restart keeps it too: LiveKit re-inits it on
 *  the new track. */
async function applyMicProcessor(
    track: LivekitClient.LocalAudioTrack,
    chain: MicProcessingPlan["chain"],
): Promise<void> {
    const current = track.getProcessor() as MicProcessor | undefined;
    if (current?.name === "zam-mic-processor") {
        await current.reconfigure(chain ?? PASSTHROUGH_CHAIN);
        return;
    }
    // Only attach where nothing is: setProcessor on a track that already has
    // a processor goes through the same throwing teardown.
    if (chain && !current) await track.setProcessor(createMicProcessor(chain));
}

/** The debug-screen mic chain tuning, as set now. */
function micTuning(): MicTuning {
    return {
        pauseGate: settingsState.micPauseGate,
        attenuationDb: settingsState.dfAttenuationDb,
    };
}

/** Live NS/EC/AGC change on the published mic track (no-op when not in a
 *  call — the next join reads the settings via audioCaptureDefaults). */
export async function setVoiceCaptureConstraints(opts: {
    noiseSuppressionMode: NoiseSuppressionMode;
    echoCancellation: boolean;
    micGainMode: MicGainMode;
}): Promise<void> {
    const call = activeVoice;
    if (!call) return;
    const plan = planMicProcessing(
        opts.noiseSuppressionMode,
        opts.micGainMode,
        deepFilterSupported(),
        micTuning(),
    );
    const c = {
        noiseSuppression: plan.noiseSuppression,
        echoCancellation: opts.echoCancellation,
        autoGainControl: plan.autoGainControl,
    };
    // Keep the defaults in step so a mic track created later (first unmute
    // after joining muted) gets the same constraints; setCallMicEnabled
    // reads the settings again for its processor.
    const defaults = call.lkRoom.options.audioCaptureDefaults;
    if (defaults) Object.assign(defaults, c);
    const track = call.lkRoom.localParticipant.getTrackPublication(
        call.lk.Track.Source.Microphone,
    )?.audioTrack;
    if (!track) return;
    // Pass the current device along so restartTrack doesn't switch to the
    // OS default. Prefer the live track's device id, else the saved selection.
    // It must be `exact`: Chromium treats a bare (ideal) deviceId as a hint
    // and re-acquired the default mic in live testing. If the exact device
    // can't be re-opened, try it as a hint before giving up rather than
    // leaving the mic dead (the restart has already stopped the old track).
    const deviceId =
        track.mediaStreamTrack.getSettings().deviceId ??
        settingsState.audioInputDeviceId ??
        undefined;
    const attempts = deviceId ? [{ exact: deviceId }, deviceId] : [undefined];
    let failure: unknown = null;
    for (const id of attempts) {
        try {
            await track.restartTrack({ ...c, deviceId: id });
            failure = null;
            break;
        } catch (err) {
            console.warn("Mic restart failed (deviceId %o):", id, err);
            failure = err;
        }
    }
    if (!failure) {
        try {
            await applyMicProcessor(track, plan.chain);
        } catch (err) {
            failure = err;
        }
    }
    if (failure) {
        console.error("Voice capture constraints change failed:", failure);
        if (activeVoice === call)
            notifyVoiceNotice(
                t("client.couldnTApplyAudioProcessingChange", {
                    error: errorLabel(failure),
                }),
            );
    }
}

/** Short name for an error in a notice ("OverconstrainedError: deviceId"),
 *  so a report says what actually failed. */
function errorLabel(err: unknown): string {
    if (err instanceof Error || err instanceof DOMException) {
        const detail =
            (err as { constraint?: string }).constraint || err.message;
        return detail ? `${err.name}: ${detail}` : err.name;
    }
    return String(err);
}

/** Live srcObject streams of the call's remote <audio> elements (feeds the
 *  settings tab's incoming-audio meter; re-read on voiceTick changes). */
export function getRemoteAudioStreams(): MediaStream[] {
    if (!activeVoice) return [];
    const streams: MediaStream[] = [];
    for (const el of activeVoice.audioEls)
        if (el.srcObject instanceof MediaStream) streams.push(el.srcObject);
    return streams;
}

/** One participant as the call debug panel shows them. */
export interface CallDebugParticipant {
    identity: string;
    userId: string;
    /** LiveKit's server-side grade of THEIR connection: excellent/good/poor/lost. */
    quality: string;
    /** Their microphone's receive-side stats, or null when not subscribed. */
    audio: RawStat[] | null;
}

/** One LiveKit connection of the call (the publishing one, or a listen-only remote SFU). */
export interface CallDebugConnection {
    /** Stable across polls: the publish key, or the remote's key. */
    key: string;
    /** The SFU's service host, for display. */
    server: string;
    publishing: boolean;
    state: string;
    /** WebSocket signalling round trip, ms. */
    signalRttMs: number | null;
    region: string | null;
    serverVersion: string | null;
    publisher: RawStat[] | null;
    subscriber: RawStat[] | null;
    /** LiveKit's grade of OUR connection to this SFU. */
    localQuality: string;
    participants: CallDebugParticipant[];
    /** MediaStreamTrack id -> whose track it is and what it carries, so
     *  the RTP streams in the reports can be labelled. */
    owners: Record<string, StreamOwner>;
    /** Every camera and screen share on this connection, ours included. */
    videos: VideoTrackDebug[];
    /** The SFU's signalling URL, to ask how it is routed (proxy). */
    sfuUrl: string | null;
}

/** What the debug panel needs to know about one video track. */
function videoTrackDebug(
    call: ActiveVoiceCall,
    pub: TrackPublication,
    identity: string | null,
): VideoTrackDebug {
    const lk = call.lk;
    const track = pub.track as
        | (Track & {
              streamState?: unknown;
              attachedElements: HTMLMediaElement[];
          })
        | undefined;
    const mst = track?.mediaStreamTrack;
    const settings = (identity === null ? mst?.getSettings() : undefined) as
        (MediaTrackSettings & { displaySurface?: string }) | undefined;
    const els = (track?.attachedElements ?? []).filter(
        (el): el is HTMLVideoElement => el instanceof HTMLVideoElement,
    );
    let elementFrames: number | null = null;
    for (const el of els) {
        const q = el.getVideoPlaybackQuality?.();
        if (q) elementFrames = (elementFrames ?? 0) + q.totalVideoFrames;
    }
    const remote = pub as TrackPublication & {
        isSubscribed?: boolean;
        isEnabled?: boolean;
    };
    return {
        identity,
        source:
            pub.source === lk.Track.Source.ScreenShare
                ? "screen_share"
                : pub.source === lk.Track.Source.Camera
                  ? "camera"
                  : "unknown",
        subscribed: identity === null ? true : !!remote.isSubscribed,
        muted: pub.isMuted,
        enabled: identity === null ? true : remote.isEnabled !== false,
        streamPaused: track?.streamState === lk.Track.StreamState.Paused,
        trackState: mst?.readyState ?? null,
        trackMuted: mst ? mst.muted : null,
        captureWidth: settings?.width ?? null,
        captureHeight: settings?.height ?? null,
        captureFps: settings?.frameRate ?? null,
        displaySurface: settings?.displaySurface ?? null,
        elements: els.length,
        elementFrames,
        elementWidth: els[0]?.videoWidth ?? null,
        elementHeight: els[0]?.videoHeight ?? null,
        decryptErrors: identity ? (call.decryptErrors.get(identity) ?? 0) : 0,
    };
}

function connectionVideos(
    call: ActiveVoiceCall,
    lkRoom: LivekitRoom,
    publishing: boolean,
): VideoTrackDebug[] {
    const out: VideoTrackDebug[] = [];
    if (publishing)
        for (const pub of lkRoom.localParticipant.videoTrackPublications.values())
            out.push(videoTrackDebug(call, pub as TrackPublication, null));
    for (const p of lkRoom.remoteParticipants.values())
        for (const pub of p.videoTrackPublications.values())
            out.push(
                videoTrackDebug(call, pub as TrackPublication, p.identity),
            );
    return out;
}

/** Every track of this connection by MediaStreamTrack id: ours (both the
 *  captured track and a processor's output, which is what is sent) and each
 *  remote participant's subscribed ones. */
function trackOwners(lkRoom: LivekitRoom): Record<string, StreamOwner> {
    const owners: Record<string, StreamOwner> = {};
    const add = (
        track: unknown,
        source: string,
        identity: string | null,
    ): void => {
        const t = track as
            | {
                  mediaStreamTrack?: MediaStreamTrack;
                  processor?: { processedTrack?: MediaStreamTrack };
              }
            | undefined;
        const owner = { source: source as StreamOwner["source"], identity };
        for (const mst of [t?.mediaStreamTrack, t?.processor?.processedTrack])
            if (mst) owners[mst.id] = owner;
    };
    for (const pub of lkRoom.localParticipant.trackPublications.values())
        add(pub.track, pub.source, null);
    for (const p of lkRoom.remoteParticipants.values())
        for (const pub of p.trackPublications.values())
            add(pub.track, pub.source, p.identity);
    return owners;
}

/** Desktop, when calls are set to go direct (electron/proxy.cjs): name a
 *  call server (token service or SFU) before connecting to it, so its
 *  host skips the proxy. Media needs nothing: every IP address goes direct
 *  in that mode. The homeserver's own host is never named, so a call
 *  server sharing it keeps the homeserver on the proxy. Resolves once the
 *  rules apply; never throws. */
async function bypassProxyFor(url: string): Promise<void> {
    const proxy = window.desktop?.proxy;
    if (!proxy) return;
    try {
        const host = new URL(url).hostname;
        const homeserver = matrixClient
            ? new URL(matrixClient.getHomeserverUrl()).hostname
            : null;
        if (host === homeserver) return;
        await proxy.callTargets([host]);
    } catch {
        /* the call goes on with the rules it has */
    }
}

// --- end-to-end encryption ----------------------------------------------------
//
// Element Call's scheme, so the two can share an encrypted call (its
// sdk/src/media-backend/livekit): every participant encrypts with a key of
// its own. matrix-js-sdk makes ours and sends it to each participant's
// devices over Matrix (manageMediaKeys), then reports every key with the
// LiveKit identity it belongs to; each goes to LiveKit as HKDF key material
// for that identity. Every LiveKit connection gets a worker of its own, as
// one worker gets confused by streams from several rooms.

interface CallE2EE {
    /** `e2ee` options for a new LiveKit Room. */
    roomOptions: () => {
        keyProvider: LivekitClient.BaseKeyProvider;
        worker: Worker;
    };
    /** Stop listening for keys and end the workers. */
    stop: () => void;
}

const MEDIA_KEY_EVENT = "encryption_key_changed"; // MatrixRTCSessionEvent

async function setupCallE2EE(
    lk: LivekitModule,
    session: ReturnType<MatrixClient["matrixRTC"]["getRoomSession"]>,
): Promise<CallE2EE> {
    // Element Call's MatrixKeyProvider settings.
    class MatrixKeyProvider extends lk.BaseKeyProvider {
        constructor() {
            super({ ratchetWindowSize: 10, keyringSize: 256 });
        }
        setParticipantKey(key: CryptoKey, identity: string, index: number) {
            this.onSetEncryptionKey(key, identity, index);
        }
    }
    const keyProvider = new MatrixKeyProvider();
    const onKey = (
        key: Uint8Array<ArrayBuffer>,
        index: number,
        _membership: unknown,
        identity: string,
    ) => {
        crypto.subtle
            .importKey("raw", key, "HKDF", false, ["deriveBits", "deriveKey"])
            .then(
                (material) =>
                    keyProvider.setParticipantKey(material, identity, index),
                (err: unknown) =>
                    console.error("Couldn't import a call media key:", err),
            );
    };
    session.on(MEDIA_KEY_EVENT as never, onKey as never);
    session.reemitEncryptionKeys();
    const { default: E2EEWorker } =
        await import("livekit-client/e2ee-worker?worker");
    const workers: Worker[] = [];
    return {
        roomOptions: () => {
            const worker = new E2EEWorker();
            workers.push(worker);
            return { keyProvider, worker };
        },
        stop: () => {
            session.off(MEDIA_KEY_EVENT as never, onKey as never);
            // After the rooms have disconnected, which flushes their streams.
            setTimeout(() => {
                for (const worker of workers) worker.terminate();
            }, 5000);
        },
    };
}

export interface CallEncryptionState {
    /** Whether we encrypt, and expect others to. */
    encrypted: boolean;
    /** In an encrypted call, who sends unencrypted media (an app without
     *  encryption): we still play it, since LiveKit passes a participant's
     *  frames through when the server marks their tracks unencrypted, but
     *  they can't play ours. User ids, once each. */
    unencrypted: string[];
}

const encryptionSubscribers = new Set<
    (state: CallEncryptionState | null) => void
>();

/** Fires with the call's encryption state whenever it changes; null when the
 *  call ends. */
export function onCallEncryptionChanged(
    cb: (state: CallEncryptionState | null) => void,
): () => void {
    encryptionSubscribers.add(cb);
    return () => encryptionSubscribers.delete(cb);
}

function notifyCallEncryption(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    const unencrypted = new Set<string>();
    if (call.e2ee) {
        for (const lkRoom of callLkRooms(call))
            for (const p of lkRoom.remoteParticipants.values())
                for (const pub of p.trackPublications.values())
                    if (!pub.isEncrypted)
                        unencrypted.add(userIdFromIdentity(p.identity));
    }
    const state: CallEncryptionState = {
        encrypted: call.e2ee !== null,
        unencrypted: [...unencrypted].sort(),
    };
    for (const cb of encryptionSubscribers) cb(state);
}

// --- video codecs -------------------------------------------------------------

interface LocalVideoCodecs {
    /** What this browser can send that LiveKit will publish as asked. */
    send: VideoCodec[];
    /** What it can decode; announced to the others. */
    decode: VideoCodec[];
    /** The sendable ones it encodes on the GPU. */
    hardware: VideoCodec[];
}

const WEBRTC_MIME: Record<VideoCodec, string> = {
    av1: "video/AV1",
    h265: "video/H265",
    vp9: "video/VP9",
    h264: "video/H264",
    vp8: "video/VP8",
};

function rtpCodecMimes(kind: "send" | "receive"): string[] {
    try {
        const api = kind === "send" ? RTCRtpSender : RTCRtpReceiver;
        return (
            api.getCapabilities?.("video")?.codecs.map((c) => c.mimeType) ?? []
        );
    } catch {
        return [];
    }
}

async function localVideoCodecs(lk: LivekitModule): Promise<LocalVideoCodecs> {
    // LiveKit quietly publishes its default instead of AV1, VP9 or HEVC where
    // it doesn't trust the browser's support, so those aren't offered there.
    const send = codecsFromMimeTypes(rtpCodecMimes("send")).filter((c) =>
        c === "av1"
            ? lk.supportsAV1()
            : c === "vp9"
              ? lk.supportsVP9()
              : c === "h265"
                ? lk.supportsH265()
                : true,
    );
    const hardware = await Promise.all(
        send.map(async (codec) => {
            try {
                const info = await navigator.mediaCapabilities.encodingInfo({
                    type: "webrtc",
                    video: {
                        contentType: WEBRTC_MIME[codec],
                        width: 1920,
                        height: 1080,
                        bitrate: 4_000_000,
                        framerate: 30,
                    },
                });
                return info.powerEfficient ? codec : null;
            } catch {
                return null;
            }
        }),
    );
    return {
        send,
        decode: codecsFromMimeTypes(rtpCodecMimes("receive")),
        hardware: hardware.filter((c): c is VideoCodec => c !== null),
    };
}

/** What we can send on the publishing connection: our codecs, less any the
 *  server doesn't accept (it lists those once connected). */
function sendableCodecs(call: ActiveVoiceCall): VideoCodec[] {
    const enabled =
        (
            call.lkRoom.localParticipant as unknown as {
                enabledPublishVideoCodecs?: { mime: string }[];
            }
        ).enabledPublishVideoCodecs ?? [];
    if (enabled.length === 0) return call.codecs.send;
    const allowed = codecsFromMimeTypes(enabled.map((c) => c.mime));
    return call.codecs.send.filter((c) => allowed.includes(c));
}

/** The codec part of a video publish: the picked codec if we can send it,
 *  and for anything but VP8/H.264 an H.264 (or VP8) backup. The server asks
 *  for the backup only once a viewer can't decode the main stream, and sends
 *  it to them alone; everyone else keeps the picked codec. */
function codecPlan(call: ActiveVoiceCall) {
    return planCodecs(
        settingsState.callVideoCodec,
        sendableCodecs(call),
        peerDecode(call),
        call.e2ee !== null,
    );
}

function videoCodecPublishOptions(call: ActiveVoiceCall) {
    const { current, backup } = codecPlan(call);
    return {
        videoCodec: current,
        backupCodec: backup ? { codec: backup } : false,
        backupCodecPolicy: call.lk.BackupCodecPolicy.SIMULCAST,
    } as const;
}

/** Tell everyone on `lkRoom` what we decode. Set on every connection, since
 *  whoever publishes on a remote one needs it too. */
function announceCodecs(call: ActiveVoiceCall, lkRoom: LivekitRoom): void {
    if (activeVoice !== call) return;
    void lkRoom.localParticipant
        .setAttributes({
            [DECODE_ATTRIBUTE]: encodeDecodeAttribute(call.codecs.decode),
        })
        .catch((err: unknown) =>
            console.warn("Couldn't announce video codecs:", err),
        );
}

/** What each participant we publish to decodes; null for those who didn't
 *  say. */
function peerDecode(call: ActiveVoiceCall): (VideoCodec[] | null)[] {
    return [...call.lkRoom.remoteParticipants.values()].map((p) =>
        parseDecodeAttribute(p.attributes[DECODE_ATTRIBUTE]),
    );
}

export interface CallCodecState {
    /** What we can send. */
    sendable: VideoCodec[];
    /** What we can send that everyone who said what they decode can watch. */
    available: VideoCodec[];
    /** The sendable codecs this device encodes on the GPU. */
    hardware: VideoCodec[];
    /** What our camera and screen share use. */
    current: VideoCodec;
    /** What the user picked; differs from `current` in an encrypted call
     *  while someone can't watch the pick. */
    picked: VideoCodec;
    /** Whether the call is end-to-end encrypted. */
    encrypted: boolean;
}

const codecSubscribers = new Set<(state: CallCodecState | null) => void>();

/** Fires with the call's codec choices whenever they change; null when the
 *  call ends. */
export function onCallCodecsChanged(
    cb: (state: CallCodecState | null) => void,
): () => void {
    codecSubscribers.add(cb);
    return () => codecSubscribers.delete(cb);
}

function notifyCallCodecs(call: ActiveVoiceCall): void {
    if (activeVoice !== call) return;
    const plan = codecPlan(call);
    const state: CallCodecState = {
        sendable: sendableCodecs(call),
        available: plan.available,
        hardware: call.codecs.hardware,
        current: plan.current,
        picked: settingsState.callVideoCodec,
        encrypted: call.e2ee !== null,
    };
    for (const cb of codecSubscribers) cb(state);
    // Encrypted, the codec follows who's in the call (planCodecs): move what
    // we're sending when that changes. A no-op when it already matches.
    if (call.e2ee) queueVideoRepublish();
}

// Set while a video track is unpublished to come straight back with another
// codec, so LocalTrackUnpublished doesn't take it for the share ending.
let republishingSource: string | null = null;
let codecSwitchChain: Promise<void> = Promise.resolve();

/** Pick the codec for the camera and screen share, and move whatever is
 *  being sent now over to it. A published track can't change codec, so each
 *  is unpublished and published again: viewers see it drop for a moment. */
export function switchCallVideoCodec(codec: VideoCodec): Promise<void> {
    setCallVideoCodec(codec);
    const call = activeVoice;
    if (call) notifyCallCodecs(call);
    return queueVideoRepublish();
}

/** Republish the camera and screen share wherever their codec isn't the
 *  one codecPlan wants. */
function queueVideoRepublish(): Promise<void> {
    codecSwitchChain = codecSwitchChain.then(async () => {
        const c = activeVoice;
        if (!c) return;
        for (const source of [
            c.lk.Track.Source.Camera,
            c.lk.Track.Source.ScreenShare,
        ])
            await republishVideo(c, source);
    });
    return codecSwitchChain;
}

async function republishVideo(
    call: ActiveVoiceCall,
    source: LivekitClient.Track.Source,
): Promise<void> {
    const lp = call.lkRoom.localParticipant;
    const pub = lp.getTrackPublication(source);
    const track = pub?.videoTrack;
    if (!pub || !track) return;
    const codecOptions = videoCodecPublishOptions(call);
    if (pub.options?.videoCodec === codecOptions.videoCodec) return;
    const options = { ...pub.options, ...codecOptions, source };
    if (source === call.lk.Track.Source.ScreenShare) {
        options.screenShareEncoding = screenShareEncodingFor(
            screenShareBitrateNow(),
            Number(settingsState.screenShareFps),
        );
    }
    republishingSource = source;
    try {
        await lp.unpublishTrack(track, false);
        if (activeVoice !== call) {
            track.stop();
            return;
        }
        await lp.publishTrack(track, options);
    } catch (err) {
        console.error("Video codec switch failed:", err);
        if (activeVoice === call) {
            notifyVoiceNotice(t("client.couldNotSwitchVideoCodec"));
        }
    } finally {
        republishingSource = null;
    }
}

// Upload bandwidth for the screen-share bitrate slider
// (stores/uploadEstimate.svelte): WebRTC's estimate on the publishing
// connection, sampled only while we send video, since with just a microphone
// it barely probes and reads far too low.
const UPLOAD_SAMPLE_MS = 3000;

function startUploadSampling(call: ActiveVoiceCall): void {
    clearLiveUploadEstimate();
    const timer = setInterval(() => {
        if (activeVoice !== call) {
            clearInterval(timer);
            clearLiveUploadEstimate();
            return;
        }
        void sampleUpload(call);
    }, UPLOAD_SAMPLE_MS);
}

async function sampleUpload(call: ActiveVoiceCall): Promise<void> {
    const lp = call.lkRoom.localParticipant;
    const sendingVideo = [
        call.lk.Track.Source.ScreenShare,
        call.lk.Track.Source.Camera,
    ].some((source) => {
        const pub = lp.getTrackPublication(source);
        return !!pub?.track && !pub.isMuted;
    });
    if (!sendingVideo) return;
    const pcm = (
        call.lkRoom.engine as
            | {
                  pcManager?: {
                      publisher?: {
                          getStats(): Promise<RTCStatsReport> | undefined;
                      };
                  };
              }
            | undefined
    )?.pcManager;
    const stats = await reportValues(pcm?.publisher?.getStats());
    const bps = stats ? availableOutgoingBitrate(stats) : null;
    if (bps !== null && activeVoice === call) noteUploadEstimate(bps);
}

async function reportValues(
    report: Promise<RTCStatsReport | undefined> | undefined,
): Promise<RawStat[] | null> {
    try {
        const r = await report;
        return r ? ([...r.values()] as RawStat[]) : null;
    } catch {
        return null;
    }
}

function serverHost(key: string): string {
    const serviceUrl = key.split("|")[0];
    try {
        return new URL(serviceUrl).host;
    } catch {
        return serviceUrl;
    }
}

/**
 * A raw stats snapshot of every connection of the active call, for the debug
 * panel (utils/callStats folds it). Null when not in a call. Reads LiveKit's
 * transports through `engine.pcManager`, which is public on the engine but
 * not part of the documented surface, so every step is optional: a library
 * update that moves it degrades to empty transports, never a throw.
 */
export async function getCallDebugStats(): Promise<
    CallDebugConnection[] | null
> {
    const call = activeVoice;
    if (!call) return null;
    const entries: [string, LivekitRoom, boolean][] = [
        [call.publishKey, call.lkRoom, true],
        ...[...call.remotes].map(
            ([key, r]) => [key, r, false] as [string, LivekitRoom, boolean],
        ),
    ];
    return Promise.all(
        entries.map(async ([key, lkRoom, publishing]) => {
            const engine = lkRoom.engine as
                | {
                      pcManager?: {
                          publisher?: {
                              getStats(): Promise<RTCStatsReport> | undefined;
                          };
                          subscriber?: {
                              getStats(): Promise<RTCStatsReport> | undefined;
                          };
                      };
                      client?: { rtt?: number };
                  }
                | undefined;
            const pcm = engine?.pcManager;
            const [publisher, subscriber, participants] = await Promise.all([
                reportValues(pcm?.publisher?.getStats()),
                reportValues(pcm?.subscriber?.getStats()),
                Promise.all(
                    [...lkRoom.remoteParticipants.values()].map(async (p) => {
                        const pub = p.getTrackPublication(
                            call.lk.Track.Source.Microphone,
                        );
                        return {
                            identity: p.identity,
                            userId: userIdFromIdentity(p.identity),
                            quality: String(p.connectionQuality),
                            audio: pub?.track
                                ? await reportValues(
                                      pub.track.getRTCStatsReport(),
                                  )
                                : null,
                        };
                    }),
                ),
            ]);
            const rtt = engine?.client?.rtt;
            return {
                key,
                server: serverHost(key),
                publishing,
                state: String(lkRoom.state),
                signalRttMs: typeof rtt === "number" && rtt > 0 ? rtt : null,
                region: lkRoom.serverInfo?.region || null,
                serverVersion: lkRoom.serverInfo?.version || null,
                publisher,
                subscriber,
                localQuality: String(lkRoom.localParticipant.connectionQuality),
                participants,
                owners: trackOwners(lkRoom),
                videos: connectionVideos(call, lkRoom, publishing),
                sfuUrl: sfuUrlOf.get(lkRoom) ?? null,
            };
        }),
    );
}
