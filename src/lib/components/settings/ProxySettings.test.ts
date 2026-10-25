import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, unmount, flushSync, tick } from "svelte";
import ProxySettings from "./ProxySettings.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

function info(extra: Partial<DesktopProxyInfo> = {}): DesktopProxyInfo {
    return {
        mode: "system",
        rules: "",
        bypass: "",
        pacUrl: "",
        calls: "default",
        launchFlags: [],
        callBypassAddresses: [],
        callBypassAvailable: true,
        error: null,
        ...extra,
    };
}

function setup(initial: DesktopProxyInfo) {
    const proxy = {
        info: vi.fn(async () => initial),
        set: vi.fn(async (p: DesktopProxyPrefs) => info({ ...p })),
        callTargets: vi.fn(async () => {}),
    };
    (window as unknown as { desktop: unknown }).desktop = { proxy };
    return proxy;
}

async function render() {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(ProxySettings, { target: host });
    await vi.waitFor(() => {
        flushSync();
        if (!host!.querySelector("#proxy-mode")) throw new Error("not yet");
    });
    await tick();
    flushSync();
}

function select(id: string, value: string) {
    const el = host!.querySelector<HTMLSelectElement>(`#${id}`)!;
    el.value = value;
    el.dispatchEvent(new Event("change"));
    flushSync();
}

function type(id: string, value: string) {
    const el = host!.querySelector<HTMLInputElement>(`#${id}`)!;
    el.value = value;
    el.dispatchEvent(new Event("input"));
    flushSync();
}

const saveButton = () =>
    [...host!.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Save",
    )!;

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    delete (window as unknown as { desktop?: unknown }).desktop;
});

describe("ProxySettings", () => {
    it("saves a manual proxy with calls going direct", async () => {
        const proxy = setup(info());
        await render();
        expect(saveButton().disabled).toBe(true);
        select("proxy-mode", "manual");
        type("proxy-rules", "socks5://127.0.0.1:9050");
        select("proxy-calls", "direct");
        expect(saveButton().disabled).toBe(false);
        saveButton().click();
        await vi.waitFor(() => expect(proxy.set).toHaveBeenCalled());
        expect(proxy.set.mock.calls[0][0]).toEqual({
            mode: "manual",
            rules: "socks5://127.0.0.1:9050",
            bypass: "",
            pacUrl: "",
            calls: "direct",
        });
    });

    it("shows the launch flags in system mode", async () => {
        setup(
            info({ launchFlags: ["--proxy-server=socks5://127.0.0.1:9050"] }),
        );
        await render();
        expect(host!.textContent).toContain(
            "--proxy-server=socks5://127.0.0.1:9050",
        );
    });

    it("warns that calls can't bypass the OS proxy settings", async () => {
        setup(info());
        await render();
        select("proxy-calls", "direct");
        expect(host!.textContent).toContain(
            "Calls can't bypass the system proxy settings",
        );
        select("proxy-mode", "manual");
        expect(host!.textContent).not.toContain(
            "Calls can't bypass the system proxy settings",
        );
    });

    it("renders nothing outside the desktop app", async () => {
        host = document.createElement("div");
        document.body.appendChild(host);
        instance = mount(ProxySettings, { target: host });
        flushSync();
        expect(host.textContent?.trim()).toBe("");
    });
});
