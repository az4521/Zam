import { describe, it, expect } from "vitest";
import { composerInsertText } from "./composerInsert";

describe("composerInsertText", () => {
    it("returns the insert alone when the composer is empty", () => {
        expect(composerInsertText("", "https://x/y.gif")).toBe(
            "https://x/y.gif",
        );
    });

    it("appends with a single space when the composer has text", () => {
        expect(composerInsertText("look", "https://x/y.gif")).toBe(
            "look https://x/y.gif",
        );
    });

    it("does not trim or collapse existing composer whitespace", () => {
        expect(composerInsertText("hi ", "u")).toBe("hi  u");
    });

    it("treats a purely-whitespace composer as non-empty (parity with insertGif's truthiness check)", () => {
        expect(composerInsertText(" ", "u")).toBe("  u");
    });
});
