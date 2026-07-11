import { describe, it, expect } from "vitest";
import {
    canSubmitReport,
    buildReport,
    reportErrorMessage,
} from "./reportMessage";

describe("canSubmitReport — a reason is required", () => {
    it("rejects an empty reason", () => {
        expect(canSubmitReport("")).toBe(false);
    });

    it("rejects a whitespace-only reason", () => {
        expect(canSubmitReport("   \n\t ")).toBe(false);
    });

    it("accepts a real reason", () => {
        expect(canSubmitReport("spam")).toBe(true);
    });
});

describe("buildReport — payload for reportEvent", () => {
    it("trims the reason", () => {
        expect(buildReport("  spam  ", false).reason).toBe("spam");
    });

    it("scores 0 by default", () => {
        expect(buildReport("spam", false).score).toBe(0);
    });

    it("scores -100 (most offensive) when flagged", () => {
        expect(buildReport("spam", true).score).toBe(-100);
    });
});

describe("reportErrorMessage — human-readable error from an SDK throw", () => {
    it("prefers the server's error string (MatrixError data.error)", () => {
        const err = {
            data: { errcode: "M_FORBIDDEN", error: "Reporting is disabled" },
            message: "MatrixError: [403] Reporting is disabled",
        };
        expect(reportErrorMessage(err)).toBe("Reporting is disabled");
    });

    it("falls back to the Error message", () => {
        expect(reportErrorMessage(new Error("Not logged in"))).toBe(
            "Not logged in",
        );
    });

    it("falls back to a generic message for junk values", () => {
        expect(reportErrorMessage(null)).toBe("Failed to send report");
        expect(reportErrorMessage(undefined)).toBe("Failed to send report");
        expect(reportErrorMessage({})).toBe("Failed to send report");
        expect(reportErrorMessage("boom")).toBe("Failed to send report");
    });
});
