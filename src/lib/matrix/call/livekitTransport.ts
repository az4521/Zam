/**
 * A LiveKit room (an SFU connection, publishing or listen-only) as a
 * CallTransport: its participants and events in the call's terms. What only
 * LiveKit has (E2EE errors, codec attributes, reconnects) stays in
 * livekitCall.ts, which holds the room as well.
 */
import type * as LivekitClient from "livekit-client";
import type {
    CallSource,
    CallTransport,
    CallTransportListener,
    RemoteParticipantView,
    RemoteTrackView,
} from "./transport";

type LivekitModule = typeof import("livekit-client");

export interface LivekitCallTransport extends CallTransport {
    readonly kind: "livekit";
    readonly room: LivekitClient.Room;
}

export function livekitSourceOf(
    lk: LivekitModule,
    source: LivekitClient.Track.Source,
): CallSource {
    switch (source) {
        case lk.Track.Source.Microphone:
            return "microphone";
        case lk.Track.Source.Camera:
            return "camera";
        case lk.Track.Source.ScreenShare:
            return "screen_share";
        case lk.Track.Source.ScreenShareAudio:
            return "screen_share_audio";
        default:
            return "unknown";
    }
}

export function livekitTransport(
    lk: LivekitModule,
    room: LivekitClient.Room,
    listener: CallTransportListener,
): LivekitCallTransport {
    const E = lk.RoomEvent;
    const viewOf = (
        pub: LivekitClient.RemoteTrackPublication,
    ): RemoteTrackView => ({
        kind: pub.kind === lk.Track.Kind.Audio ? "audio" : "video",
        source: livekitSourceOf(lk, pub.source),
        muted: pub.isMuted,
        track: pub.track ?? null,
        paused: pub.track?.streamState === lk.Track.StreamState.Paused,
        setEnabled: (enabled) => pub.setEnabled(enabled),
    });
    room.on(E.TrackSubscribed, (track, pub, participant) => {
        if (track.kind === lk.Track.Kind.Video)
            listener.videoSubscribed(viewOf(pub), participant.identity);
        else if (track.kind === lk.Track.Kind.Audio)
            listener.audioSubscribed(
                track,
                livekitSourceOf(lk, pub.source),
                participant.identity,
            );
        listener.changed();
    });
    room.on(E.TrackUnsubscribed, (track) => {
        if (track.kind === lk.Track.Kind.Audio)
            listener.audioUnsubscribed(track);
        listener.changed();
    });
    room.on(E.ActiveSpeakersChanged, (speakers) =>
        listener.speakers(speakers.map((p) => p.identity)),
    );
    // A participant arriving already muted fires no mute event, and one
    // without a mic has no track to fire it about. A stopped share can
    // arrive as a bare unpublish or an SFU pause.
    const changed = () => listener.changed();
    for (const ev of [
        E.TrackMuted,
        E.TrackUnmuted,
        E.TrackPublished,
        E.TrackUnpublished,
        E.TrackStreamStateChanged,
        E.ParticipantConnected,
        E.ParticipantDisconnected,
    ])
        room.on(ev as never, changed as never);
    room.on(E.DataTrackPublished, (track: LivekitClient.RemoteDataTrack) =>
        listener.dataTrackPublished(room, track),
    );
    room.on(E.DataTrackUnpublished, (sid: string) =>
        listener.dataTrackUnpublished(sid),
    );
    room.on(
        E.DataReceived,
        (
            payload: Uint8Array,
            participant?: LivekitClient.RemoteParticipant,
            _kind?: unknown,
            topic?: string,
        ) => {
            if (participant)
                listener.data(payload, participant.identity, topic);
        },
    );
    return {
        kind: "livekit",
        room,
        pluginRoom: room,
        participants: (): RemoteParticipantView[] =>
            [...room.remoteParticipants.values()].map((p) => ({
                identity: p.identity,
                tracks: [...p.trackPublications.values()].map(viewOf),
            })),
        get playbackBlocked() {
            return !room.canPlaybackAudio;
        },
        startAudio: () => room.startAudio(),
        close: () => room.disconnect(),
    };
}
