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

function setup(extra: Record<string, unknown> = {}) {
    const gpu = {
        info: vi.fn(async () => ({ ...structuredClone(report), ...extra })),
        setHardwareAcceleration: vi.fn(async () => {}),
        setNvidiaVideo: vi.fn(async () => {}),
        setVideoEncode: vi.fn(async () => {}),
        setNvidiaEncode: vi.fn(async () => {}),
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
    delete (globalThis as unknown as { VideoEncoder?: unknown }).VideoEncoder;
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

    it("saves the NVIDIA video path choice and offers a restart", async () => {
        const gpu = setup({
            nvidiaVideo: {
                mode: "auto",
                activeAtLaunch: false,
                detected: false,
                failedAt: 1,
            },
        });
        await render();
        expect(host!.textContent).toContain("went back to the GL path");
        const select = host!.querySelector("select")!;
        select.value = "vulkan";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        await vi.waitFor(() =>
            expect(gpu.setNvidiaVideo).toHaveBeenCalledWith("vulkan"),
        );
        flushSync();
        expect(host!.textContent).toContain("Restart Zam");
        expect(host!.textContent).not.toContain("went back to the GL path");
    });

    it("hides the NVIDIA video path outside Flatpak", async () => {
        setup({ nvidiaVideo: null });
        await render();
        expect(host!.querySelector("select")).toBeNull();
    });

    it("shows which codecs encode on the GPU", async () => {
        setup();
        // VP8 on the GPU, H.264 in software only, the rest unsupported.
        (globalThis as unknown as { VideoEncoder: unknown }).VideoEncoder = {
            isConfigSupported: async ({
                codec,
                hardwareAcceleration,
            }: {
                codec: string;
                hardwareAcceleration: string;
            }) => ({
                supported:
                    codec === "vp8" ||
                    (codec.startsWith("avc1") &&
                        hardwareAcceleration !== "prefer-hardware"),
            }),
        };
        await render();
        const rows = [...host!.querySelectorAll("div")].filter(
            (d) => d.childElementCount === 2,
        );
        const row = (name: string) =>
            rows.filter((d) => d.firstElementChild?.textContent === name).at(-1)
                ?.lastElementChild?.textContent;
        expect(host!.textContent).toContain("Video encoding");
        expect(row("VP8")).toBe("Hardware");
        expect(row("H.264")).toBe("Software");
        expect(row("AV1")).toBe("Not supported");
    });

    it("saves the Linux encode switch and offers a restart", async () => {
        const gpu = setup({
            videoEncode: { enabled: true, activeAtLaunch: true },
        });
        await render();
        const switches = host!.querySelectorAll<HTMLElement>('[role="switch"]');
        expect(switches).toHaveLength(2);
        switches[1].click();
        await vi.waitFor(() =>
            expect(gpu.setVideoEncode).toHaveBeenCalledWith(false),
        );
        flushSync();
        expect(host!.textContent).toContain("Restart Zam");
    });

    it("hides the encode switch off Linux", async () => {
        setup({ videoEncode: null });
        await render();
        expect(host!.querySelectorAll('[role="switch"]')).toHaveLength(1);
    });

    it("saves the NVIDIA encode switch and offers a restart", async () => {
        const gpu = setup({
            nvidiaEncode: { enabled: false, activeAtLaunch: false },
        });
        await render();
        expect(host!.textContent).toContain("NVIDIA video encoding");
        const switches = host!.querySelectorAll<HTMLElement>('[role="switch"]');
        switches[switches.length - 1].click();
        await vi.waitFor(() =>
            expect(gpu.setNvidiaEncode).toHaveBeenCalledWith(true),
        );
        flushSync();
        expect(host!.textContent).toContain("Restart Zam");
    });

    it("hides the NVIDIA encode switch outside Flatpak", async () => {
        setup({ nvidiaEncode: null });
        await render();
        expect(host!.textContent).not.toContain("NVIDIA video encoding");
    });
});
