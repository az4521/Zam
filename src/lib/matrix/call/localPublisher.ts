/**
 * Our own call media: the microphone, camera and screen share, as LiveKit
 * local tracks (their processors, restarts and device switching are what the
 * call is built on) whichever transport sends them.
 *
 * - `livekitLocalPublisher`: the SFU room we publish on owns the tracks;
 *   this only forwards to its LocalParticipant, so LiveKit calls behave
 *   exactly as before.
 * - `standaloneLocalPublisher`: no SFU of our own (we publish on full mesh).
 *   The tracks are created and held here, and the mesh sends them.
 *
 * Only reachable from the call chunk: the LiveKit namespace is passed in.
 */
import type * as LivekitClient from "livekit-client";
import type { MeshLocalMedia, MeshPublication } from "./fullMesh/connection";

type LivekitModule = typeof import("livekit-client");
type LocalTrack = LivekitClient.LocalTrack;
type Source = LivekitClient.Track.Source;

export interface LocalPublisher {
    /** Capture options a mic created later starts with; callers may edit. */
    readonly options: {
        audioCaptureDefaults?: LivekitClient.AudioCaptureOptions;
    };
    /** The published track of a source. */
    getTrack(source: Source): LocalTrack | undefined;
    tracks(): LocalTrack[];
    /** Mute or unmute the mic, creating it on the first unmute. */
    setMicrophoneEnabled(enabled: boolean): Promise<void>;
    /** A new, unpublished mic track that can take a processor. */
    createMicTrack(): Promise<LivekitClient.LocalAudioTrack>;
    publishTrack(
        track: LocalTrack,
        options?: LivekitClient.TrackPublishOptions,
    ): Promise<void>;
    unpublishTrack(track: LocalTrack): Promise<void>;
    setCameraEnabled(
        enabled: boolean,
        capture?: LivekitClient.VideoCaptureOptions,
        publish?: LivekitClient.TrackPublishOptions,
    ): Promise<void>;
    setScreenShareEnabled(
        enabled: boolean,
        capture?: LivekitClient.ScreenShareCaptureOptions,
        publish?: LivekitClient.TrackPublishOptions,
    ): Promise<void>;
    /** False when the device couldn't be switched to. */
    switchActiveDevice(
        kind: "audioinput" | "videoinput",
        deviceId: string,
        exact: boolean,
    ): Promise<boolean>;
    onPublished(cb: (track: LocalTrack) => void): () => void;
    onUnpublished(cb: (track: LocalTrack) => void): () => void;
    /** Stop every track (the SFU room stops its own on disconnect). */
    close(): void;
}

export function livekitLocalPublisher(
    lk: LivekitModule,
    room: LivekitClient.Room,
): LocalPublisher {
    const lp = room.localParticipant;
    const listen = (
        event: LivekitClient.RoomEvent,
        cb: (track: LocalTrack) => void,
    ) => {
        const handler = (pub: LivekitClient.LocalTrackPublication) => {
            if (pub.track) cb(pub.track);
        };
        room.on(event as never, handler as never);
        return () => void room.off(event as never, handler as never);
    };
    return {
        options: room.options,
        getTrack: (source) => lp.getTrackPublication(source)?.track,
        tracks: () =>
            [...lp.trackPublications.values()]
                .map((p) => p.track)
                .filter((t): t is LocalTrack => !!t),
        async setMicrophoneEnabled(enabled) {
            await lp.setMicrophoneEnabled(enabled);
        },
        async createMicTrack() {
            const [track] = await lp.createTracks({ audio: true });
            return track as LivekitClient.LocalAudioTrack;
        },
        async publishTrack(track, options) {
            await lp.publishTrack(track, options);
        },
        async unpublishTrack(track) {
            await lp.unpublishTrack(track);
        },
        async setCameraEnabled(enabled, capture, publish) {
            await lp.setCameraEnabled(enabled, capture, publish);
        },
        async setScreenShareEnabled(enabled, capture, publish) {
            await lp.setScreenShareEnabled(enabled, capture, publish);
        },
        switchActiveDevice: (kind, deviceId, exact) =>
            room.switchActiveDevice(kind, deviceId, exact),
        onPublished: (cb) => listen(lk.RoomEvent.LocalTrackPublished, cb),
        onUnpublished: (cb) => listen(lk.RoomEvent.LocalTrackUnpublished, cb),
        close() {},
    };
}

/** Local tracks with no room: what a full mesh publisher sends. */
export function standaloneLocalPublisher(
    lk: LivekitModule,
    audioCaptureDefaults: LivekitClient.AudioCaptureOptions,
): LocalPublisher {
    const published = new Map<Source, LocalTrack>();
    const publishedCbs = new Set<(track: LocalTrack) => void>();
    const unpublishedCbs = new Set<(track: LocalTrack) => void>();
    // Processors (the mic chain) need one; LiveKit's Room makes its own.
    let audioContext: AudioContext | null = null;
    const options = { audioCaptureDefaults };

    const publish = (track: LocalTrack, source?: Source) => {
        if (source) track.source = source;
        const old = published.get(track.source);
        if (old === track) return;
        if (old) unpublish(old);
        published.set(track.source, track);
        // The browser's own "stop sharing" ends a screen capture.
        track.once(lk.TrackEvent.Ended, () => {
            if (published.get(track.source) === track) unpublish(track, true);
        });
        for (const cb of publishedCbs) cb(track);
    };
    const unpublish = (track: LocalTrack, stop = false) => {
        if (published.get(track.source) !== track) return;
        published.delete(track.source);
        if (stop) track.stop();
        for (const cb of unpublishedCbs) cb(track);
    };
    const sourceFor = (kind: "audioinput" | "videoinput") =>
        kind === "audioinput"
            ? lk.Track.Source.Microphone
            : lk.Track.Source.Camera;

    const self: LocalPublisher = {
        options,
        getTrack: (source) => published.get(source),
        tracks: () => [...published.values()],
        async setMicrophoneEnabled(enabled) {
            const mic = published.get(lk.Track.Source.Microphone);
            if (mic) {
                await (enabled ? mic.unmute() : mic.mute());
                return;
            }
            if (!enabled) return;
            publish(await self.createMicTrack(), lk.Track.Source.Microphone);
        },
        async createMicTrack() {
            const track = await lk.createLocalAudioTrack({
                ...options.audioCaptureDefaults,
            });
            audioContext ??= new AudioContext({ latencyHint: "interactive" });
            track.setAudioContext(audioContext);
            return track;
        },
        async publishTrack(track, opts) {
            publish(track, opts?.source);
        },
        async unpublishTrack(track) {
            unpublish(track);
        },
        async setCameraEnabled(enabled, capture) {
            const camera = published.get(lk.Track.Source.Camera);
            if (camera) {
                // LiveKit turns the camera itself off on mute, as a room does.
                await (enabled ? camera.unmute() : camera.mute());
                return;
            }
            if (!enabled) return;
            const track = await lk.createLocalVideoTrack(capture);
            publish(track, lk.Track.Source.Camera);
        },
        async setScreenShareEnabled(enabled, capture) {
            const share = [
                published.get(lk.Track.Source.ScreenShare),
                published.get(lk.Track.Source.ScreenShareAudio),
            ];
            if (!enabled) {
                for (const t of share) if (t) unpublish(t, true);
                return;
            }
            if (share[0]) return;
            const tracks = await lk.createLocalScreenTracks(capture);
            for (const t of tracks) publish(t);
        },
        async switchActiveDevice(kind, deviceId, exact) {
            const track = published.get(sourceFor(kind));
            // Nothing captured: the next capture reads the saved device.
            if (!track) return true;
            return track.setDeviceId(exact ? { exact: deviceId } : deviceId);
        },
        onPublished(cb) {
            publishedCbs.add(cb);
            return () => void publishedCbs.delete(cb);
        },
        onUnpublished(cb) {
            unpublishedCbs.add(cb);
            return () => void unpublishedCbs.delete(cb);
        },
        close() {
            for (const t of [...published.values()]) unpublish(t, true);
            publishedCbs.clear();
            unpublishedCbs.clear();
            void audioContext?.close().catch(() => {});
            audioContext = null;
        },
    };
    return self;
}

/** Our published tracks as the full mesh sends them (fullMesh/connection.ts). */
export function meshLocalMedia(
    lk: LivekitModule,
    publisher: LocalPublisher,
): MeshLocalMedia {
    const ids = new WeakMap<LocalTrack, string>();
    let nextId = 0;
    // Mic and camera play in sync; a share and its sound likewise.
    const userStream = new MediaStream();
    const shareStream = new MediaStream();
    const cbs = new Set<() => void>();
    const notify = () => {
        for (const cb of cbs) cb();
    };
    const trackEvents = [
        lk.TrackEvent.Muted,
        lk.TrackEvent.Unmuted,
        lk.TrackEvent.Restarted,
        lk.TrackEvent.TrackProcessorUpdate,
    ];
    const watched = new Set<LocalTrack>();
    const watch = (track: LocalTrack) => {
        if (watched.has(track)) return;
        watched.add(track);
        for (const ev of trackEvents) track.on(ev as never, notify as never);
    };
    const unwatch = (track: LocalTrack) => {
        if (!watched.delete(track)) return;
        for (const ev of trackEvents) track.off(ev as never, notify as never);
    };
    for (const t of publisher.tracks()) watch(t);
    publisher.onPublished((t) => {
        watch(t);
        notify();
    });
    publisher.onUnpublished((t) => {
        unwatch(t);
        notify();
    });
    return {
        publications(): MeshPublication[] {
            return publisher.tracks().map((track) => {
                let id = ids.get(track);
                if (!id) {
                    id = `local-${nextId++}`;
                    ids.set(track, id);
                }
                const share =
                    track.source === lk.Track.Source.ScreenShare ||
                    track.source === lk.Track.Source.ScreenShareAudio;
                return {
                    id,
                    kind:
                        track.kind === lk.Track.Kind.Audio ? "audio" : "video",
                    purpose: share ? "m.screenshare" : "m.usermedia",
                    track: track.mediaStreamTrack ?? null,
                    muted: track.isMuted,
                    stream: share ? shareStream : userStream,
                };
            });
        },
        onChange(cb) {
            cbs.add(cb);
            return () => void cbs.delete(cb);
        },
    };
}
