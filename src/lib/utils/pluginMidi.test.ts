import { describe, expect, it } from "vitest";
import {
    applyChannelMessage,
    checkChannelMessage,
    type ChannelSynth,
} from "$lib/workers/midiPlayer.messages";

/** Records every synth call as [method, ...args]. */
function fakeSynth(): { synth: ChannelSynth; calls: unknown[][] } {
    const calls: unknown[][] = [];
    const record =
        (name: string) =>
        (...args: number[]) => {
            calls.push([name, ...args]);
        };
    const synth: ChannelSynth = {
        noteOn: record("noteOn"),
        noteOff: record("noteOff"),
        polyPressure: record("polyPressure"),
        channelPressure: record("channelPressure"),
        controllerChange: record("controllerChange"),
        programChange: record("programChange"),
        pitchWheel: record("pitchWheel"),
    };
    return { synth, calls };
}

describe("checkChannelMessage", () => {
    it("accepts channel voice statuses with 7-bit data", () => {
        expect(() => checkChannelMessage(0x80, 0, 0)).not.toThrow();
        expect(() => checkChannelMessage(0xef, 127, 127)).not.toThrow();
        expect(() => checkChannelMessage(0x90, 60, 100)).not.toThrow();
    });

    it("rejects statuses outside 0x80-0xEF", () => {
        expect(() => checkChannelMessage(0x7f, 0, 0)).toThrow(RangeError);
        expect(() => checkChannelMessage(0xf0, 0, 0)).toThrow(RangeError);
        expect(() => checkChannelMessage(-1, 0, 0)).toThrow(RangeError);
        expect(() => checkChannelMessage(144.5, 0, 0)).toThrow(RangeError);
        expect(() => checkChannelMessage(NaN, 0, 0)).toThrow(RangeError);
    });

    it("rejects data bytes outside 0-127 or not integers", () => {
        expect(() => checkChannelMessage(0x90, 128, 0)).toThrow(RangeError);
        expect(() => checkChannelMessage(0x90, -1, 0)).toThrow(RangeError);
        expect(() => checkChannelMessage(0x90, 0, 128)).toThrow(RangeError);
        expect(() => checkChannelMessage(0x90, 60.5, 0)).toThrow(RangeError);
        expect(() => checkChannelMessage(0xc0, 5, Infinity)).toThrow(
            RangeError,
        );
    });
});

describe("applyChannelMessage", () => {
    it("maps note on and note off", () => {
        const { synth, calls } = fakeSynth();
        applyChannelMessage(synth, 0x92, 60, 100);
        applyChannelMessage(synth, 0x82, 60, 40);
        expect(calls).toEqual([
            ["noteOn", 2, 60, 100],
            ["noteOff", 2, 60],
        ]);
    });

    it("treats note on with velocity 0 as note off", () => {
        const { synth, calls } = fakeSynth();
        applyChannelMessage(synth, 0x90, 64, 0);
        expect(calls).toEqual([["noteOff", 0, 64]]);
    });

    it("maps poly and channel pressure", () => {
        const { synth, calls } = fakeSynth();
        applyChannelMessage(synth, 0xa5, 48, 20);
        applyChannelMessage(synth, 0xdf, 99, 0);
        expect(calls).toEqual([
            ["polyPressure", 5, 48, 20],
            ["channelPressure", 15, 99],
        ]);
    });

    it("maps control change and program change, ignoring data2 on program change", () => {
        const { synth, calls } = fakeSynth();
        applyChannelMessage(synth, 0xb1, 7, 90);
        applyChannelMessage(synth, 0xc1, 24, 0);
        expect(calls).toEqual([
            ["controllerChange", 1, 7, 90],
            ["programChange", 1, 24],
        ]);
    });

    it("maps pitch bend with data1 as LSB and data2 as MSB", () => {
        const { synth, calls } = fakeSynth();
        // Centre: LSB 0, MSB 64 is 8192.
        applyChannelMessage(synth, 0xe0, 0, 64);
        // Full bend up: LSB 127, MSB 127 is 16383.
        applyChannelMessage(synth, 0xe3, 127, 127);
        // Bend down by one step: LSB 1, MSB 63 is 8065.
        applyChannelMessage(synth, 0xe0, 1, 63);
        expect(calls).toEqual([
            ["pitchWheel", 0, 8192],
            ["pitchWheel", 3, 16383],
            ["pitchWheel", 0, 8065],
        ]);
    });

    it("ignores statuses outside the channel voice range", () => {
        const { synth, calls } = fakeSynth();
        applyChannelMessage(synth, 0xf8, 0, 0);
        applyChannelMessage(synth, 0x40, 0, 0);
        expect(calls).toEqual([]);
    });
});
