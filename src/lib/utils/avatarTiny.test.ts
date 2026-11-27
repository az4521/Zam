import { beforeEach, describe, expect, it, vi } from "vitest";

const DATA = "data:image/webp;base64,AAAA";

async function fresh() {
    vi.resetModules();
    return await import("./avatarTiny");
}

describe("avatarTiny", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useFakeTimers();
    });

    it("returns nothing for an avatar it has not seen", async () => {
        const t = await fresh();
        expect(t.tinyAvatarFor("https://hs/a")).toBeNull();
        expect(t.tinyAvatarFor(null)).toBeNull();
    });

    it("remembers a tiny copy and persists it for the next launch", async () => {
        const t = await fresh();
        t.rememberTinyAvatar("https://hs/a", DATA);
        expect(t.tinyAvatarFor("https://hs/a")).toBe(DATA);
        vi.advanceTimersByTime(2500);
        const next = await fresh();
        expect(next.tinyAvatarFor("https://hs/a")).toBe(DATA);
    });

    it("refuses anything that is not a small image data URL", async () => {
        const t = await fresh();
        t.rememberTinyAvatar("https://hs/a", "https://evil/x.png");
        t.rememberTinyAvatar(
            "https://hs/b",
            "data:image/png;base64," + "A".repeat(2000),
        );
        expect(t.tinyAvatarFor("https://hs/a")).toBeNull();
        expect(t.tinyAvatarFor("https://hs/b")).toBeNull();
    });

    it("drops the oldest once over the cap", async () => {
        const t = await fresh();
        for (let i = 0; i < t.AVATAR_TINY_MAX + 3; i++)
            t.rememberTinyAvatar(`https://hs/${i}`, DATA);
        expect(t.tinyAvatarFor("https://hs/0")).toBeNull();
        expect(t.tinyAvatarFor("https://hs/2")).toBeNull();
        expect(t.tinyAvatarFor("https://hs/3")).toBe(DATA);
        expect(t.tinyAvatarFor(`https://hs/${t.AVATAR_TINY_MAX + 2}`)).toBe(
            DATA,
        );
    });

    it("survives a corrupt saved record", async () => {
        localStorage.setItem("moe.crafty.matrix.avatar_tiny", "{not json");
        const t = await fresh();
        expect(t.tinyAvatarFor("https://hs/a")).toBeNull();
    });
});
