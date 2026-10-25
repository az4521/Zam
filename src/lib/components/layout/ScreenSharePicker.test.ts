import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import ScreenSharePicker from "./ScreenSharePicker.svelte";
import type { DisplaySourceRequest } from "$lib/utils/displaySources";
import { settingsState } from "$lib/stores/settings.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

function setup() {
    let push: ((req: DisplaySourceRequest) => void) | null = null;
    const screenShare = {
        onRequest: (cb: (req: DisplaySourceRequest) => void) => {
            push = cb;
            return () => {};
        },
        onCancel: () => () => {},
        respond: vi.fn(),
        onAudio: () => () => {},
        stopAudio: vi.fn(),
    };
    (window as unknown as { desktop: unknown }).desktop = {
        screenShare,
        pluginNative: { platform: "win32-x64" },
    };
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(ScreenSharePicker, { target: host });
    flushSync();
    return {
        respond: screenShare.respond,
        request(audio: DisplaySourceRequest["audio"]) {
            push!({
                requestId: 7,
                audioRequested: true,
                audio,
                sources: [
                    { id: "screen:0:0", name: "Entire screen" },
                    { id: "window:42:0", name: "Game" },
                ],
            });
            flushSync();
        },
    };
}

const select = () => document.querySelector("select");
const button = (name: string) =>
    [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes(name),
    )!;

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
    delete (window as unknown as { desktop?: unknown }).desktop;
    settingsState.shareSystemAudio = true;
    flushSync();
});

describe("ScreenSharePicker audio", () => {
    it("lists the audio choices and sends the one picked with the source", () => {
        settingsState.shareSystemAudio = true;
        const picker = setup();
        picker.request({
            system: "exclude-self",
            windowApp: true,
            apps: [{ id: "pid:5", name: "Spotify", active: true }],
        });
        const menu = select()!;
        expect([...menu.options].map((o) => o.value)).toEqual([
            "auto",
            "system",
            "none",
            "app:pid:5",
        ]);
        expect(menu.querySelector("optgroup")?.textContent).toContain(
            "Spotify",
        );
        expect(menu.value).toBe("auto");

        menu.value = "app:pid:5";
        menu.dispatchEvent(new Event("change"));
        flushSync();
        button("Game").click();
        expect(picker.respond).toHaveBeenCalledWith(
            7,
            "window:42:0",
            "Game",
            "app:pid:5",
        );
    });

    it("starts at no audio when share audio is turned off", () => {
        settingsState.shareSystemAudio = false;
        const picker = setup();
        picker.request({ system: "loopback", windowApp: false, apps: [] });
        expect(select()!.value).toBe("none");
        button("Entire screen").click();
        expect(picker.respond).toHaveBeenCalledWith(
            7,
            "screen:0:0",
            "Entire screen",
            "none",
        );
    });

    it("shows no audio menu when there is nothing to choose", () => {
        const picker = setup();
        picker.request(null);
        expect(select()).toBeNull();
        button("Entire screen").click();
        expect(picker.respond).toHaveBeenCalledWith(
            7,
            "screen:0:0",
            "Entire screen",
            "none",
        );
    });
});
