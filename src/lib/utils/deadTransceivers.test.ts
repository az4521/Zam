import { describe, expect, it } from "vitest";
import { deadTransceivers, type TransceiverLike } from "./deadTransceivers";

const track = {} as MediaStreamTrack;
function t(over: Partial<TransceiverLike>): TransceiverLike {
    return {
        mid: "1",
        direction: "inactive",
        currentDirection: "inactive",
        sender: { track: null },
        ...over,
    };
}

describe("deadTransceivers", () => {
    it("picks an emptied, negotiated-inactive transceiver", () => {
        const dead = t({});
        expect(deadTransceivers([dead])).toEqual([dead]);
        const recv = t({ direction: "recvonly", currentDirection: "recvonly" });
        expect(deadTransceivers([recv])).toEqual([recv]);
    });

    it("never picks one that still sends or has a track", () => {
        expect(deadTransceivers([t({ sender: { track } })])).toEqual([]);
        expect(
            deadTransceivers([
                t({ direction: "sendonly", currentDirection: "sendonly" }),
            ]),
        ).toEqual([]);
    });

    it("waits for the unpublish negotiation to finish", () => {
        // removeTrack done, answer not applied yet.
        expect(
            deadTransceivers([
                t({ direction: "inactive", currentDirection: "sendonly" }),
            ]),
        ).toEqual([]);
    });

    it("skips never-negotiated and already stopped transceivers", () => {
        expect(
            deadTransceivers([t({ mid: null, currentDirection: null })]),
        ).toEqual([]);
        expect(
            deadTransceivers([
                t({ direction: "stopped", currentDirection: "stopped" }),
            ]),
        ).toEqual([]);
    });
});
