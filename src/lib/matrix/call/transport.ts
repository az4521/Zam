/**
 * What a call needs from the thing that carries its media, whatever that is:
 * a LiveKit SFU (livekitTransport.ts) or direct peer connections
 * (fullMesh/meshTransport.ts). livekitCall.ts owns the call (local media,
 * playback, the UI's views) and talks to every transport of a call through
 * these two interfaces only:
 *
 * - `CallTransport`: media and data we receive. A call has several: the SFU
 *   we publish on, listen-only SFUs of other homeservers, and the mesh.
 * - `CallDataPublisher`: data we send. Media we send goes through
 *   `LocalPublisher` (localPublisher.ts), which every transport reads.
 *
 * No LiveKit import here: the mesh transport must not pull in the SDK.
 */
import type {
    PluginLocalTrackLike,
    PluginRemoteTrackLike,
    PluginRoomLike,
} from "../callPluginData";

/** What a track carries, in the call's terms. */
export type CallSource =
    "microphone" | "camera" | "screen_share" | "screen_share_audio" | "unknown";

/** A track a media element can play: LiveKit's tracks, and the mesh's
 *  (fullMesh/remoteTrack.ts), have the same two methods. */
export interface AttachableTrack {
    attach(element: HTMLMediaElement): HTMLMediaElement;
    detach(element: HTMLMediaElement): HTMLMediaElement;
}

export interface RemoteTrackView {
    readonly kind: "audio" | "video";
    readonly source: CallSource;
    /** Muted on purpose by its publisher. */
    readonly muted: boolean;
    /** Null until subscribed. */
    readonly track: AttachableTrack | null;
    /** Nothing arrives for now (an SFU pause), though it is published. */
    readonly paused: boolean;
    /** Whether we want it: false stops video we hide. */
    setEnabled(enabled: boolean): void;
}

export interface RemoteParticipantView {
    /** "@user:server:DEVICE", the member id of a legacy membership. */
    readonly identity: string;
    readonly tracks: readonly RemoteTrackView[];
}

/** What a transport tells the call. Every callback may be called at any
 *  time after `attach`, until `close` resolves. */
export interface CallTransportListener {
    /** A remote audio track can be played. */
    audioSubscribed(
        track: AttachableTrack,
        source: CallSource,
        identity: string,
    ): void;
    audioUnsubscribed(track: AttachableTrack): void;
    /** A remote video track arrived (to apply per-user hiding). */
    videoSubscribed(view: RemoteTrackView, identity: string): void;
    /** Participants, tracks, mutes or pauses changed: views recompute. */
    changed(): void;
    /** Who speaks now, among this transport's participants. */
    speakers(identities: string[]): void;
    data(
        payload: Uint8Array,
        identity: string,
        topic: string | undefined,
    ): void;
    dataTrackPublished(
        room: PluginRoomLike,
        track: PluginRemoteTrackLike,
    ): void;
    dataTrackUnpublished(sid: string): void;
    /** A direct connection to someone failed without ever coming up. */
    connectionFailed?(identity: string): void;
}

export interface CallTransport {
    readonly kind: "livekit" | "full_mesh";
    /** Plugin data tracks are registered per room. */
    readonly pluginRoom: PluginRoomLike;
    participants(): RemoteParticipantView[];
    /** Whether the browser refused to start its audio (autoplay). */
    readonly playbackBlocked: boolean;
    /** Ask again to play audio, from a user gesture. */
    startAudio(): Promise<void>;
    close(): Promise<void>;
}

export interface PublishDataOptions {
    reliable: boolean;
    topic?: string;
    /** Only these identities; everyone subscribed when absent. */
    destinationIdentities?: string[];
}

/** Data we send, to whoever receives our media through it. */
export interface CallDataPublisher {
    /** Identities that receive what we publish. */
    subscriberIdentities(): string[];
    publishData(payload: Uint8Array, opts: PublishDataOptions): Promise<void>;
    publishDataTrack(name: string): Promise<PluginLocalTrackLike>;
}
