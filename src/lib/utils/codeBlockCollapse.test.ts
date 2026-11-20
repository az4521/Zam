import { describe, expect, it } from "vitest";
import {
    CODE_BLOCK_MAX_REM,
    codeBlockCapPx,
    codeBlockKey,
    codeBlockOverflows,
} from "./codeBlockCollapse";

describe("codeBlockCapPx", () => {
    it("scales the cap with the root font size", () => {
        expect(codeBlockCapPx(16)).toBe(CODE_BLOCK_MAX_REM * 16);
        expect(codeBlockCapPx(20)).toBe(CODE_BLOCK_MAX_REM * 20);
    });

    it("falls back to 16px for a bogus root size", () => {
        expect(codeBlockCapPx(0)).toBe(CODE_BLOCK_MAX_REM * 16);
        expect(codeBlockCapPx(Number.NaN)).toBe(CODE_BLOCK_MAX_REM * 16);
    });
});

describe("codeBlockOverflows", () => {
    it("is false for content shorter than the cap", () => {
        expect(codeBlockOverflows(100, 384)).toBe(false);
    });

    it("is false for content that just fits, within the 1px tolerance", () => {
        expect(codeBlockOverflows(384, 384)).toBe(false);
        expect(codeBlockOverflows(385, 384)).toBe(false);
    });

    it("is true once content is clearly taller than the cap", () => {
        expect(codeBlockOverflows(386, 384)).toBe(true);
        expect(codeBlockOverflows(1200, 384)).toBe(true);
    });
});

describe("codeBlockKey", () => {
    it("combines the event key and block index", () => {
        expect(codeBlockKey("$abc", 0)).toBe("$abc#0");
        expect(codeBlockKey("$abc", 2)).not.toBe(codeBlockKey("$abc", 1));
        expect(codeBlockKey("$abc", 0)).not.toBe(codeBlockKey("$def", 0));
    });
});
