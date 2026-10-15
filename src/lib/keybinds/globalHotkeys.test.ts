import { describe, it, expect } from "vitest";
import {
    codeToKey,
    codesForKey,
    globalWatchList,
    keyEventFromInput,
} from "./globalHotkeys";
import { eventKey, matchesPress, parseBinding } from "./keybinds";

describe("codeToKey", () => {
    it("reads letters, digits and named keys like a browser would", () => {
        expect(codeToKey("KeyV")).toBe("v");
        expect(codeToKey("Digit7")).toBe("7");
        expect(codeToKey("Numpad7")).toBe("7");
        expect(codeToKey("F13")).toBe("f13");
        expect(codeToKey("Space")).toBe(" ");
        expect(codeToKey("ControlRight")).toBe("control");
        expect(codeToKey("MetaLeft")).toBe("meta");
        expect(codeToKey("Unknown")).toBeNull();
    });

    it("reads punctuation with the US layout, Shift included", () => {
        expect(codeToKey("Backquote")).toBe("`");
        expect(codeToKey("Slash", true)).toBe("?");
        expect(codeToKey("Equal", true)).toBe("+");
        // Shift doesn't change named keys.
        expect(codeToKey("Escape", true)).toBe("escape");
    });
});

describe("keyEventFromInput", () => {
    it("matches bindings the way a window key event does", () => {
        const e = keyEventFromInput({
            kind: "key",
            code: "Slash",
            down: true,
            ctrl: true,
            shift: false,
            alt: false,
            meta: false,
        })!;
        expect(eventKey(e)).toBe("/");
        expect(matchesPress(parseBinding("Ctrl+/")!, e)).toBe(true);
    });
});

describe("globalWatchList", () => {
    it("names each binding's key and modifiers, once, sorted", () => {
        expect(
            globalWatchList([
                parseBinding("Ctrl+Shift+M"),
                parseBinding("Ctrl+Shift+D"),
                null,
            ]),
        ).toEqual({
            codes: [
                "ControlLeft",
                "ControlRight",
                "KeyD",
                "KeyM",
                "ShiftLeft",
                "ShiftRight",
            ],
            buttons: [],
        });
    });

    it("watches both copies of a key and mouse side buttons", () => {
        expect(
            globalWatchList([
                parseBinding("Alt"),
                parseBinding("1"),
                { ...parseBinding("Alt")!, key: "mouse4" },
                { ...parseBinding("Alt")!, key: "mouse3" },
            ]),
        ).toEqual({
            codes: ["AltLeft", "AltRight", "Digit1", "Numpad1"],
            buttons: [1, 3],
        });
    });

    it("finds a shifted symbol's key", () => {
        expect(codesForKey("?")).toEqual(["Slash"]);
        expect(codesForKey("+").sort()).toEqual(["Equal", "NumpadAdd"]);
    });
});
