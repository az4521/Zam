import { describe, it, expect } from "vitest";
import {
    extractConstants,
    checkActiveSessionSync,
} from "./checkActiveSessionConstants";

describe("extractConstants", () => {
    it("extracts constants from TypeScript source", () => {
        const ts = `
export const MAX_FUTURE_SKEW_MS = 300_000;
export const MAX_GRACE_MS = 7_200_000;
`;
        expect(extractConstants(ts, "typescript")).toEqual({
            MAX_FUTURE_SKEW_MS: 300000,
            MAX_GRACE_MS: 7200000,
        });
    });

    it("extracts constants from JavaScript source", () => {
        const js = `
const MAX_FUTURE_SKEW_MS = 300000;
const MAX_GRACE_MS = 7200000;
`;
        expect(extractConstants(js, "javascript")).toEqual({
            MAX_FUTURE_SKEW_MS: 300000,
            MAX_GRACE_MS: 7200000,
        });
    });

    it("extracts constants from Java source", () => {
        const java = `
private static final long MAX_FUTURE_SKEW_MS = 300000L;
private static final long MAX_GRACE_MS = 7200000L;
`;
        expect(extractConstants(java, "java")).toEqual({
            MAX_FUTURE_SKEW_MS: 300000,
            MAX_GRACE_MS: 7200000,
        });
    });

    it("handles underscores in numeric literals", () => {
        const ts = "export const MAX_FUTURE_SKEW_MS = 300_000;";
        expect(extractConstants(ts, "typescript")).toEqual({
            MAX_FUTURE_SKEW_MS: 300000,
        });
    });

    it("handles L suffix in Java", () => {
        const java = "private static final long MAX_FUTURE_SKEW_MS = 300000L;";
        expect(extractConstants(java, "java")).toEqual({
            MAX_FUTURE_SKEW_MS: 300000,
        });
    });

    it("returns empty object when constants not found", () => {
        expect(extractConstants("", "typescript")).toEqual({});
    });
});

describe("checkActiveSessionSync", () => {
    it("passes when all constants match", () => {
        const sources = {
            "activeSession.ts": `export const MAX_FUTURE_SKEW_MS = 300_000;\nexport const MAX_GRACE_MS = 7_200_000;`,
            "sw.js": `const MAX_FUTURE_SKEW_MS = 300000;\nconst MAX_GRACE_MS = 7200000;`,
            "MatrixMessagingService.java": `private static final long MAX_FUTURE_SKEW_MS = 300000L;\nprivate static final long MAX_GRACE_MS = 7200000L;`,
        };
        const result = checkActiveSessionSync(sources);
        expect(result.ok).toBe(true);
        expect(result.mismatches).toEqual([]);
    });

    it("detects mismatch in MAX_FUTURE_SKEW_MS", () => {
        const sources = {
            "activeSession.ts": `export const MAX_FUTURE_SKEW_MS = 300_000;\nexport const MAX_GRACE_MS = 7_200_000;`,
            "sw.js": `const MAX_FUTURE_SKEW_MS = 400000;\nconst MAX_GRACE_MS = 7200000;`,
            "MatrixMessagingService.java": `private static final long MAX_FUTURE_SKEW_MS = 300000L;\nprivate static final long MAX_GRACE_MS = 7200000L;`,
        };
        const result = checkActiveSessionSync(sources);
        expect(result.ok).toBe(false);
        expect(result.mismatches).toContainEqual(
            expect.objectContaining({
                constant: "MAX_FUTURE_SKEW_MS",
            }),
        );
    });

    it("detects mismatch in MAX_GRACE_MS", () => {
        const sources = {
            "activeSession.ts": `export const MAX_FUTURE_SKEW_MS = 300_000;\nexport const MAX_GRACE_MS = 7_200_000;`,
            "sw.js": `const MAX_FUTURE_SKEW_MS = 300000;\nconst MAX_GRACE_MS = 7200000;`,
            "MatrixMessagingService.java": `private static final long MAX_FUTURE_SKEW_MS = 300000L;\nprivate static final long MAX_GRACE_MS = 8000000L;`,
        };
        const result = checkActiveSessionSync(sources);
        expect(result.ok).toBe(false);
        expect(result.mismatches).toContainEqual(
            expect.objectContaining({
                constant: "MAX_GRACE_MS",
            }),
        );
    });

    it("detects multiple mismatches", () => {
        const sources = {
            "activeSession.ts": `export const MAX_FUTURE_SKEW_MS = 300_000;\nexport const MAX_GRACE_MS = 7_200_000;`,
            "sw.js": `const MAX_FUTURE_SKEW_MS = 400000;\nconst MAX_GRACE_MS = 8000000;`,
            "MatrixMessagingService.java": `private static final long MAX_FUTURE_SKEW_MS = 300000L;\nprivate static final long MAX_GRACE_MS = 7200000L;`,
        };
        const result = checkActiveSessionSync(sources);
        expect(result.ok).toBe(false);
        expect(result.mismatches.length).toBe(2);
    });

    it("fails if constant missing from a file", () => {
        const sources = {
            "activeSession.ts": `export const MAX_FUTURE_SKEW_MS = 300_000;\nexport const MAX_GRACE_MS = 7_200_000;`,
            "sw.js": `const MAX_FUTURE_SKEW_MS = 300000;`,
            "MatrixMessagingService.java": `private static final long MAX_FUTURE_SKEW_MS = 300000L;\nprivate static final long MAX_GRACE_MS = 7200000L;`,
        };
        const result = checkActiveSessionSync(sources);
        expect(result.ok).toBe(false);
        expect(result.mismatches).toContainEqual(
            expect.objectContaining({
                constant: "MAX_GRACE_MS",
            }),
        );
    });
});
