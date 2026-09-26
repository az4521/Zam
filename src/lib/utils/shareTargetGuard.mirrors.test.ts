import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    SHARE_MAX_FILES,
    SHARE_MAX_FILE_BYTES,
    SHARE_MAX_TOTAL_BYTES,
} from "./shareTargetGuard";
import {
    SHARE_TARGET_POST_CASES,
    LIMIT_FILES_CASES,
} from "./shareTargetGuard.test";

// static/sw.js is hand-written and un-bundled, so it hand-mirrors
// shareTargetGuard.ts. This test EXECUTES the mirrored region and runs
// the real case table against it.
const SW_SOURCE = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../../../static/sw.js"),
    "utf-8",
);

function regionSource(name: string): string {
    const startMarker = `// #region mirrored:${name}`;
    const endMarker = `// #endregion mirrored:${name}`;
    const start = SW_SOURCE.indexOf(startMarker);
    const end = SW_SOURCE.indexOf(endMarker);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return SW_SOURCE.slice(start + startMarker.length, end);
}

const mirrored = new Function(
    `${regionSource("shareTarget")}
    return {
        isShareTargetPost,
        limitShareFiles,
        SHARE_MAX_FILES,
        SHARE_MAX_FILE_BYTES,
        SHARE_MAX_TOTAL_BYTES,
    };`,
)() as {
    isShareTargetPost: (
        req: { method: string; url: string; mode: string },
        origin: string,
    ) => boolean;
    limitShareFiles: <T extends { size: number }>(
        files: T[],
    ) => {
        kept: T[];
        dropped: number;
    };
    SHARE_MAX_FILES: number;
    SHARE_MAX_FILE_BYTES: number;
    SHARE_MAX_TOTAL_BYTES: number;
};

describe("static/sw.js mirrors shareTargetGuard.ts", () => {
    it("mirrors the constants", () => {
        expect(mirrored.SHARE_MAX_FILES).toBe(SHARE_MAX_FILES);
        expect(mirrored.SHARE_MAX_FILE_BYTES).toBe(SHARE_MAX_FILE_BYTES);
        expect(mirrored.SHARE_MAX_TOTAL_BYTES).toBe(SHARE_MAX_TOTAL_BYTES);
    });

    for (const c of SHARE_TARGET_POST_CASES) {
        it(`isShareTargetPost: ${c.name}`, () => {
            expect(mirrored.isShareTargetPost(c.req, c.origin)).toBe(
                c.expected,
            );
        });
    }

    for (const c of LIMIT_FILES_CASES) {
        it(`limitShareFiles: ${c.name}`, () => {
            const result = mirrored.limitShareFiles(c.files);
            if ("expected" in c) {
                expect(result).toEqual(c.expected);
            } else {
                expect(result.kept).toHaveLength(c.expectedKept!);
                expect(result.dropped).toBe(c.expectedDropped!);
            }
        });
    }
});
