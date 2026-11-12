import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PublisherConnection, type MeshPublication } from "./connection";
import type { Signalling } from "./signalling";
import type { SignallingPayload } from "./protocol";

// Just enough of RTCPeerConnection for the publisher's negotiation logic.
class FakeChannel extends EventTarget {
    readyState: RTCDataChannelState = "connecting";
    sent: string[] = [];
    constructor(readonly label: string) {
        super();
    }
    send(data: string) {
        this.sent.push(data);
    }
    close() {
        this.readyState = "closed";
    }
    open() {
        this.readyState = "open";
        this.dispatchEvent(new Event("open"));
    }
}

class FakeTransceiver {
    mid: string | null = null;
    sender = {
        replaceTrack: async () => {},
        getParameters: () => ({ encodings: [{}] }),
        setParameters: async () => {},
    };
    stop() {}
}

class FakePC extends EventTarget {
    static last: FakePC;
    signalingState: RTCSignalingState = "stable";
    connectionState: RTCPeerConnectionState = "new";
    localDescription: RTCSessionDescriptionInit | null = null;
    channels: FakeChannel[] = [];
    transceivers: FakeTransceiver[] = [];
    private nextMid = 0;
    constructor() {
        super();
        FakePC.last = this;
    }
    createDataChannel(label: string) {
        const channel = new FakeChannel(label);
        this.channels.push(channel);
        return channel;
    }
    addTransceiver() {
        const t = new FakeTransceiver();
        this.transceivers.push(t);
        return t;
    }
    async createOffer() {
        return { type: "offer" as const, sdp: "v=0" };
    }
    async setLocalDescription(d: RTCSessionDescriptionInit) {
        for (const t of this.transceivers)
            if (t.mid === null) t.mid = String(this.nextMid++);
        this.localDescription = d;
        this.signalingState = "have-local-offer";
    }
    async setRemoteDescription() {
        this.signalingState = "stable";
    }
    async addIceCandidate() {}
    close() {}
}

function publication(
    id: string,
    kind: "audio" | "video",
    purpose: "m.usermedia" | "m.screenshare",
    muted = false,
): MeshPublication {
    return {
        id,
        kind,
        purpose,
        muted,
        track: null,
        stream: {} as MediaStream,
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("PublisherConnection", () => {
    beforeEach(() => {
        vi.stubGlobal("RTCPeerConnection", FakePC);
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("doesn't send track metadata at the switch that an offer made out of date", async () => {
        let publications = [
            publication("mic", "audio", "m.usermedia"),
            publication("cam", "video", "m.usermedia"),
        ];
        let notify = () => {};
        const sent: SignallingPayload[] = [];
        const signalling: Signalling = {
            send: (_peer, _id, payload) => void sent.push(payload),
            dispose() {},
        };
        const connection = new PublisherConnection(
            {
                peer: { userId: "@b:x", deviceId: "B", memberId: "b" },
                connectionId: "c",
                signalling,
                rtcConfig: {},
                onEnded: () => {},
            },
            {
                publications: () => publications,
                onChange(cb) {
                    notify = cb;
                    return () => {};
                },
            },
            [],
        );
        const pc = FakePC.last;
        const control = pc.channels[0];
        const answer = () =>
            connection.receive({
                type: "description",
                description: { type: "answer", sdp: "v=0" },
            });

        await flush();
        answer();
        await flush();

        // Camera muted before the channel is up: held for the switch.
        publications = [publications[0], { ...publications[1], muted: true }];
        notify();
        // Then a screenshare: a new offer carrying all three tracks.
        publications = [
            ...publications,
            publication("screen", "video", "m.screenshare"),
        ];
        notify();
        await flush();
        const offers = sent.filter(
            (p) => p.type === "description" && p.description.type === "offer",
        );
        expect(offers).toHaveLength(2);
        const latest = offers[1] as Extract<
            SignallingPayload,
            { type: "description" }
        >;
        expect(Object.keys(latest.track_metadata ?? {})).toEqual([
            "0",
            "1",
            "2",
        ]);
        expect(latest.track_metadata?.["1"].muted).toBe(true);

        control.open();
        answer();
        await flush();

        // Nothing sent at the switch may drop the screenshare's metadata.
        for (const raw of control.sent) {
            const message = JSON.parse(raw);
            if (message.type === "track_metadata")
                expect(message.track_metadata).toHaveProperty("2");
        }
        connection.close(undefined, false);
    });

    it("sends a mute held before the switch when no offer replaced it", async () => {
        let publications = [publication("cam", "video", "m.usermedia")];
        let notify = () => {};
        const connection = new PublisherConnection(
            {
                peer: { userId: "@b:x", deviceId: "B", memberId: "b" },
                connectionId: "c",
                signalling: { send() {}, dispose() {} },
                rtcConfig: {},
                onEnded: () => {},
            },
            {
                publications: () => publications,
                onChange(cb) {
                    notify = cb;
                    return () => {};
                },
            },
            [],
        );
        const control = FakePC.last.channels[0];
        await flush();
        connection.receive({
            type: "description",
            description: { type: "answer", sdp: "v=0" },
        });
        await flush();
        publications = [{ ...publications[0], muted: true }];
        notify();
        control.open();
        const sent = control.sent.map((raw) => JSON.parse(raw));
        expect(sent).toEqual([
            {
                type: "track_metadata",
                track_metadata: {
                    "0": { purpose: "m.usermedia", muted: true },
                },
            },
        ]);
        connection.close(undefined, false);
    });
});
