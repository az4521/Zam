import { describe, it, expect, afterEach } from "vitest";
import { mount, unmount, flushSync, tick } from "svelte";
import Avatar from "./Avatar.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

function render(props: Record<string, unknown>) {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(Avatar, { target: host, props });
    flushSync();
}

afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
    flushSync();
});

describe("Avatar", () => {
    it("renders an <img> when a src is provided", () => {
        render({ src: "https://hs/media/x", name: "Alice" });
        expect(host!.querySelector("img")).not.toBeNull();
    });

    it("renders initials (no <img>) when src is null", () => {
        render({ src: null, name: "Alice" });
        expect(host!.querySelector("img")).toBeNull();
        expect((host!.textContent ?? "").trim().length).toBeGreaterThan(0);
    });

    it("falls back to initials after the image fails repeatedly", async () => {
        render({ src: "https://hs/media/broken", name: "Alice" });
        // Authenticated-media failures (SW not controlling yet) surface as <img>
        // error events. The component retries a couple of times, then must give
        // up and show initials instead of a broken-image glyph.
        for (let i = 0; i < 5; i++) {
            const img = host!.querySelector("img");
            if (!img) break;
            img.dispatchEvent(new Event("error"));
            await tick();
            flushSync();
        }
        expect(
            host!.querySelector("img"),
            "image should be dropped for initials once retries are exhausted",
        ).toBeNull();
        expect((host!.textContent ?? "").trim().length).toBeGreaterThan(0);
    });
});
