import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";

vi.mock("$lib/stores/mediaAuth.svelte", async (orig) => {
    const real = await orig<typeof import("$lib/stores/mediaAuth.svelte")>();
    return { ...real, isAuthedMediaUrl: () => true };
});

import Avatar from "./Avatar.svelte";

let instance: Record<string, unknown> | null = null;
afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
});

describe("Avatar thumbnails", () => {
    it("asks the server for an animated thumbnail sized to the box", async () => {
        const host = document.createElement("div");
        document.body.appendChild(host);
        instance = mount(Avatar, {
            target: host,
            props: {
                src: "https://hs/_matrix/client/v1/media/download/a/b",
                size: 40,
            },
        });
        flushSync();
        const src = host.querySelector("img")?.getAttribute("src") ?? "";
        expect(src).toContain("/_matrix/client/v1/media/thumbnail/a/b?");
        expect(src).toContain("method=crop");
        expect(src).toContain("animated=true");
    });
});
