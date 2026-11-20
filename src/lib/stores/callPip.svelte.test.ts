import { describe, it, expect, afterEach, vi } from "vitest";
import type { Track } from "livekit-client";
import {
    callPipState,
    closePipWindow,
    detachPipWindow,
    openPipWindow,
    pipDetachSupported,
    pipWindowSupported,
    showPipTrack,
} from "./callPip.svelte";

type DesktopBridge = NonNullable<Window["desktop"]>;

const fakeTrack = () =>
    ({ attach: vi.fn(), detach: vi.fn() }) as unknown as Track;

/** Stands in for the browser's picture-in-picture request on a video. */
function stubNativePip(
    impl: (this: HTMLVideoElement) => Promise<unknown>,
): void {
    HTMLVideoElement.prototype.requestPictureInPicture = impl as never;
    Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
        configurable: true,
        get: () => 4,
    });
    Object.defineProperty(document, "pictureInPictureEnabled", {
        configurable: true,
        get: () => true,
    });
}

const opened = () => document.querySelector("video")!;

function stubDesktop(): {
    spawnSize: ReturnType<typeof vi.fn>;
    follow: ReturnType<typeof vi.fn>;
} {
    const spawnSize = vi.fn();
    const follow = vi.fn();
    (window as unknown as { desktop: Partial<DesktopBridge> }).desktop = {
        callPip: {
            spawnSize,
            follow,
            onDocked: vi.fn(() => () => {}),
        },
    };
    return { spawnSize, follow };
}

afterEach(() => {
    closePipWindow();
    delete (window as unknown as { desktop?: unknown }).desktop;
    delete (document as unknown as { pictureInPictureEnabled?: unknown })
        .pictureInPictureEnabled;
    vi.restoreAllMocks();
    callPipState.windowOpen = false;
    callPipState.pinnedKey = null;
});

describe("call picture-in-picture: web and Android", () => {
    it("has no picture-in-picture without the desktop bridge or the browser API", () => {
        expect(pipWindowSupported()).toBe(false);
        expect(pipDetachSupported()).toBe(false);
    });

    it("does not open anything when asked to pop out", async () => {
        const open = vi.spyOn(window, "open");
        await openPipWindow("k");
        expect(open).not.toHaveBeenCalled();
        expect(callPipState.windowOpen).toBe(false);
        expect(callPipState.pinnedKey).toBeNull();
    });

    it("does not start a drag-out, so the video stays in the page", () => {
        const open = vi.spyOn(window, "open");
        expect(
            detachPipWindow("k", { width: 288, height: 162 }, { x: 1, y: 1 }),
        ).toBe(false);
        expect(open).not.toHaveBeenCalled();
        expect(callPipState.windowOpen).toBe(false);
    });
});

describe("call picture-in-picture: browser window", () => {
    it("is supported when the browser offers picture-in-picture", () => {
        stubNativePip(async () => {});
        expect(pipWindowSupported()).toBe(true);
    });

    it("is not a drag-out: that stays desktop-only", () => {
        stubNativePip(async () => {});
        expect(pipDetachSupported()).toBe(false);
    });

    it("opens on its own video, not a tile's", async () => {
        stubNativePip(async function () {
            this.dispatchEvent(new Event("enterpictureinpicture"));
        });
        const track = fakeTrack();
        await openPipWindow("k", track);
        expect(callPipState.windowOpen).toBe(true);
        expect(callPipState.pinnedKey).toBe("k");
        expect(track.attach).toHaveBeenCalledWith(opened());
    });

    it("cleans up when the browser refuses", async () => {
        stubNativePip(() => Promise.reject(new DOMException("no")));
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
        stubNativePip(request as never);
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
        stubNativePip(async function () {
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

    it("closes from the app's own close call", async () => {
        stubNativePip(async function () {
            this.dispatchEvent(new Event("enterpictureinpicture"));
        });
        const track = fakeTrack();
        await openPipWindow("k", track);
        closePipWindow();
        expect(track.detach).toHaveBeenCalled();
        expect(callPipState.windowOpen).toBe(false);
        expect(document.querySelector("video")).toBeNull();
    });
});

describe("call picture-in-picture: desktop app", () => {
    it("is supported through the preload bridge", () => {
        stubDesktop();
        expect(pipWindowSupported()).toBe(true);
        expect(pipDetachSupported()).toBe(true);
    });

    it("sizes the window and requests it by its frame name", async () => {
        const { spawnSize } = stubDesktop();
        const open = vi.spyOn(window, "open").mockReturnValue(null);
        await openPipWindow("k", null, { width: 300, height: 169 });
        expect(spawnSize).toHaveBeenCalledWith({ width: 300, height: 169 });
        expect(open).toHaveBeenCalledWith(
            "about:blank",
            "zam-call-pip",
            "popup",
        );
    });

    it("keeps no pin when the app refuses the popup", async () => {
        stubDesktop();
        vi.spyOn(window, "open").mockReturnValue(null);
        await openPipWindow("k");
        expect(callPipState.windowOpen).toBe(false);
        expect(callPipState.pinnedKey).toBeNull();
    });

    it("drags out by following the cursor from the grab point", () => {
        const { follow } = stubDesktop();
        vi.spyOn(window, "open").mockReturnValue(null);
        const grab = { x: 40, y: 10 };
        expect(detachPipWindow(null, { width: 288, height: 162 }, grab)).toBe(
            true,
        );
        expect(follow).toHaveBeenCalledWith(grab);
    });
});
