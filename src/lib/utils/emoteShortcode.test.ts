import { describe, expect, it } from "vitest";
import { shortcodeFromFileName } from "./emoteShortcode";

describe("shortcodeFromFileName", () => {
    it("drops the extension", () => {
        expect(shortcodeFromFileName("partyparrot.gif")).toBe("partyparrot");
    });

    it("replaces characters the shortcode rules reject", () => {
        expect(shortcodeFromFileName("my cool:emote (2).png")).toBe(
            "my_cool_emote_2",
        );
    });

    it("keeps allowed punctuation inside the name", () => {
        expect(shortcodeFromFileName("a.b+c-d_e.webp")).toBe("a.b+c-d_e");
    });

    it("trims leading and trailing separators", () => {
        expect(shortcodeFromFileName("__wave__.png")).toBe("wave");
        expect(shortcodeFromFileName("..hidden.png")).toBe("hidden");
    });

    it("keeps a name without an extension", () => {
        expect(shortcodeFromFileName("noext")).toBe("noext");
    });

    it("returns empty when nothing usable remains", () => {
        expect(shortcodeFromFileName(".png")).toBe("png");
        expect(shortcodeFromFileName("!!!.png")).toBe("");
    });
});
