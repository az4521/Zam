import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { GlobalHotkeyStatus, GlobalInput } from "./globalHotkeys";

const runner = vi.hoisted(() => ({
    handleGlobalInput: vi.fn(),
    releaseAllHolds: vi.fn(),
    resetGlobalInput: vi.fn(),
}));
vi.mock("./runner", () => runner);

import {
    connectGlobalHotkeys,
    globalHotkeysState,
    holdsOutliveBlur,
    syncGlobalHotkeys,
} from "./desktopHotkeys.svelte";
import { parseBinding } from "./keybinds";
import {
    resetAllKeybinds,
    setGlobalVoiceKeybinds,
    setKeybind,
} from "$lib/stores/keybinds.svelte";

function fakeBridge(reply: GlobalHotkeyStatus = { state: "active" }) {
    let input: ((ev: GlobalInput) => void) | null = null;
    let status: ((s: GlobalHotkeyStatus) => void) | null = null;
    const api = {
        watch: vi.fn(async () => reply),
        requestPermission: vi.fn(async () => reply),
        onInput: (cb: (ev: GlobalInput) => void) => {
            input = cb;
            return () => (input = null);
        },
        onStatus: (cb: (s: GlobalHotkeyStatus) => void) => {
            status = cb;
            return () => (status = null);
        },
    };
    window.desktop = { hotkeys: api };
    return {
        api,
        input: (ev: GlobalInput) => input?.(ev),
        status: (s: GlobalHotkeyStatus) => status?.(s),
    };
}

beforeEach(() => {
    localStorage.clear();
    resetAllKeybinds();
    setGlobalVoiceKeybinds(false);
    globalHotkeysState.status = null;
    vi.clearAllMocks();
});

afterEach(() => {
    delete window.desktop;
});

describe("syncGlobalHotkeys", () => {
    it("watches nothing while the setting is off", async () => {
        const { api } = fakeBridge({ state: "off" });
        syncGlobalHotkeys();
        expect(api.watch).toHaveBeenCalledWith([], []);
        await vi.waitFor(() =>
            expect(globalHotkeysState.status).toEqual({ state: "off" }),
        );
    });

    it("watches only the voice bindings' keys once it's on", () => {
        const { api } = fakeBridge();
        setGlobalVoiceKeybinds(true);
        // Unbind the default toggles so only push to talk is left.
        setKeybind("toggleMute", null);
        setKeybind("toggleDeafen", null);
        setKeybind("pushToTalk", parseBinding("V")!);
        syncGlobalHotkeys();
        expect(api.watch).toHaveBeenLastCalledWith(["KeyV"], []);
    });

    it("does nothing outside the desktop app", () => {
        setGlobalVoiceKeybinds(true);
        expect(() => syncGlobalHotkeys()).not.toThrow();
        expect(globalHotkeysState.status).toBeNull();
    });
});

describe("connectGlobalHotkeys", () => {
    it("passes input to the runner with the window's focus", () => {
        const bridge = fakeBridge();
        const disconnect = connectGlobalHotkeys();
        const ev: GlobalInput = { kind: "mouse", button: 3, down: true };
        bridge.input(ev);
        expect(runner.handleGlobalInput).toHaveBeenCalledWith(
            ev,
            document.hasFocus(),
        );
        disconnect();
        expect(bridge.api.watch).toHaveBeenLastCalledWith([], []);
        bridge.input(ev);
        expect(runner.handleGlobalInput).toHaveBeenCalledTimes(1);
    });

    it("keeps holds over a blur only while the hook runs", () => {
        const bridge = fakeBridge();
        const disconnect = connectGlobalHotkeys();
        setGlobalVoiceKeybinds(true);
        bridge.status({ state: "active" });
        expect(holdsOutliveBlur()).toBe(true);

        // The hook stopped: what it was holding has to be let go.
        vi.spyOn(document, "hasFocus").mockReturnValue(false);
        bridge.status({ state: "error", error: "boom" });
        expect(holdsOutliveBlur()).toBe(false);
        expect(runner.resetGlobalInput).toHaveBeenCalled();
        expect(runner.releaseAllHolds).toHaveBeenCalled();

        setGlobalVoiceKeybinds(false);
        bridge.status({ state: "active" });
        expect(holdsOutliveBlur()).toBe(false);
        disconnect();
    });
});
