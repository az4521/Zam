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
    const autoToggle = () =>
        host!.querySelector<HTMLElement>(
            '[role="switch"][aria-label="Automatic"]',
        ) ?? host!.querySelector<HTMLElement>('[aria-label="Automatic"]');

    it("runs a manual cap from 300 kbps to 50 Mbps, sent as picked", () => {
        noteUploadEstimate(2_000_000);
        const slider = render();
        expect(host!.textContent).toContain("4 Mbps");
        release(slider, 1000);
        expect(settingsState.screenShareBitrate).toBe(50_000_000);
        release(slider, 0);
        expect(settingsState.screenShareBitrate).toBe(300_000);
        expect(host!.textContent).toContain("300 kbps");
    });

    it("has no cap in automatic mode and shows the live upload", () => {
        setScreenShareBitrate(0);
        noteUploadEstimate(20_000_000);
        render();
        expect(host!.querySelector('input[type="range"]')).toBeNull();
        expect(host!.textContent).toContain("No limit");
        expect(host!.textContent).toContain("20 Mbps");
    });

    it("says when the upload isn't known yet", () => {
        setScreenShareBitrate(0);
        render();
        expect(host!.textContent).toContain("followed live");
    });

    it("switches between automatic and a manual cap", () => {
        noteUploadEstimate(12_000_000);
        const onQualityChange = vi.fn();
        render(onQualityChange);
        autoToggle()!.click();
        flushSync();
        expect(settingsState.screenShareBitrate).toBe(0);
        expect(onQualityChange).toHaveBeenCalledTimes(1);
        autoToggle()!.click();
        flushSync();
        // A manual cap starts at what the upload carries now.
        expect(settingsState.screenShareBitrate).toBe(12_000_000);
    });

    it("retargets a live share on release, not while dragging", () => {
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
            picked: "h264",
            encrypted: false,
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
            picked: "h265",
            encrypted: false,
        };
        render();
        expect(chip("HEVC")?.getAttribute("aria-pressed")).toBe("true");
        expect(host!.textContent).toContain("can't play HEVC");
    });

    it("says when an encrypted call falls back from the pick", () => {
        voiceCallState.codecs = {
            sendable: ["h265", "h264", "vp8"],
            available: ["h264", "vp8"],
            hardware: [],
            current: "h264",
            picked: "h265",
            encrypted: true,
        };
        render();
        expect(chip("HEVC")).toBeUndefined();
        expect(chip("H.264")?.getAttribute("aria-pressed")).toBe("true");
        expect(host!.textContent).toContain(
            "can't play HEVC, so you're sending H.264",
        );
        // Settling on what's being sent is still a pick.
        chip("H.264")!.click();
        expect(switchCallVideoCodec).toHaveBeenCalledWith("h264");
    });
});
