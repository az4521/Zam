import { describe, it, expect } from "vitest";
import {
    packKey,
    usageFromFlags,
    sortPackImages,
    sortEmotePacks,
} from "./imagePacks";
import type { CustomImagePack, CustomPackImage } from "$lib/matrix/client";

function img(shortcode: string): CustomPackImage {
    return {
        shortcode,
        mxcUrl: `mxc://x/${shortcode}`,
        url: `https://x/${shortcode}`,
        usage: ["emoticon"],
        canEmoji: true,
        canSticker: false,
    };
}

function pack(over: Partial<CustomImagePack>): CustomImagePack {
    return {
        id: over.id ?? "id",
        roomId: over.roomId ?? "!r:x",
        stateKey: over.stateKey ?? "",
        name: over.name ?? "Pack",
        sourceName: over.sourceName ?? "Src",
        inherited: over.inherited ?? false,
        avatarUrl: over.avatarUrl,
        images: over.images ?? [],
    };
}

describe("packKey", () => {
    it("returns the state key when present", () => {
        expect(packKey({ stateKey: "x" })).toBe("x");
    });
    it("returns empty string when absent", () => {
        expect(packKey({})).toBe("");
    });
});

describe("usageFromFlags", () => {
    it("emoji only", () => {
        expect(usageFromFlags(true, false)).toEqual(["emoticon"]);
    });
    it("sticker only", () => {
        expect(usageFromFlags(false, true)).toEqual(["sticker"]);
    });
    it("both", () => {
        expect(usageFromFlags(true, true)).toEqual(["emoticon", "sticker"]);
    });
    it("neither", () => {
        expect(usageFromFlags(false, false)).toEqual([]);
    });
});

describe("sortPackImages", () => {
    it("sorts shortcodes case-insensitively", () => {
        const out = sortPackImages([img("Beta"), img("alpha"), img("Gamma")]);
        expect(out.map((i) => i.shortcode)).toEqual(["alpha", "Beta", "Gamma"]);
    });
    it("does not mutate the input", () => {
        const input = [img("b"), img("a")];
        sortPackImages(input);
        expect(input.map((i) => i.shortcode)).toEqual(["b", "a"]);
    });
});

describe("sortEmotePacks", () => {
    it("puts inherited packs after non-inherited", () => {
        const out = sortEmotePacks([
            pack({ id: "1", inherited: true, name: "AAA" }),
            pack({ id: "2", inherited: false, name: "ZZZ" }),
        ]);
        expect(out.map((p) => p.id)).toEqual(["2", "1"]);
    });
    it("breaks ties by sourceName then name", () => {
        const out = sortEmotePacks([
            pack({ id: "a", sourceName: "S2", name: "N1" }),
            pack({ id: "b", sourceName: "S1", name: "N2" }),
            pack({ id: "c", sourceName: "S1", name: "N1" }),
        ]);
        expect(out.map((p) => p.id)).toEqual(["c", "b", "a"]);
    });
    it("sorts each pack's images", () => {
        const out = sortEmotePacks([
            pack({ id: "p", images: [img("b"), img("a")] }),
        ]);
        expect(out[0].images.map((i) => i.shortcode)).toEqual(["a", "b"]);
    });
});
