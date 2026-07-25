import { describe, it, expect } from "vitest";
import { shouldShowUpdateBanner } from "./updateBanner";

describe("shouldShowUpdateBanner", () => {
    it("shows for an actionable update (downloaded / available / unsupported)", () => {
        expect(shouldShowUpdateBanner("downloaded", false)).toBe(true);
        expect(shouldShowUpdateBanner("available", false)).toBe(true);
        expect(shouldShowUpdateBanner("unsupported", false)).toBe(true);
    });

    it("stays hidden for non-actionable phases", () => {
        for (const phase of [
            "idle",
            "checking",
            "downloading",
            "up-to-date",
            "error",
        ] as const) {
            expect(shouldShowUpdateBanner(phase, false)).toBe(false);
        }
    });

    it("stays hidden once dismissed, even for an actionable phase", () => {
        expect(shouldShowUpdateBanner("downloaded", true)).toBe(false);
        expect(shouldShowUpdateBanner("available", true)).toBe(false);
    });
});
