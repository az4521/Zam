import { describe, it, expect, vi, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";

vi.mock("$lib/stores/mediaAuth.svelte", async (orig) => {
    const real = await orig<typeof import("$lib/stores/mediaAuth.svelte")>();
    return {
        ...real,
        isAuthedMediaUrl: () => true,
        shrunkMediaUrl: vi.fn(async () => "blob:small"),
    };
});

import Avatar from "./Avatar.svelte";
import { shrunkMediaUrl } from "$lib/stores/mediaAuth.svelte";

let instance: Record<string, unknown> | null = null;
afterEach(() => {
    if (instance) unmount(instance);
    instance = null;
});

describe("Avatar shrinking", () => {
    it("shows the small copy and asks for it once", async () => {
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
        for (let i = 0; i < 5; i++) {
            await Promise.resolve();
            flushSync();
        }
        expect(host.querySelector("img")?.getAttribute("src")).toBe(
            "blob:small",
        );
        expect(shrunkMediaUrl).toHaveBeenCalledTimes(1);
    });
});
