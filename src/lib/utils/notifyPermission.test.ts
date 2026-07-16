import { describe, it, expect, vi, afterEach } from "vitest";
import {
    requestNotificationPermission,
    callAlertHint,
} from "./notifyPermission";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("requestNotificationPermission", () => {
    it("reports unsupported when the Notification API is absent", async () => {
        vi.stubGlobal("Notification", undefined);
        await expect(requestNotificationPermission()).resolves.toBe(
            "unsupported",
        );
    });

    it("does not re-prompt once a decision exists", async () => {
        const requestPermission = vi.fn();
        vi.stubGlobal("Notification", {
            permission: "denied",
            requestPermission,
        });
        await expect(requestNotificationPermission()).resolves.toBe("denied");
        expect(requestPermission).not.toHaveBeenCalled();
    });

    it("prompts when no decision has been made yet", async () => {
        const requestPermission = vi.fn().mockResolvedValue("granted");
        vi.stubGlobal("Notification", {
            permission: "default",
            requestPermission,
        });
        await expect(requestNotificationPermission()).resolves.toBe("granted");
        expect(requestPermission).toHaveBeenCalledOnce();
    });

    it("treats a throwing prompt as denied", async () => {
        vi.stubGlobal("Notification", {
            permission: "default",
            requestPermission: vi.fn().mockRejectedValue(new Error("nope")),
        });
        await expect(requestNotificationPermission()).resolves.toBe("denied");
    });
});

describe("callAlertHint", () => {
    it("stays silent when permission is granted", () => {
        expect(callAlertHint("granted")).toBeNull();
    });

    it("stays silent when no decision has been made yet", () => {
        // "default" means we're about to prompt — don't pre-emptively nag.
        expect(callAlertHint("default")).toBeNull();
    });

    it("warns, mentioning the block, when permission is denied", () => {
        const hint = callAlertHint("denied");
        expect(hint).toBeTruthy();
        expect(hint).toMatch(/block/i);
    });

    it("gives a distinct warning when notifications are unsupported", () => {
        const hint = callAlertHint("unsupported");
        expect(hint).toBeTruthy();
        expect(hint).not.toBe(callAlertHint("denied"));
    });
});
