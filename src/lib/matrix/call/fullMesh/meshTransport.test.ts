import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** Every connection the transport made, in order. */
const made: {
    kind: "subscriber" | "publisher";
    rtcConfig: RTCConfiguration;
    everConnected: boolean;
    onEnded: (failed: boolean) => void;
}[] = [];

vi.mock("./signalling", () => ({
    createSignalling: () => ({ send: () => {}, close: () => {} }),
}));

vi.mock("./connection", () => {
    class Fake {
        everConnected = false;
        kind: "subscriber" | "publisher";
        rtcConfig: RTCConfiguration;
        onEnded: (failed: boolean) => void;
        constructor(
            kind: "subscriber" | "publisher",
            opts: {
                rtcConfig: RTCConfiguration;
                onEnded: (failed: boolean) => void;
            },
        ) {
            this.kind = kind;
            this.rtcConfig = opts.rtcConfig;
            this.onEnded = opts.onEnded;
            made.push(this);
        }
        close() {}
        remoteDataTracks() {
            return [];
        }
    }
    return {
        SubscriberConnection: class extends Fake {
            constructor(opts: never) {
                super("subscriber", opts);
            }
        },
        PublisherConnection: class extends Fake {
            constructor(opts: never) {
                super("publisher", opts);
            }
        },
        sourceOf: () => "microphone",
    };
});

const { FullMeshTransport } = await import("./meshTransport");

const RELAY: RTCConfiguration = {
    iceServers: [{ urls: "turn:hs.example" }],
    iceTransportPolicy: "relay",
};
const DIRECT: RTCConfiguration = { iceServers: [{ urls: "turn:hs.example" }] };

const peer = {
    userId: "@b:example",
    deviceId: "B",
    memberId: "@b:example:B",
};

function transport(rtcConfig: (direct: boolean) => Promise<RTCConfiguration>) {
    const connectionFailed = vi.fn();
    const t = new FullMeshTransport({
        client: {} as never,
        roomId: "!r:example",
        slotId: "slot",
        own: { userId: "@a:example", deviceId: "A", memberId: "@a:example:A" },
        listener: {
            audioSubscribed() {},
            audioUnsubscribed() {},
            videoSubscribed() {},
            changed() {},
            speakers() {},
            data() {},
            dataTrackPublished() {},
            dataTrackUnpublished() {},
            connectionFailed,
        },
        local: null,
        rtcConfig,
    });
    return { t, connectionFailed };
}

describe("relay to direct fallback", () => {
    beforeEach(() => {
        made.length = 0;
        vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it("retries a peer directly after a relayed connection never came up", async () => {
        const rtcConfig = vi.fn(async (direct: boolean) =>
            direct ? DIRECT : RELAY,
        );
        const { t, connectionFailed } = transport(rtcConfig);
        t.setMembers([{ ...peer, subscribe: true }]);
        await vi.advanceTimersByTimeAsync(0);
        expect(made).toHaveLength(1);
        expect(made[0].rtcConfig).toBe(RELAY);

        made[0].onEnded(true);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(made).toHaveLength(2);
        expect(made[1].rtcConfig).toBe(DIRECT);
        // The relay failing is no reason to tell the user yet.
        expect(connectionFailed).not.toHaveBeenCalled();

        // The direct attempt failing is.
        made[1].onEnded(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(connectionFailed).toHaveBeenCalledTimes(1);
        await t.close();
    });

    it("stays relayed when the relay is required", async () => {
        // A required relay: the direct config is the relayed one.
        const { t, connectionFailed } = transport(async () => RELAY);
        t.setMembers([{ ...peer, subscribe: true }]);
        await vi.advanceTimersByTimeAsync(0);
        made[0].onEnded(true);
        await vi.advanceTimersByTimeAsync(0);
        expect(connectionFailed).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(made[1].rtcConfig).toBe(RELAY);
        await t.close();
    });

    it("doesn't fall back after a relayed connection that worked drops", async () => {
        const { t } = transport(async (direct) => (direct ? DIRECT : RELAY));
        t.setMembers([{ ...peer, subscribe: true }]);
        await vi.advanceTimersByTimeAsync(0);
        made[0].everConnected = true;
        made[0].onEnded(true);
        await vi.advanceTimersByTimeAsync(1_000);
        expect(made[1].rtcConfig).toBe(RELAY);
        await t.close();
    });
});
