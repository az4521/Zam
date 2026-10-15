import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import type { GlobalHotkeyStatus } from "$lib/keybinds/globalHotkeys";

const hotkeys = vi.hoisted(() => ({
    state: { status: null as GlobalHotkeyStatus | null },
    requestGlobalHotkeyPermission: vi.fn(async () => {}),
    configureGlobalShortcuts: vi.fn(),
}));
vi.mock("$lib/keybinds/desktopHotkeys.svelte", () => ({
    globalHotkeysState: hotkeys.state,
    requestGlobalHotkeyPermission: hotkeys.requestGlobalHotkeyPermission,
    configureGlobalShortcuts: hotkeys.configureGlobalShortcuts,
}));
vi.mock("$lib/stores/voiceCall.svelte", () => ({ refreshMicGate: vi.fn() }));

import KeybindSettings from "./KeybindSettings.svelte";
import {
    keybindsState,
    resetAllKeybinds,
    setGlobalVoiceKeybinds,
    setKeybind,
} from "$lib/stores/keybinds.svelte";
import { parseBinding } from "$lib/keybinds/keybinds";
import { t } from "$lib/i18n";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

function render(status: GlobalHotkeyStatus | null) {
    hotkeys.state.status = status;
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(KeybindSettings, { target: host });
    flushSync();
    return host;
}

const toggle = () =>
    host!.querySelector<HTMLButtonElement>(
        `[role="switch"][aria-label="${t("keybinds.globalVoice")}"]`,
    );

beforeEach(() => {
    localStorage.clear();
    resetAllKeybinds();
    setGlobalVoiceKeybinds(false);
    vi.clearAllMocks();
});

afterEach(() => {
    if (instance) unmount(instance);
    host?.remove();
    instance = null;
    host = null;
});

describe("Work when Zam isn't focused", () => {
    it("is absent outside the desktop app", () => {
        const el = render(null);
        expect(el.textContent).not.toContain(t("keybinds.globalVoice"));
    });

    it("switches the setting on and remembers it", () => {
        render({ state: "off" });
        toggle()!.click();
        flushSync();
        expect(keybindsState.globalVoice).toBe(true);
        expect(localStorage.getItem("zam.keybinds.global.v1")).toBe("1");
        expect(toggle()!.getAttribute("aria-checked")).toBe("true");
    });

    it("says plainly that Wayland can't do it", () => {
        const el = render({ state: "wayland" });
        expect(el.textContent).toContain(t("keybinds.globalWayland"));
        expect(toggle()).toBeNull();
    });

    it("explains the macOS permission and asks for it", () => {
        setGlobalVoiceKeybinds(true);
        const el = render({ state: "permission" });
        expect(el.textContent).toContain(t("keybinds.globalPermission"));
        const button = [...el.querySelectorAll("button")].find(
            (b) => b.textContent === t("keybinds.globalOpenSettings"),
        )!;
        button.click();
        expect(hotkeys.requestGlobalHotkeyPermission).toHaveBeenCalled();
    });

    it("shows why the hook couldn't start", () => {
        setGlobalVoiceKeybinds(true);
        const el = render({ state: "error", error: "UIOHOOK_FAILURE" });
        expect(el.textContent).toContain("UIOHOOK_FAILURE");
    });
});

describe("Work when Zam isn't focused, Wayland portal", () => {
    it("says the desktop runs the shortcuts", () => {
        const el = render({ state: "off", backend: "portal" });
        expect(el.textContent).toContain(t("keybinds.globalPortalHint"));
        expect(toggle()).not.toBeNull();
    });

    it("shows the keys the desktop assigned and opens its editor", () => {
        setGlobalVoiceKeybinds(true);
        setKeybind("pushToTalk", {
            ...parseBinding("Alt")!,
            key: "mouse4",
        });
        const el = render({
            state: "active",
            backend: "portal",
            configurable: true,
            shortcuts: [
                { id: "toggleMute", trigger: "Ctrl+Shift+M" },
                { id: "pushToTalk", trigger: "" },
            ],
        });
        expect(el.textContent).toContain(t("keybinds.globalPortalAssigned"));
        expect(el.textContent).toContain("Ctrl+Shift+M");
        expect(el.textContent).toContain(t("keybinds.globalPortalMouse"));
        const button = [...el.querySelectorAll("button")].find(
            (b) => b.textContent === t("keybinds.globalPortalConfigure"),
        )!;
        button.click();
        expect(hotkeys.configureGlobalShortcuts).toHaveBeenCalled();
    });

    it("explains a refused binding", () => {
        setGlobalVoiceKeybinds(true);
        const el = render({
            state: "error",
            backend: "portal",
            error: "BindShortcuts: cancelled",
        });
        expect(el.textContent).toContain(
            t("keybinds.globalPortalError", {
                error: "BindShortcuts: cancelled",
            }),
        );
    });
});
