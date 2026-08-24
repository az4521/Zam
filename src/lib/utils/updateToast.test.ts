import { describe, it, expect } from "vitest";
import { shouldFireUpdateToast } from "./updateToast";

describe("shouldFireUpdateToast", () => {
    it("never fires on desktop (the inline banner covers it)", () => {
        expect(shouldFireUpdateToast("idle", "available", false)).toBe(false);
        expect(shouldFireUpdateToast("checking", "downloaded", false)).toBe(
            false,
        );
    });

    it("fires when the phase turns actionable on mobile", () => {
        expect(shouldFireUpdateToast("idle", "available", true)).toBe(true);
        expect(shouldFireUpdateToast("checking", "downloaded", true)).toBe(
            true,
        );
        expect(shouldFireUpdateToast("checking", "unsupported", true)).toBe(
            true,
        );
    });

    it("does not re-fire when the phase is unchanged", () => {
        expect(shouldFireUpdateToast("available", "available", true)).toBe(
            false,
        );
        expect(shouldFireUpdateToast("downloaded", "downloaded", true)).toBe(
            false,
        );
    });

    it("does not fire on a change into a non-actionable phase", () => {
        expect(shouldFireUpdateToast("available", "downloading", true)).toBe(
            false,
        );
        expect(shouldFireUpdateToast("available", "up-to-date", true)).toBe(
            false,
        );
        expect(shouldFireUpdateToast("idle", "checking", true)).toBe(false);
        expect(shouldFireUpdateToast("downloaded", "error", true)).toBe(false);
    });

    it("fires again when it becomes installable after downloading", () => {
        // available (actionable) → downloaded (still actionable, but a distinct,
        // more-actionable phase) earns a fresh "ready to install" prompt.
        expect(shouldFireUpdateToast("available", "downloaded", true)).toBe(
            true,
        );
    });
});
