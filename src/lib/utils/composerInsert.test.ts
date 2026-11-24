import { describe, it, expect } from "vitest";
import { composerInsertText, insertAtSelection } from "./composerInsert";

describe("insertAtSelection", () => {
    it("inserts at the caret, not the end", () => {
        expect(
            insertAtSelection("Type a message", "😀", { start: 4, end: 4 }),
        ).toEqual({ text: "Type😀 a message", caret: 6 });
    });

    it("replaces the selected text", () => {
        expect(
            insertAtSelection("Type a message", ":x:", { start: 5, end: 6 }),
        ).toEqual({ text: "Type :x: message", caret: 8 });
    });

    it("appends without a selection", () => {
        expect(insertAtSelection("hi", "😀", null)).toEqual({
            text: "hi😀",
            caret: 4,
        });
        expect(insertAtSelection("hi", "u", null, true)).toEqual({
            text: "hi u",
            caret: 4,
        });
    });

    it("pads a word insert against neighbouring text only", () => {
        expect(
            insertAtSelection("ab", "u", { start: 1, end: 1 }, true),
        ).toEqual({ text: "a u b", caret: 3 });
        expect(
            insertAtSelection("a b", "u", { start: 2, end: 2 }, true),
        ).toEqual({ text: "a u b", caret: 3 });
        expect(insertAtSelection("", "u", { start: 0, end: 0 }, true)).toEqual({
            text: "u",
            caret: 1,
        });
    });

    it("clamps a stale selection to the text", () => {
        expect(insertAtSelection("hi", "!", { start: 9, end: 12 })).toEqual({
            text: "hi!",
            caret: 3,
        });
    });
});

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
