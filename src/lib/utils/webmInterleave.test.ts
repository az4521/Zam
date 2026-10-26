import { describe, it, expect } from "vitest";
import { WebmInterleaver } from "./webmInterleave";

const HEADER = [
    ...[0x1a, 0x45, 0xdf, 0xa3, 0x80],
    ...[0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
    ...[0x16, 0x54, 0xae, 0x6b, 0x80],
];
const UNKNOWN = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

/** A SimpleBlock for track 1 or 2 at `ms` past its Cluster. */
const block = (track: number, ms: number) => [
    ...[0xa3, 0x85, 0x80 | track, ms >> 8, ms & 0xff, 0x80, track],
];
/** A BlockGroup holding a Block, as some muxers write audio. */
const group = (track: number, ms: number) => [
    ...[0xa0, 0x87, 0xa1, 0x85, 0x80 | track, ms >> 8, ms & 0xff, 0, track],
];

function cluster(ms: number, children: number[][], sized = true): number[] {
    const body = [0xe7, 0x82, ms >> 8, ms & 0xff, ...children.flat()];
    return [
        ...[0x1f, 0x43, 0xb6, 0x75],
        ...(sized ? [0x40 | (body.length >> 8), body.length & 0xff] : UNKNOWN),
        ...body,
    ];
}

function run(bytes: number[], chunk: number): number[] {
    const sorter = new WebmInterleaver();
    const input = Uint8Array.from(bytes);
    const out: number[] = [];
    for (let i = 0; i < input.length; i += chunk)
        for (const o of sorter.push(input.slice(i, i + chunk))) out.push(...o);
    for (const o of sorter.end()) out.push(...o);
    return out;
}

describe("WebmInterleaver", () => {
    it("sorts a Cluster's blocks by time, keeping each track's order", () => {
        for (const sized of [true, false]) {
            const file = [
                ...HEADER,
                ...cluster(
                    0,
                    [block(2, 0), block(1, 0), block(2, 101), block(1, 100)],
                    sized,
                ),
                ...cluster(1000, [group(2, 5), block(1, 0)], sized),
            ];
            const want = [
                ...HEADER,
                ...cluster(
                    0,
                    [block(2, 0), block(1, 0), block(1, 100), block(2, 101)],
                    sized,
                ),
                ...cluster(1000, [block(1, 0), group(2, 5)], sized),
            ];
            for (const chunk of [1, 3, 17, file.length])
                expect(run(file, chunk)).toEqual(want);
        }
    });

    it("passes ordered Clusters and other elements through untouched", () => {
        const cues = [0x1c, 0x53, 0xbb, 0x6b, 0x84, 9, 9, 9, 9];
        const file = [
            ...HEADER,
            ...cluster(0, [block(1, 0), block(2, 0), block(1, 33)]),
            ...cues,
        ];
        for (const chunk of [1, 6, file.length])
            expect(run(file, chunk)).toEqual(file);
    });

    it("gives up on what it can't walk, losing nothing", () => {
        const file = [
            ...HEADER,
            ...cluster(0, [block(1, 0)]),
            0,
            0,
            0,
            ...Array(20).fill(7),
        ];
        expect(run(file, 5)).toEqual(file);
    });
});
