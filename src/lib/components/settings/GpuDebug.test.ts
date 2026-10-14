import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import GpuDebug from "./GpuDebug.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

const report = {
    hardwareAcceleration: true,
    hardwareAccelerationAtLaunch: true,
    featureStatus: { video_decode: "enabled", gpu_compositing: "enabled" },
    info: { gpuDevice: [{ vendorId: 4318, deviceId: 8072, active: true }] },
    switches: { "enable-features": "JXLImageFormat,VaapiOnNvidiaGPUs" },
    env: { XDG_SESSION_TYPE: "x11", LIBVA_DRIVER_NAME: "nvidia" },
};

function setup() {
    const gpu = {
        info: vi.fn(async () => structuredClone(report)),
        setHardwareAcceleration: vi.fn(async () => {}),
        relaunch: vi.fn(),
    };
    (window as unknown as { desktop: unknown }).desktop = { gpu };
    // H.264 on the GPU, HEVC in software only, the rest unsupported.
    (globalThis as unknown as { MediaSource: unknown }).MediaSource = {
        isTypeSupported: (type: string) => /avc1|hvc1/.test(type),
    };
    Object.defineProperty(navigator, "mediaCapabilities", {
        configurable: true,
        value: {
            decodingInfo: async ({
                video,
            }: {
                video: { contentType: string };
            }) => ({
                supported: true,
                smooth: true,
                powerEfficient: video.contentType.includes("avc1"),
            }),
        },
    });
    return gpu;
}

async function render() {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(GpuDebug, { target: host });
    flushSync();
    await vi.waitFor(() => {
        if (host!.textContent?.includes("Loading")) throw new Error("loading");
    });
    flushSync();
}

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
    delete (window as unknown as { desktop?: unknown }).desktop;
    flushSync();
});

describe("GpuDebug", () => {
    it("shows feature status and which codecs decode on the GPU", async () => {
        setup();
        await render();
        const text = host!.textContent ?? "";
        expect(text).toContain("video_decode");
        const row = (name: string) =>
            [...host!.querySelectorAll("div")].find(
                (d) => d.firstElementChild?.textContent === name,
            )?.lastElementChild?.textContent;
        expect(row("H.264")).toBe("Hardware");
        expect(row("HEVC")).toBe("Software");
        expect(row("AV1")).toBe("Not supported");
        expect(text).toContain("VaapiOnNvidiaGPUs");
    });

    it("saves the switch and offers a restart once it differs from launch", async () => {
        const gpu = setup();
        await render();
        expect(host!.textContent).not.toContain("Restart Zam");

        host!.querySelector<HTMLElement>('[role="switch"]')!.click();
        await vi.waitFor(() =>
            expect(gpu.setHardwareAcceleration).toHaveBeenCalledWith(false),
        );
        flushSync();
        expect(host!.textContent).toContain("Restart Zam");

        [...host!.querySelectorAll("button")]
            .find((b) => b.textContent?.trim() === "Restart")!
            .click();
        expect(gpu.relaunch).toHaveBeenCalled();
    });
});
