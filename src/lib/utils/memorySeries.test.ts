import { describe, expect, it } from "vitest";
import {
    memorySeriesCsv,
    memorySeriesText,
    processKeys,
    summarizeMemorySeries,
    type MemorySample,
} from "./memorySeries";

const MB = 1048576;

describe("processKeys", () => {
    it("adds the pid only to names a sample has more than once", () => {
        expect(
            processKeys([
                {
                    pid: 1,
                    name: "GPU Process",
                    allocators: [],
                    workingSetKb: 1,
                },
                { pid: 2, name: "Renderer", allocators: [], workingSetKb: 1 },
                { pid: 3, name: "Renderer", allocators: [], workingSetKb: 1 },
            ]),
        ).toEqual(["GPU Process", "Renderer 2", "Renderer 3"]);
    });
});

describe("summarizeMemorySeries", () => {
    const samples: MemorySample[] = [
        {
            at: 0,
            processes: [
                {
                    pid: 10,
                    name: "GPU Process",
                    allocators: [["gpu", 100 * MB]],
                    workingSetKb: 200 * 1024,
                },
            ],
        },
        { at: 1000, error: "tracing busy" },
        {
            at: 2000,
            // Restarted under a new pid: still the same series.
            processes: [
                {
                    pid: 11,
                    name: "GPU Process",
                    allocators: [
                        ["gpu", 40 * MB],
                        ["skia", 60 * MB],
                    ],
                    workingSetKb: 50 * 1024,
                },
            ],
        },
        {
            at: 3000,
            processes: [
                {
                    pid: 11,
                    name: "GPU Process",
                    allocators: [["gpu", 70 * MB]],
                    workingSetKb: 90 * 1024,
                },
            ],
        },
    ];

    it("tracks first, min, max and last per process and allocator", () => {
        const [gpu] = summarizeMemorySeries(samples);
        expect(gpu.key).toBe("GPU Process");
        expect(gpu.workingSet).toEqual({
            first: 200 * MB,
            min: 50 * MB,
            max: 200 * MB,
            last: 90 * MB,
        });
        expect(gpu.allocators.map(([n]) => n)).toEqual(["gpu", "skia"]);
        expect(gpu.allocators[0][1]).toEqual({
            first: 100 * MB,
            min: 40 * MB,
            max: 100 * MB,
            last: 70 * MB,
        });
    });

    it("writes a text summary that counts failed samples", () => {
        const text = memorySeriesText(samples);
        expect(text).toContain("3 samples");
        expect(text).toContain("1 failed");
        expect(text).toMatch(
            /200\.0\s+50\.0\s+200\.0\s+90\.0\s+-110\.0 {2}\(working set\)/,
        );
    });

    it("writes one CSV row per sample, blank where a value is missing", () => {
        const lines = memorySeriesCsv(samples).trim().split("\n");
        expect(lines[0]).toBe(
            "time,GPU Process/working_set,GPU Process/gpu,GPU Process/skia",
        );
        expect(lines).toHaveLength(5);
        expect(lines[2].split(",").slice(1)).toEqual(["", "", ""]);
        expect(lines[3].split(",").slice(1)).toEqual([
            String(50 * MB),
            String(40 * MB),
            String(60 * MB),
        ]);
    });
});
