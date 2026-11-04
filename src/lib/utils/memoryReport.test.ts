import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { summarizeMemoryTrace } = require("../../../electron/memoryReport.cjs");

const MB = 1048576;
const size = (bytes: number) => ({
    attrs: {
        size: { type: "scalar", units: "bytes", value: bytes.toString(16) },
    },
});

describe("summarizeMemoryTrace", () => {
    it("uses the last dump, merging each process's events, two levels deep", () => {
        const events = [
            {
                ph: "M",
                name: "process_name",
                pid: 1,
                args: { name: "GPU Process" },
            },
            {
                ph: "v",
                id: "a",
                pid: 1,
                args: { dumps: { allocators: { gpu: size(999 * MB) } } },
            },
            {
                ph: "v",
                id: "b",
                pid: 1,
                args: {
                    dumps: {
                        allocators: {
                            gpu: size(40 * MB),
                            "gpu/shared_images": size(30 * MB),
                        },
                    },
                },
            },
            {
                ph: "v",
                id: "b",
                pid: 1,
                args: {
                    dumps: {
                        allocators: {
                            "gpu/shared_images/client_0": size(30 * MB),
                            "global/abc": size(50 * MB),
                            skia: size(100 * 1024),
                            malloc: size(60 * MB),
                        },
                    },
                },
            },
        ];
        expect(summarizeMemoryTrace(events)).toEqual([
            {
                pid: 1,
                name: "GPU Process",
                allocators: [
                    ["malloc", 60 * MB],
                    ["gpu", 40 * MB],
                    ["gpu/shared_images", 30 * MB],
                ],
            },
        ]);
    });

    it("returns nothing without dumps", () => {
        expect(summarizeMemoryTrace([])).toEqual([]);
    });
});
