import { describe, it, expect } from "vitest";
import {
    SHARE_MAX_FILES,
    SHARE_MAX_FILE_BYTES,
    SHARE_MAX_TOTAL_BYTES,
    isShareTargetPost,
    limitShareFiles,
} from "./shareTargetGuard";

describe("isShareTargetPost", () => {
    const ORIGIN = "https://chat.example.org";

    it("accepts a valid share-target POST with navigate mode", () => {
        expect(
            isShareTargetPost(
                {
                    method: "POST",
                    url: "https://chat.example.org/share-target",
                    mode: "navigate",
                },
                ORIGIN,
            ),
        ).toBe(true);
    });

    it("rejects a GET to /share-target", () => {
        expect(
            isShareTargetPost(
                {
                    method: "GET",
                    url: "https://chat.example.org/share-target",
                    mode: "navigate",
                },
                ORIGIN,
            ),
        ).toBe(false);
    });

    it("rejects a cross-origin POST", () => {
        expect(
            isShareTargetPost(
                {
                    method: "POST",
                    url: "https://attacker.example/share-target",
                    mode: "navigate",
                },
                ORIGIN,
            ),
        ).toBe(false);
    });

    it("rejects a same-origin POST with mode cors", () => {
        expect(
            isShareTargetPost(
                {
                    method: "POST",
                    url: "https://chat.example.org/share-target",
                    mode: "cors",
                },
                ORIGIN,
            ),
        ).toBe(false);
    });

    it("rejects a same-origin POST with mode no-cors", () => {
        expect(
            isShareTargetPost(
                {
                    method: "POST",
                    url: "https://chat.example.org/share-target",
                    mode: "no-cors",
                },
                ORIGIN,
            ),
        ).toBe(false);
    });

    it("rejects a same-origin POST to a different path", () => {
        expect(
            isShareTargetPost(
                {
                    method: "POST",
                    url: "https://chat.example.org/other-path",
                    mode: "navigate",
                },
                ORIGIN,
            ),
        ).toBe(false);
    });

    it("rejects a malformed URL", () => {
        expect(
            isShareTargetPost(
                {
                    method: "POST",
                    url: "not a url",
                    mode: "navigate",
                },
                ORIGIN,
            ),
        ).toBe(false);
    });
});

describe("limitShareFiles", () => {
    function file(size: number) {
        return { size };
    }

    it("keeps all files when under all limits", () => {
        const files = [file(1000), file(2000), file(3000)];
        expect(limitShareFiles(files)).toEqual({
            kept: files,
            dropped: 0,
        });
    });

    it("drops files beyond the count limit (21 files → 20 kept, 1 dropped)", () => {
        const files = Array.from({ length: 21 }, (_, i) => file(100 + i));
        const result = limitShareFiles(files);
        expect(result.kept).toHaveLength(20);
        expect(result.dropped).toBe(1);
        expect(result.kept).toEqual(files.slice(0, 20));
    });

    it("drops a single file that exceeds the per-file limit", () => {
        const oversized = file(SHARE_MAX_FILE_BYTES + 1);
        const small = file(100);
        const result = limitShareFiles([oversized, small]);
        expect(result.kept).toEqual([small]);
        expect(result.dropped).toBe(1);
    });

    it("drops files that would exceed the total size limit", () => {
        const files = [
            file(90 * 1024 * 1024),
            file(90 * 1024 * 1024),
            file(90 * 1024 * 1024),
        ];
        const result = limitShareFiles(files);
        // First two fit (180 MB), third would exceed 200 MB
        expect(result.kept).toHaveLength(2);
        expect(result.dropped).toBe(1);
    });

    it("keeps a file that is exactly at the per-file limit", () => {
        const exact = file(SHARE_MAX_FILE_BYTES);
        expect(limitShareFiles([exact])).toEqual({
            kept: [exact],
            dropped: 0,
        });
    });

    it("handles an empty list", () => {
        expect(limitShareFiles([])).toEqual({
            kept: [],
            dropped: 0,
        });
    });

    it("applies limits in order: count, per-file size, total size", () => {
        // Create 25 files: first 19 are 10 MB each, 20th is 101 MB (over per-file limit),
        // 21st-25th are 5 MB each
        const files = [
            ...Array.from({ length: 19 }, () => file(10 * 1024 * 1024)),
            file(101 * 1024 * 1024),
            ...Array.from({ length: 5 }, () => file(5 * 1024 * 1024)),
        ];
        const result = limitShareFiles(files);
        // First 19 kept (190 MB), 20th dropped (over per-file), 21st kept (195 MB total)
        // 22nd would exceed total (200 MB), so stopped at 20 files
        expect(result.kept).toHaveLength(20);
        expect(result.kept[19].size).toBe(5 * 1024 * 1024);
        expect(result.dropped).toBe(5);
    });
});

// Export case table for the mirrors test
export const SHARE_TARGET_POST_CASES = [
    {
        name: "valid share-target POST with navigate mode",
        req: {
            method: "POST",
            url: "https://chat.example.org/share-target",
            mode: "navigate",
        },
        origin: "https://chat.example.org",
        expected: true,
    },
    {
        name: "GET to /share-target",
        req: {
            method: "GET",
            url: "https://chat.example.org/share-target",
            mode: "navigate",
        },
        origin: "https://chat.example.org",
        expected: false,
    },
    {
        name: "cross-origin POST",
        req: {
            method: "POST",
            url: "https://attacker.example/share-target",
            mode: "navigate",
        },
        origin: "https://chat.example.org",
        expected: false,
    },
    {
        name: "same-origin POST with mode cors",
        req: {
            method: "POST",
            url: "https://chat.example.org/share-target",
            mode: "cors",
        },
        origin: "https://chat.example.org",
        expected: false,
    },
    {
        name: "malformed URL",
        req: {
            method: "POST",
            url: "not a url",
            mode: "navigate",
        },
        origin: "https://chat.example.org",
        expected: false,
    },
];

export const LIMIT_FILES_CASES = [
    {
        name: "all files under limits",
        files: [{ size: 1000 }, { size: 2000 }],
        expected: { kept: [{ size: 1000 }, { size: 2000 }], dropped: 0 },
    },
    {
        name: "21 files → 20 kept",
        files: Array.from({ length: 21 }, (_, i) => ({ size: 100 + i })),
        expectedKept: 20,
        expectedDropped: 1,
    },
    {
        name: "oversized file dropped",
        files: [{ size: SHARE_MAX_FILE_BYTES + 1 }, { size: 100 }],
        expected: { kept: [{ size: 100 }], dropped: 1 },
    },
    {
        name: "total size limit enforced",
        files: [
            { size: 90 * 1024 * 1024 },
            { size: 90 * 1024 * 1024 },
            { size: 90 * 1024 * 1024 },
        ],
        expectedKept: 2,
        expectedDropped: 1,
    },
    {
        name: "exactly max per-file size kept",
        files: [{ size: SHARE_MAX_FILE_BYTES }],
        expected: { kept: [{ size: SHARE_MAX_FILE_BYTES }], dropped: 0 },
    },
    {
        name: "empty list",
        files: [],
        expected: { kept: [], dropped: 0 },
    },
];
