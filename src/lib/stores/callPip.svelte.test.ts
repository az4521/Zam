import { describe, it, expect, afterEach, vi } from "vitest";
import type { Track } from "livekit-client";
import {
    callPipState,
    closePipWindow,
    openPipWindow,
    showPipTrack,
} from "./callPip.svelte";

const fakeTrack = () =>
    ({ attach: vi.fn(), detach: vi.fn() }) as unknown as Track;

function stubRequest(impl: (this: HTMLVideoElement) => Promise<unknown>) {
    HTMLVideoElement.prototype.requestPictureInPicture = impl as never;
    Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
        configurable: true,
        get: () => 4,
    });
}

const opened = () => document.querySelector("video")!;

afterEach(() => {
    closePipWindow();
    callPipState.windowOpen = false;
    callPipState.pinnedKey = null;
});

describe("call picture-in-picture window", () => {
    it("opens on its own video, not a tile's", async () => {
        stubRequest(async function () {
            this.dispatchEvent(new Event("enterpictureinpicture"));
        });
        const track = fakeTrack();
        await openPipWindow("k", track);
        expect(callPipState.windowOpen).toBe(true);
        expect(callPipState.pinnedKey).toBe("k");
        expect(track.attach).toHaveBeenCalledWith(opened());
    });

    it("cleans up when the browser refuses", async () => {
        stubRequest(() => Promise.reject(new DOMException("no")));
        const track = fakeTrack();
        await openPipWindow("k", track);
        expect(callPipState.windowOpen).toBe(false);
        expect(callPipState.pinnedKey).toBeNull();
        expect(track.detach).toHaveBeenCalled();
        expect(document.querySelector("video")).toBeNull();
    });

    it("swaps tracks in an open window without asking for it again", async () => {
        const request = vi.fn(async function (this: HTMLVideoElement) {
            this.dispatchEvent(new Event("enterpictureinpicture"));
        });
        stubRequest(request as never);
        const first = fakeTrack();
        const second = fakeTrack();
        await openPipWindow("a", first);
        await openPipWindow("b", second);
        expect(callPipState.pinnedKey).toBe("b");
        expect(request).toHaveBeenCalledTimes(1);
        showPipTrack(second);
        expect(first.detach).toHaveBeenCalled();
        expect(second.attach).toHaveBeenCalled();
    });

    it("releases everything when the user closes the window", async () => {
        stubRequest(async function () {
            this.dispatchEvent(new Event("enterpictureinpicture"));
        });
        const track = fakeTrack();
        await openPipWindow("k", track);
        opened().dispatchEvent(new Event("leavepictureinpicture"));
        expect(callPipState.windowOpen).toBe(false);
        expect(callPipState.pinnedKey).toBeNull();
        expect(track.detach).toHaveBeenCalled();
        expect(document.querySelector("video")).toBeNull();
    });
});
