import { describe, it, expect } from "vitest";
import { updateStatusView } from "./updateStatus";

describe("updateStatusView — fold updater phase + toggle into a view model", () => {
    it("checking → busy, no action", () => {
        expect(
            updateStatusView({ phase: "checking", autoEnabled: false }),
        ).toEqual({
            label: "Checking for updates…",
            action: "none",
            actionLabel: "",
            busy: true,
            percent: null,
        });
    });

    it("up-to-date with a version shows the (v…) fragment", () => {
        expect(
            updateStatusView({
                phase: "up-to-date",
                autoEnabled: false,
                version: "0.9.1",
            }),
        ).toEqual({
            label: "You're on the latest version (v0.9.1)",
            action: "check",
            actionLabel: "Check for updates",
            busy: false,
            percent: null,
        });
    });

    it("up-to-date without a version omits (v…) and never prints undefined", () => {
        const view = updateStatusView({
            phase: "up-to-date",
            autoEnabled: false,
        });
        expect(view.label).toBe("You're on the latest version");
        expect(view.label).not.toContain("undefined");
        expect(view.label).not.toContain("(v");
    });

    it("available + autoEnabled → still offers an explicit download choice (confirm-gated)", () => {
        expect(
            updateStatusView({
                phase: "available",
                autoEnabled: true,
                version: "1.2.0",
            }),
        ).toEqual({
            label: "Update available (v1.2.0)",
            action: "download",
            actionLabel: "Download & install",
            busy: false,
            percent: null,
        });
    });

    it("available + manual → offers a download action with the version", () => {
        expect(
            updateStatusView({
                phase: "available",
                autoEnabled: false,
                version: "1.2.0",
            }),
        ).toEqual({
            label: "Update available (v1.2.0)",
            action: "download",
            actionLabel: "Download & install",
            busy: false,
            percent: null,
        });
    });

    it("available + manual without a version omits (v…)", () => {
        const view = updateStatusView({
            phase: "available",
            autoEnabled: false,
        });
        expect(view.label).toBe("Update available");
        expect(view.label).not.toContain("undefined");
    });

    it("downloading surfaces the rounded percent in the label and field", () => {
        expect(
            updateStatusView({
                phase: "downloading",
                autoEnabled: true,
                percent: 42,
            }),
        ).toEqual({
            label: "Downloading update… 42%",
            action: "none",
            actionLabel: "",
            busy: true,
            percent: 42,
        });
    });

    it("downloading rounds a fractional percent (42.7 → 43)", () => {
        const view = updateStatusView({
            phase: "downloading",
            autoEnabled: true,
            percent: 42.7,
        });
        expect(view.percent).toBe(43);
        expect(view.label).toBe("Downloading update… 43%");
    });

    it("downloading clamps a percent above 100 down to 100", () => {
        const view = updateStatusView({
            phase: "downloading",
            autoEnabled: true,
            percent: 150,
        });
        expect(view.percent).toBe(100);
        expect(view.label).toBe("Downloading update… 100%");
    });

    it("downloading clamps a negative percent up to 0", () => {
        const view = updateStatusView({
            phase: "downloading",
            autoEnabled: true,
            percent: -5,
        });
        expect(view.percent).toBe(0);
        expect(view.label).toBe("Downloading update… 0%");
    });

    it("downloading treats an undefined percent as 0", () => {
        const view = updateStatusView({
            phase: "downloading",
            autoEnabled: true,
        });
        expect(view.percent).toBe(0);
        expect(view.label).toBe("Downloading update… 0%");
    });

    it("downloaded → offers a restart action", () => {
        expect(
            updateStatusView({ phase: "downloaded", autoEnabled: true }),
        ).toEqual({
            label: "Update ready — restart to apply",
            action: "restart",
            actionLabel: "Restart to apply",
            busy: false,
            percent: null,
        });
    });

    it("unsupported → points at the release page", () => {
        expect(
            updateStatusView({ phase: "unsupported", autoEnabled: false }),
        ).toEqual({
            label: "A new version is available",
            action: "open-release",
            actionLabel: "Open release page",
            busy: false,
            percent: null,
        });
    });

    it("error surfaces the message verbatim", () => {
        expect(
            updateStatusView({
                phase: "error",
                autoEnabled: false,
                message: "Network timeout while fetching update",
            }),
        ).toEqual({
            label: "Network timeout while fetching update",
            action: "check",
            actionLabel: "Check for updates",
            busy: false,
            percent: null,
        });
    });

    it("error without a message falls back to a generic label", () => {
        const view = updateStatusView({ phase: "error", autoEnabled: false });
        expect(view.label).toBe("Update check failed");
        expect(view.action).toBe("check");
    });

    it("idle → prompts a manual check", () => {
        expect(updateStatusView({ phase: "idle", autoEnabled: false })).toEqual(
            {
                label: "Check for updates to install the latest version.",
                action: "check",
                actionLabel: "Check for updates",
                busy: false,
                percent: null,
            },
        );
    });

    it("downloaded + platform android → offers an install action", () => {
        expect(
            updateStatusView({
                phase: "downloaded",
                autoEnabled: true,
                platform: "android",
            }),
        ).toEqual({
            label: "Update ready — Install",
            action: "install",
            actionLabel: "Install",
            busy: false,
            percent: null,
        });
    });

    it("downloaded + platform electron still restarts (no regression)", () => {
        expect(
            updateStatusView({
                phase: "downloaded",
                autoEnabled: true,
                platform: "electron",
            }),
        ).toEqual({
            label: "Update ready — restart to apply",
            action: "restart",
            actionLabel: "Restart to apply",
            busy: false,
            percent: null,
        });
    });

    it("downloaded with no platform defaults to restart", () => {
        const view = updateStatusView({
            phase: "downloaded",
            autoEnabled: true,
        });
        expect(view.action).toBe("restart");
    });
});
