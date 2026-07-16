import { describe, it, expect, vi, afterEach } from "vitest";
import { restoreAppWindow } from "./restoreWindow";

const win = window as typeof window & {
    desktop?: { showWindow?: () => void };
};
const realFocus = window.focus;

afterEach(() => {
    delete win.desktop;
    window.focus = realFocus;
});

describe("restoreAppWindow", () => {
    it("uses the desktop bridge to un-hide a tray-hidden window when present", () => {
        const showWindow = vi.fn();
        win.desktop = { showWindow };
        const focus = vi.fn();
        window.focus = focus;

        restoreAppWindow();

        // window.focus() cannot un-hide a hidden BrowserWindow — the bridge must
        // win, and the plain focus must not run.
        expect(showWindow).toHaveBeenCalledTimes(1);
        expect(focus).not.toHaveBeenCalled();
    });

    it("falls back to window.focus() when there is no desktop bridge", () => {
        const focus = vi.fn();
        window.focus = focus;

        restoreAppWindow();

        expect(focus).toHaveBeenCalledTimes(1);
    });

    it("still focuses when the bridge object lacks showWindow", () => {
        win.desktop = {}; // a bridge without the method
        const focus = vi.fn();
        window.focus = focus;

        restoreAppWindow();

        expect(focus).toHaveBeenCalledTimes(1);
    });
});
