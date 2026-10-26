import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";

const { switchCallVideoCodec } = vi.hoisted(() => ({
    switchCallVideoCodec: vi.fn(async () => {}),
}));
vi.mock("$lib/matrix/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("$lib/matrix/client")>()),
    switchCallVideoCodec,
}));
import { mount, unmount, flushSync } from "svelte";
import ScreenShareQualityChips from "./ScreenShareQualityChips.svelte";
import {
    settingsState,
    setScreenShareBitrate,
} from "$lib/stores/settings.svelte";
import { voiceCallState } from "$lib/stores/voiceCall.svelte";
import {
    uploadEstimate,
    noteUploadEstimate,
} from "$lib/stores/uploadEstimate.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

function render(onQualityChange?: (res: string, fps: number) => void) {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(ScreenShareQualityChips, {
        target: host,
        props: { onQualityChange },
    });
    flushSync();
    return host.querySelector<HTMLInputElement>('input[type="range"]')!;
}

function release(slider: HTMLInputElement, position: number) {
    slider.value = String(position);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
}

beforeEach(() => {
    uploadEstimate.live = null;
    uploadEstimate.peak = null;
    setScreenShareBitrate(4_000_000);
});

afterEach(() => {
    voiceCallState.codecs = null;
    switchCallVideoCodec.mockClear();
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
});

describe("ScreenShareQualityChips bitrate", () => {
    it("goes up to 10% under the measured upload", () => {
        noteUploadEstimate(20_000_000);
        const slider = render();
        expect(host!.textContent).toContain("20 Mbps");
        expect(host!.textContent).toContain("18 Mbps");
        expect(host!.textContent).toContain("4 Mbps");
        release(slider, 1000);
        expect(settingsState.screenShareBitrate).toBe(18_000_000);
        release(slider, 0);
        expect(settingsState.screenShareBitrate).toBe(300_000);
        expect(host!.textContent).toContain("300 kbps");
    });

    it("says when nothing has been measured", () => {
        render();
        expect(host!.textContent).toContain("hasn't been measured");
        expect(host!.textContent).toContain("10 Mbps");
    });

    it("shows a saved pick above the ceiling at the ceiling", () => {
        noteUploadEstimate(2_000_000);
        const slider = render();
        expect(slider.value).toBe("1000");
        expect(host!.textContent).toContain("1.8 Mbps");
    });

    it("retargets a live share on release, not while dragging", () => {
        noteUploadEstimate(20_000_000);
        const onQualityChange = vi.fn();
        const slider = render(onQualityChange);
        slider.value = "500";
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        flushSync();
        expect(onQualityChange).not.toHaveBeenCalled();
        slider.dispatchEvent(new Event("change", { bubbles: true }));
        expect(onQualityChange).toHaveBeenCalledWith(
            settingsState.screenShareResolution,
            Number(settingsState.screenShareFps),
        );
    });
});

describe("ScreenShareQualityChips codec", () => {
    const chip = (label: string) =>
        [...host!.querySelectorAll("button")].find((b) =>
            b.textContent?.trim().startsWith(label),
        );

    it("isn't shown outside a call", () => {
        render();
        expect(host!.textContent).not.toContain("Video codec");
    });

    it("lists what everyone can play, marks hardware, and switches", () => {
        voiceCallState.codecs = {
            sendable: ["av1", "h265", "vp9", "h264", "vp8"],
            available: ["vp9", "h264", "vp8"],
            hardware: ["h264"],
            current: "h264",
        };
        render();
        expect(chip("AV1")).toBeUndefined();
        expect(chip("HEVC")).toBeUndefined();
        expect(chip("H.264")?.getAttribute("aria-pressed")).toBe("true");
        expect(chip("H.264")?.textContent).toContain("HW");
        expect(chip("VP9")?.textContent).not.toContain("HW");
        expect(host!.textContent).toContain("everyone in the call can play");
        chip("VP9")!.click();
        expect(switchCallVideoCodec).toHaveBeenCalledWith("vp9");
        chip("H.264")!.click();
        expect(switchCallVideoCodec).toHaveBeenCalledTimes(1);
    });

    it("keeps a codec someone can't play, and says they get H.264", () => {
        voiceCallState.codecs = {
            sendable: ["h265", "h264", "vp8"],
            available: ["h264", "vp8"],
            hardware: ["h265", "h264"],
            current: "h265",
        };
        render();
        expect(chip("HEVC")?.getAttribute("aria-pressed")).toBe("true");
        expect(host!.textContent).toContain("can't play HEVC");
    });
});
