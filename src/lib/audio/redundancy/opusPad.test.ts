import { describe, expect, it } from "vitest";
import { extractRedundancy, packetSamples, withRedundancy } from "./opusPad";

// config 15 (hybrid FB 20 ms) is irrelevant here; use CELT FB 20 ms: 31 << 3.
const TOC_20MS = 31 << 3;

function pkt(len: number, seed: number): Uint8Array {
    const p = new Uint8Array(len);
    p[0] = TOC_20MS;
    for (let i = 1; i < len; i++) p[i] = (seed * 31 + i * 7) & 0xff;
    return p;
}

describe("packetSamples", () => {
    it("reads the frame size from the TOC", () => {
        expect(packetSamples(Uint8Array.of(31 << 3))).toBe(960);
        expect(packetSamples(Uint8Array.of(28 << 3))).toBe(120);
        expect(packetSamples(Uint8Array.of(1 << 3))).toBe(960);
        expect(packetSamples(Uint8Array.of(3 << 3))).toBe(2880);
        expect(packetSamples(Uint8Array.of(15 << 3))).toBe(960);
    });

    it("counts every frame in code 1 and code 2 packets", () => {
        expect(packetSamples(Uint8Array.of((31 << 3) | 1, 0, 0))).toBe(1920);
        expect(packetSamples(Uint8Array.of((31 << 3) | 2, 1, 0, 0))).toBe(1920);
    });

    it("counts the frames a code 3 packet signals", () => {
        // CBR, no padding, three 20 ms frames.
        expect(packetSamples(Uint8Array.of((31 << 3) | 3, 3, 0, 0, 0))).toBe(
            2880,
        );
        // With padding: the padding length byte does not add audio.
        expect(
            packetSamples(Uint8Array.of((31 << 3) | 3, 0x42, 1, 0, 0, 0)),
        ).toBe(1920);
        // The longest valid packet: 48 CELT 2.5 ms frames (120 ms).
        expect(packetSamples(Uint8Array.of((16 << 3) | 3, 48))).toBe(5760);
    });

    it("reports 0 for impossible frame counts", () => {
        expect(packetSamples(Uint8Array.of((31 << 3) | 3, 0))).toBe(0);
        // 7 x 20 ms is 140 ms.
        expect(packetSamples(Uint8Array.of((31 << 3) | 3, 7))).toBe(0);
        expect(packetSamples(Uint8Array.of((16 << 3) | 3, 49))).toBe(0);
        expect(packetSamples(Uint8Array.of((31 << 3) | 3))).toBe(0);
    });
});

describe("withRedundancy / extractRedundancy", () => {
    it("round-trips the packet and its copies", () => {
        const cur = pkt(80, 1);
        const copies = [pkt(70, 2), pkt(90, 3)];
        const packed = withRedundancy(cur, copies);
        expect(packed.length).toBeGreaterThan(cur.length + 160);
        const got = extractRedundancy(packed)!;
        expect(got.primary).toEqual(cur);
        expect(got.copies).toEqual(copies);
    });

    it("produces a code-3 packet whose padding length adds up", () => {
        const packed = withRedundancy(pkt(60, 1), [pkt(60, 2)]);
        expect(packed[0] & 3).toBe(3);
        expect(packed[1]).toBe(0x41);
        // 3 header bytes + 1 length + 60 copy = 64 padding bytes.
        expect(packed[2]).toBe(64);
        expect(packed.length).toBe(2 + 1 + 59 + 64);
    });

    it("handles padding of 255 bytes or more", () => {
        const copies = [pkt(200, 2), pkt(120, 3)];
        const packed = withRedundancy(pkt(50, 1), copies);
        expect(packed[2]).toBe(255);
        const got = extractRedundancy(packed)!;
        expect(got.copies).toEqual(copies);
        expect(got.primary).toEqual(pkt(50, 1));
    });

    it("leaves tiny (DTX) and non-single-frame packets alone", () => {
        const dtx = Uint8Array.of(TOC_20MS, 0);
        expect(withRedundancy(dtx, [pkt(60, 2)])).toBe(dtx);
        const two = pkt(60, 1);
        two[0] |= 1;
        expect(withRedundancy(two, [pkt(60, 2)])).toBe(two);
    });

    it("without usable copies returns the packet itself", () => {
        const cur = pkt(60, 1);
        expect(withRedundancy(cur, [])).toBe(cur);
        expect(withRedundancy(cur, [pkt(300, 2)])).toBe(cur);
    });

    it("ignores ordinary packets and damaged ones", () => {
        expect(extractRedundancy(pkt(60, 1))).toBeNull();
        const packed = withRedundancy(pkt(60, 1), [pkt(60, 2)]);
        expect(
            extractRedundancy(packed.slice(0, packed.length - 10)),
        ).toBeNull();
        const bad = packed.slice();
        bad[bad.length - 64] = 0; // the first magic byte
        expect(extractRedundancy(bad)).toBeNull();
    });
});
