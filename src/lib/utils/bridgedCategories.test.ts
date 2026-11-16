import { describe, expect, it } from "vitest";
import {
    CATEGORY_KEY,
    groupByCategory,
    parseSpaceChildCategory,
} from "./bridgedCategories";

describe("parseSpaceChildCategory", () => {
    it("reads the category on a live space child", () => {
        expect(
            parseSpaceChildCategory({
                via: ["x"],
                [CATEGORY_KEY]: { id: "123", name: "Text Channels" },
            }),
        ).toEqual({ id: "123", name: "Text Channels" });
    });

    it("falls back to the id when the name is missing", () => {
        expect(
            parseSpaceChildCategory({
                via: ["x"],
                [CATEGORY_KEY]: { id: "9" },
            }),
        ).toEqual({ id: "9", name: "9" });
    });

    it("ignores removed children, missing keys and bad content", () => {
        expect(
            parseSpaceChildCategory({ [CATEGORY_KEY]: { id: "1", name: "a" } }),
        ).toBeNull();
        expect(parseSpaceChildCategory({ via: ["x"] })).toBeNull();
        expect(
            parseSpaceChildCategory({ via: ["x"], [CATEGORY_KEY]: { id: "" } }),
        ).toBeNull();
        expect(
            parseSpaceChildCategory({ via: ["x"], [CATEGORY_KEY]: ["1"] }),
        ).toBeNull();
        expect(parseSpaceChildCategory(null)).toBeNull();
    });
});

describe("groupByCategory", () => {
    const cats: Record<string, { id: string; name: string }> = {
        a1: { id: "A", name: "Alpha" },
        a2: { id: "A", name: "Alpha" },
        b1: { id: "B", name: "Beta" },
    };
    const of = (id: string) => cats[id] ?? null;

    it("puts uncategorised first, then categories by first appearance", () => {
        const groups = groupByCategory(
            ["b1", "x", "a1", "y", "a2"],
            (i) => i,
            of,
        );
        expect(groups).toEqual([
            { category: null, items: ["x", "y"] },
            { category: { id: "B", name: "Beta" }, items: ["b1"] },
            { category: { id: "A", name: "Alpha" }, items: ["a1", "a2"] },
        ]);
    });

    it("has no uncategorised group when everything has a category", () => {
        expect(groupByCategory(["a1"], (i) => i, of)).toEqual([
            { category: { id: "A", name: "Alpha" }, items: ["a1"] },
        ]);
    });
});
