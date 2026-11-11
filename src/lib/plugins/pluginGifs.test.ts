import { describe, it, expect } from "vitest";
import { gifProviderProblem, normalizeProviderPage } from "./pluginGifs";

describe("gifProviderProblem", () => {
    const ok = { id: "a", label: "A", search: async () => ({}) };
    it("accepts a complete provider", () => {
        expect(gifProviderProblem(ok as never)).toBeNull();
    });
    it("rejects a missing id, label or search", () => {
        expect(gifProviderProblem({ ...ok, id: "" } as never)).toMatch(/id/);
        expect(gifProviderProblem({ ...ok, label: " " } as never)).toMatch(
            /label/,
        );
        expect(gifProviderProblem({ ...ok, search: 1 } as never)).toMatch(
            /search/,
        );
    });
});

describe("normalizeProviderPage", () => {
    it("keeps good items and falls back previewUrl to url", () => {
        const page = normalizeProviderPage({
            items: [{ id: 1, url: "https://x.example/a.gif", width: 10 }],
            hasNext: 1,
        });
        expect(page.hasNext).toBe(true);
        expect(page.items).toEqual([
            {
                id: "1",
                url: "https://x.example/a.gif",
                previewUrl: "https://x.example/a.gif",
                width: 10,
                height: 0,
            },
        ]);
    });
    it("drops non-http(s) urls, bad items and repeated ids", () => {
        const page = normalizeProviderPage({
            items: [
                { id: "a", url: "javascript:alert(1)" },
                { id: "b", url: "https://x.example/b.gif", pageUrl: "data:x" },
                { id: "b", url: "https://x.example/b2.gif" },
                null,
                { id: "c" },
            ],
        });
        expect(page.items.map((i) => i.id)).toEqual(["b"]);
        expect(page.items[0].pageUrl).toBeUndefined();
        expect(page.hasNext).toBe(false);
    });
    it("survives garbage", () => {
        expect(normalizeProviderPage(null)).toEqual({
            items: [],
            hasNext: false,
        });
        expect(normalizeProviderPage({ items: "x" }).items).toEqual([]);
    });
});
