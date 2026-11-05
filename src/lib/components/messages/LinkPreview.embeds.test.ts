import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import LinkPreview from "./LinkPreview.svelte";
import { settingsState } from "$lib/stores/settings.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;
let fireFar: (isIntersecting: boolean) => void = () => {};

class FakeObserver {
    constructor(
        cb: IntersectionObserverCallback,
        opts?: IntersectionObserverInit,
    ) {
        if (opts?.rootMargin)
            fireFar = (isIntersecting) =>
                cb(
                    [{ isIntersecting } as IntersectionObserverEntry],
                    this as unknown as IntersectionObserver,
                );
    }
    observe() {}
    disconnect() {}
}

describe("LinkPreview embeds", () => {
    beforeEach(() => {
        vi.stubGlobal("IntersectionObserver", FakeObserver);
        settingsState.linkPreviewMedia = "all";
    });
    afterEach(() => {
        if (instance) unmount(instance);
        host?.remove();
        instance = host = null;
        vi.unstubAllGlobals();
    });

    it("shows the thumbnail until played, and goes back to it when parked", () => {
        host = document.createElement("div");
        document.body.appendChild(host);
        instance = mount(LinkPreview, {
            target: host,
            props: { url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
        });
        flushSync();
        expect(host.querySelector("iframe")).toBeNull();
        expect(host.querySelector("img")?.getAttribute("src")).toBe(
            "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
        );

        host.querySelector("button")!.click();
        flushSync();
        const frame = host.querySelector("iframe")!;
        const src = new URL(frame.src);
        expect(src.pathname).toBe("/embed/jNQXAC9IVRw");
        expect(src.searchParams.get("enablejsapi")).toBe("1");
        expect(src.searchParams.get("autoplay")).toBe("1");

        window.dispatchEvent(
            new MessageEvent("message", {
                data: JSON.stringify({
                    event: "infoDelivery",
                    info: { playerState: 2, currentTime: 13.1 },
                }),
                origin: "https://www.youtube.com",
                source: frame.contentWindow,
            }),
        );
        fireFar(false);
        flushSync();
        expect(host.querySelector("iframe")).toBeNull();

        host.querySelector("button")!.click();
        flushSync();
        expect(
            new URL(host.querySelector("iframe")!.src).searchParams.get(
                "start",
            ),
        ).toBe("13");
    });

    it("mounts a tweet video only once played", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                json: async () => ({
                    tweet: {
                        author: { name: "A", screen_name: "a" },
                        text: "hi",
                        media: {
                            videos: [
                                {
                                    url: "https://video.example/v.mp4",
                                    thumbnail_url:
                                        "https://pbs.example/thumb.jpg",
                                    width: 1280,
                                    height: 720,
                                },
                            ],
                        },
                    },
                }),
            })),
        );
        host = document.createElement("div");
        document.body.appendChild(host);
        instance = mount(LinkPreview, {
            target: host,
            props: { url: "https://x.com/a/status/123" },
        });
        await vi.waitFor(() => {
            flushSync();
            expect(host!.querySelector('img[src*="thumb.jpg"]')).not.toBeNull();
        });
        expect(host.querySelector("video")).toBeNull();
        host.querySelector<HTMLButtonElement>("button[aria-label]")!.click();
        flushSync();
        expect(host.querySelector("video")?.getAttribute("src")).toBe(
            "https://video.example/v.mp4",
        );
    });
});
