import { describe, expect, it } from "vitest";
import { TextUndoHistory, diffCaret, undoKind } from "./textUndo";

describe("TextUndoHistory", () => {
    it("coalesces quick typing into one step", () => {
        let now = 0;
        const undo = new TextUndoHistory("", () => now);
        undo.record("a", "insert");
        now = 100;
        undo.record("ab", "insert");
        now = 5000;
        undo.record("ab c", "insert");
        expect(undo.step(-1)).toBe("ab");
        expect(undo.step(-1)).toBe("");
        expect(undo.step(-1)).toBeNull();
        expect(undo.step(1)).toBe("ab");
    });

    it("never coalesces programmatic changes, and a new edit drops redo", () => {
        const undo = new TextUndoHistory("x");
        undo.record("x😄 ", null);
        undo.record("x😄 y", null);
        expect(undo.step(-1)).toBe("x😄 ");
        undo.record("x😄 z", "insert");
        expect(undo.step(1)).toBeNull();
    });

    it("starts fresh on a programmatic clear", () => {
        const undo = new TextUndoHistory("abc");
        undo.record("", null);
        expect(undo.step(-1)).toBeNull();
    });
});

describe("undo helpers", () => {
    it("groups input types", () => {
        expect(undoKind("insertText")).toBe("insert");
        expect(undoKind("deleteContentBackward")).toBe("delete");
        expect(undoKind("insertFromPaste")).toBe("insertFromPaste");
    });

    it("puts the caret at the end of the changed span", () => {
        expect(diffCaret("hello world", "hello brave world")).toBe(12);
        expect(diffCaret("abc", "ab")).toBe(2);
    });
});
