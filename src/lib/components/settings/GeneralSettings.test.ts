import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, unmount, flushSync, tick } from "svelte";
import GeneralSettings from "./GeneralSettings.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

type AutostartInfo = { available: boolean; enabled: boolean };

function setup(
    initial: AutostartInfo,
    set: (enabled: boolean) => Promise<AutostartInfo>,
) {
    (window as unknown as { desktop: unknown }).desktop = {
        tray: { setUnread: vi.fn(), setMinimizeToClose: vi.fn() },
        autostart: { info: vi.fn(async () => initial), set: vi.fn(set) },
    };
    return window.desktop!.autostart!;
}

async function render() {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(GeneralSettings, { target: host });
    await tick();
    await tick();
    flushSync();
}

const startupToggle = () =>
    host!.querySelector<HTMLElement>('[aria-label="Run at startup"]');

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
    delete (window as unknown as { desktop?: unknown }).desktop;
});

describe("GeneralSettings run at startup", () => {
    it("is hidden where the build can't offer it", async () => {
        setup({ available: false, enabled: false }, async (enabled) => ({
            available: false,
            enabled,
        }));
        await render();
        expect(startupToggle()).toBeNull();
    });

    it("turns on through the bridge", async () => {
        const bridge = setup(
            { available: true, enabled: false },
            async (enabled) => ({ available: true, enabled }),
        );
        await render();
        startupToggle()!.click();
        await tick();
        await tick();
        flushSync();
        expect(bridge.set).toHaveBeenCalledWith(true);
        expect(host!.textContent).not.toContain("didn't allow");
    });

    it("says so when the system refuses", async () => {
        setup({ available: true, enabled: false }, async () => ({
            available: true,
            enabled: false,
        }));
        await render();
        startupToggle()!.click();
        await tick();
        await tick();
        flushSync();
        expect(host!.textContent).toContain("didn't allow");
    });
});
