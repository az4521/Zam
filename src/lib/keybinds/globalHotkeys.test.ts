import { describe, it, expect } from "vitest";
import {
    codeToKey,
    codesForKey,
    globalWatchList,
    keyEventFromInput,
    portalShortcuts,
    portalTrigger,
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

describe("portalTrigger", () => {
    it("spells bindings the way the shortcuts spec does", () => {
        expect(portalTrigger(parseBinding("Ctrl+Shift+M")!)).toBe(
            "CTRL+SHIFT+m",
        );
        expect(portalTrigger(parseBinding("Mod+Alt+Shift+D", true)!)).toBe(
            "ALT+SHIFT+LOGO+d",
        );
        expect(portalTrigger(parseBinding("F13")!)).toBe("F13");
        expect(portalTrigger(parseBinding("`")!)).toBe("grave");
        expect(portalTrigger(parseBinding("Ctrl+/")!)).toBe("CTRL+slash");
        expect(portalTrigger(parseBinding("Space")!)).toBe("space");
        expect(portalTrigger(parseBinding("Alt+Up")!)).toBe("ALT+Up");
        expect(portalTrigger(parseBinding("Control")!)).toBe("Control_L");
    });

    it("leaves mouse buttons and unknown keys for the user to pick", () => {
        expect(portalTrigger({ ...parseBinding("Alt")!, key: "mouse4" })).toBe(
            "",
        );
        expect(portalTrigger({ ...parseBinding("Alt")!, key: "unknown" })).toBe(
            "",
        );
    });
});

describe("portalShortcuts", () => {
    it("lists the bound actions with their descriptions", () => {
        expect(
            portalShortcuts(
                [
                    ["pushToTalk", parseBinding("V")],
                    ["pushToMute", null],
                    ["toggleMute", { ...parseBinding("Alt")!, key: "mouse5" }],
                ],
                (id) => `label:${id}`,
            ),
        ).toEqual([
            { id: "pushToTalk", description: "label:pushToTalk", trigger: "v" },
            { id: "toggleMute", description: "label:toggleMute", trigger: "" },
        ]);
    });
});
