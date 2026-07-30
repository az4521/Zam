import { describe, it, expect } from "vitest";
import {
    formatByteLimit,
    exceedsUploadLimit,
    uploadLimitMessage,
    FileTooLargeError,
    isFileTooLargeError,
} from "./uploadLimits";

const MB = 1024 * 1024;

describe("formatByteLimit", () => {
    it("renders a megabyte-scale limit in MB", () => {
        expect(formatByteLimit(50 * MB)).toBe("50 MB");
    });

    it("rounds to the nearest MB", () => {
        expect(formatByteLimit(51.4 * MB)).toBe("51 MB");
        expect(formatByteLimit(51.6 * MB)).toBe("52 MB");
    });

    it("switches to MB at exactly one megabyte", () => {
        expect(formatByteLimit(MB)).toBe("1 MB");
    });

    it("renders a sub-megabyte limit in KB rather than lying about 0 MB", () => {
        expect(formatByteLimit(512 * 1024)).toBe("512 KB");
    });

    it("rounds to the nearest KB below a megabyte", () => {
        expect(formatByteLimit(1500)).toBe("1 KB");
        expect(formatByteLimit(1800)).toBe("2 KB");
    });

    it("renders a zero limit as 0 KB", () => {
        expect(formatByteLimit(0)).toBe("0 KB");
    });
});

describe("exceedsUploadLimit", () => {
    it("is false when the server advertises no limit", () => {
        expect(exceedsUploadLimit(999 * MB, null)).toBe(false);
    });

    it("is false for a file smaller than the limit", () => {
        expect(exceedsUploadLimit(MB, 50 * MB)).toBe(false);
    });

    it("is false for a file exactly at the limit", () => {
        expect(exceedsUploadLimit(50 * MB, 50 * MB)).toBe(false);
    });

    it("is true for a file one byte over the limit", () => {
        expect(exceedsUploadLimit(50 * MB + 1, 50 * MB)).toBe(true);
    });
});

describe("uploadLimitMessage", () => {
    it("names the file and the limit", () => {
        expect(uploadLimitMessage("holiday.mp4", 50 * MB)).toBe(
            '"holiday.mp4" exceeds the server\'s 50 MB upload limit',
        );
    });
});

describe("FileTooLargeError", () => {
    it("carries the file name, size and limit", () => {
        const err = new FileTooLargeError("big.zip", 120 * MB, 50 * MB);
        expect(err.fileName).toBe("big.zip");
        expect(err.size).toBe(120 * MB);
        expect(err.limit).toBe(50 * MB);
    });

    it("uses the limit message as its Error message so generic toasts read well", () => {
        const err = new FileTooLargeError("big.zip", 120 * MB, 50 * MB);
        expect(err.message).toBe(
            '"big.zip" exceeds the server\'s 50 MB upload limit',
        );
    });

    it("is a real Error", () => {
        expect(new FileTooLargeError("a", 2, 1)).toBeInstanceOf(Error);
    });

    it("names itself so logs and generic handlers can tell it apart", () => {
        expect(new FileTooLargeError("a", 2, 1).name).toBe("FileTooLargeError");
    });
});

describe("isFileTooLargeError", () => {
    it("recognises the typed error", () => {
        expect(isFileTooLargeError(new FileTooLargeError("a", 2, 1))).toBe(
            true,
        );
    });

    it("recognises a structurally-identical marker from another bundle copy", () => {
        expect(isFileTooLargeError({ isFileTooLarge: true })).toBe(true);
    });

    it("rejects a plain Error", () => {
        expect(isFileTooLargeError(new Error("nope"))).toBe(false);
    });

    it("rejects null and undefined", () => {
        expect(isFileTooLargeError(null)).toBe(false);
        expect(isFileTooLargeError(undefined)).toBe(false);
    });

    it("requires the marker to be exactly true, not merely truthy", () => {
        expect(isFileTooLargeError({ isFileTooLarge: 1 })).toBe(false);
        expect(isFileTooLargeError({ isFileTooLarge: "yes" })).toBe(false);
    });
});
