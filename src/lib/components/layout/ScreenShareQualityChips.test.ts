import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import ScreenShareQualityChips from "./ScreenShareQualityChips.svelte";
import {
    settingsState,
    setScreenShareBitrate,
} from "$lib/stores/settings.svelte";
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
