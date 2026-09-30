import { describe, expect, it } from "vitest";
import { isMidiAttachment, parseMidi } from "./midi";

/** Build a format-0 SMF from raw track bytes (after the MTrk header). */
function smf(track: number[], division = 96): Uint8Array {
    const header = [
        0x4d,
        0x54,
        0x68,
        0x64,
        0,
        0,
        0,
        6,
        0,
        0,
        0,
        1,
        division >> 8,
        division & 0xff,
    ];
    const len = track.length;
    return new Uint8Array([
        ...header,
        0x4d,
        0x54,
        0x72,
        0x6b,
        (len >>> 24) & 0xff,
        (len >>> 16) & 0xff,
        (len >>> 8) & 0xff,
        len & 0xff,
        ...track,
    ]);
}

describe("isMidiAttachment", () => {
    it("matches MIDI mimetypes and extensions", () => {
        expect(isMidiAttachment("audio/midi", null)).toBe(true);
        expect(isMidiAttachment("audio/x-midi; foo=bar", null)).toBe(true);
        expect(isMidiAttachment("application/octet-stream", "Song.MID")).toBe(
            true,
        );
        expect(isMidiAttachment(undefined, "tune.midi")).toBe(true);
        expect(isMidiAttachment("audio/mpeg", "song.mp3")).toBe(false);
        expect(isMidiAttachment(undefined, "midi.txt")).toBe(false);
    });
});

describe("parseMidi", () => {
    it("rejects non-MIDI data", () => {
        expect(() => parseMidi(new Uint8Array([1, 2, 3]))).toThrow();
    });

    it("converts ticks to seconds and honours tempo changes", () => {
        const song = parseMidi(
            smf([
                0x00,
                0x90,
                60,
                100, // note on @0
                0x60,
                0x80,
                60,
                0, // note off @96 ticks = 0.5s at 120bpm
                0x00,
                0xff,
                0x51,
                0x03,
                0x0f,
                0x42,
                0x40, // tempo 1,000,000us/q
                0x60,
                0x90,
                62,
                80, // note on @ +96 ticks = +1s
                0x00,
                62,
                0, // running status, vel 0 = note off
                0x00,
                0xff,
                0x2f,
                0x00,
            ]),
        );
        expect(song.events).toEqual([
            { time: 0, kind: "noteOn", channel: 0, note: 60, velocity: 100 },
            { time: 0.5, kind: "noteOff", channel: 0, note: 60 },
            { time: 1.5, kind: "noteOn", channel: 0, note: 62, velocity: 80 },
            { time: 1.5, kind: "noteOff", channel: 0, note: 62 },
        ]);
        expect(song.duration).toBe(1.5);
    });

    it("parses program, controller and pitch-bend events", () => {
        const song = parseMidi(
            smf([
                0x00,
                0xc3,
                25,
                0x00,
                0xb3,
                7,
                90,
                0x00,
                0xe3,
                0x00,
                0x60,
                0x00,
                0xf0,
                0x02,
                0x7e,
                0xf7, // sysex is skipped
            ]),
        );
        expect(song.events.map(({ time: _t, ...e }) => e)).toEqual([
            { kind: "program", channel: 3, program: 25 },
            { kind: "cc", channel: 3, controller: 7, value: 90 },
            { kind: "bend", channel: 3, value: 0x60 << 7 },
        ]);
    });
});
