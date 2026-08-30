import { describe, it, expect } from "vitest";
import { resolveWindowCloseAction } from "./trayClose";

describe("resolveWindowCloseAction", () => {
    it("hides when minimise-to-tray is on and the user did not explicitly quit", () => {
        expect(
            resolveWindowCloseAction({
                minimizeToTray: true,
                explicitQuit: false,
            }),
        ).toBe("hide");
    });

    it("closes when minimise-to-tray is off", () => {
        expect(
            resolveWindowCloseAction({
                minimizeToTray: false,
                explicitQuit: false,
            }),
        ).toBe("close");
    });

    it("closes on an explicit quit even when minimise-to-tray is on", () => {
        expect(
            resolveWindowCloseAction({
                minimizeToTray: true,
                explicitQuit: true,
            }),
        ).toBe("close");
    });

    it("closes on an explicit quit when minimise-to-tray is off", () => {
        expect(
            resolveWindowCloseAction({
                minimizeToTray: false,
                explicitQuit: true,
            }),
        ).toBe("close");
    });
});
