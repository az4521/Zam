import { describe, it, expect, beforeEach } from "vitest";
import {
    planEmojiPreload,
    warmUrls,
    preloadEmojiPacks,
    __resetEmojiPreloadCache,
    EMOJI_PRELOAD_CAP,
    EMOJI_PRELOAD_CONCURRENCY,
} from "./emojiPreload";

function pack(...urls: (string | null | undefined)[]) {
    return { emojis: urls.map((url) => ({ url })) };
}

describe("planEmojiPreload", () => {
    it("flattens every pack's image urls in order", () => {
        const plan = planEmojiPreload([pack("a", "b"), pack("c")], new Set());
        expect(plan).toEqual(["a", "b", "c"]);
    });

    it("dedupes urls that repeat across packs", () => {
        const plan = planEmojiPreload(
            [pack("a", "b"), pack("b", "c", "a")],
            new Set(),
        );
        expect(plan).toEqual(["a", "b", "c"]);
    });

    it("skips urls already warmed", () => {
        const plan = planEmojiPreload([pack("a", "b", "c")], new Set(["b"]));
        expect(plan).toEqual(["a", "c"]);
    });

    it("drops falsy / non-string urls", () => {
        const plan = planEmojiPreload(
            [pack("a", null, undefined, ""), pack("b")],
            new Set(),
        );
        expect(plan).toEqual(["a", "b"]);
    });

    it("caps the total number of urls", () => {
        const plan = planEmojiPreload([pack("a", "b", "c", "d")], new Set(), 2);
        expect(plan).toEqual(["a", "b"]);
    });

    it("returns nothing for empty packs", () => {
        expect(planEmojiPreload([], new Set())).toEqual([]);
        expect(planEmojiPreload([pack()], new Set())).toEqual([]);
    });

    it("defaults to the module cap", () => {
        const many = Array.from(
            { length: EMOJI_PRELOAD_CAP + 50 },
            (_, i) => `u${i}`,
        );
        const plan = planEmojiPreload([pack(...many)], new Set());
        expect(plan.length).toBe(EMOJI_PRELOAD_CAP);
    });
});

describe("warmUrls", () => {
    it("calls the loader once per url and marks each warmed", async () => {
        const loaded: string[] = [];
        const warmed = new Set<string>();
        await warmUrls(["a", "b", "c"], warmed, {
            load: async (u) => {
                loaded.push(u);
            },
        });
        expect(loaded.sort()).toEqual(["a", "b", "c"]);
        expect([...warmed].sort()).toEqual(["a", "b", "c"]);
    });

    it("never exceeds the concurrency limit", async () => {
        let active = 0;
        let peak = 0;
        const warmed = new Set<string>();
        const urls = Array.from({ length: 12 }, (_, i) => `u${i}`);
        await warmUrls(urls, warmed, {
            concurrency: 3,
            load: async () => {
                active++;
                peak = Math.max(peak, active);
                await Promise.resolve();
                await Promise.resolve();
                active--;
            },
        });
        expect(peak).toBeLessThanOrEqual(3);
        expect(warmed.size).toBe(12);
    });

    it("does not re-load urls already in the warmed set", async () => {
        const loaded: string[] = [];
        const warmed = new Set<string>(["a"]);
        await warmUrls(["a", "b"], warmed, {
            load: async (u) => {
                loaded.push(u);
            },
        });
        expect(loaded).toEqual(["b"]);
    });

    it("keeps going when a loader rejects (best-effort)", async () => {
        const loaded: string[] = [];
        const warmed = new Set<string>();
        await warmUrls(["a", "b", "c"], warmed, {
            load: async (u) => {
                if (u === "b") throw new Error("boom");
                loaded.push(u);
            },
        });
        expect(loaded.sort()).toEqual(["a", "c"]);
        // still marked warmed so it is not retried this session
        expect(warmed.has("b")).toBe(true);
    });
});

describe("preloadEmojiPacks", () => {
    beforeEach(() => __resetEmojiPreloadCache());

    it("plans and schedules the packs' urls, returning what it scheduled", () => {
        const scheduled = preloadEmojiPacks([pack("a", "b")], {
            load: async () => {},
        });
        expect(scheduled).toEqual(["a", "b"]);
    });

    it("dedupes across calls within a session", () => {
        const first = preloadEmojiPacks([pack("a", "b")], {
            load: async () => {},
        });
        const second = preloadEmojiPacks([pack("b", "c")], {
            load: async () => {},
        });
        expect(first).toEqual(["a", "b"]);
        expect(second).toEqual(["c"]);
    });

    it("resets its session cache", () => {
        preloadEmojiPacks([pack("a")], { load: async () => {} });
        __resetEmojiPreloadCache();
        const again = preloadEmojiPacks([pack("a")], { load: async () => {} });
        expect(again).toEqual(["a"]);
    });

    it("exposes sane default constants", () => {
        expect(EMOJI_PRELOAD_CAP).toBeGreaterThan(0);
        expect(EMOJI_PRELOAD_CONCURRENCY).toBeGreaterThan(0);
        expect(EMOJI_PRELOAD_CONCURRENCY).toBeLessThanOrEqual(6);
    });
});
