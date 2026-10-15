import { describe, it, expect } from "vitest";
import {
    KEYBIND_DEFS,
    bindingAllowed,
    bindingParts,
    eventToBinding,
    matchesHoldDown,
    matchesPress,
    parseBinding,
    releasesHold,
    serializeBinding,
    type KeyEventLike,
} from "./keybinds";

const ev = (key: string, mods: Partial<KeyEventLike> = {}, code = "") => ({
    key,
    code,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
});

describe("parseBinding", () => {
    it("maps Mod to Ctrl, or Cmd on macOS", () => {
        expect(parseBinding("Mod+K")).toMatchObject({ ctrl: true, key: "k" });
        expect(parseBinding("Mod+K", true)).toMatchObject({
            ctrl: false,
            meta: true,
            key: "k",
        });
    });

    it("parses named keys, aliases and the plus key", () => {
        expect(parseBinding("Alt+Shift+Up")).toMatchObject({
            alt: true,
            shift: true,
            key: "arrowup",
        });
        expect(parseBinding("Ctrl++")?.key).toBe("+");
        expect(parseBinding("Shift+Escape")?.key).toBe("escape");
    });

    it("takes a lone modifier as the key", () => {
        expect(parseBinding("Control")).toEqual({
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            key: "control",
        });
    });

    it("rejects empty and multi-key specs", () => {
        expect(parseBinding("")).toBeNull();
        expect(parseBinding("Ctrl+A+B")).toBeNull();
    });

    it("round-trips through serializeBinding", () => {
        for (const spec of ["Ctrl+Shift+M", "Alt+ArrowUp", "Ctrl++", "Mod+/"]) {
            const b = parseBinding(spec)!;
            expect(parseBinding(serializeBinding(b))).toEqual(b);
        }
    });

    it("parses every default", () => {
        for (const d of KEYBIND_DEFS)
            if (d.defaultBinding)
                expect(parseBinding(d.defaultBinding), d.id).not.toBeNull();
    });
});

describe("matching", () => {
    it("matches letters by physical key, so Shift and layouts don't matter", () => {
        const b = parseBinding("Ctrl+Shift+M")!;
        expect(
            matchesPress(b, ev("M", { ctrlKey: true, shiftKey: true }, "KeyM")),
        ).toBe(true);
        // A non-Latin layout types another character on the same key.
        expect(
            matchesPress(b, ev("ь", { ctrlKey: true, shiftKey: true }, "KeyM")),
        ).toBe(true);
        expect(matchesPress(b, ev("m", { ctrlKey: true }, "KeyM"))).toBe(false);
    });

    it("needs the exact modifiers for a press", () => {
        const b = parseBinding("Alt+ArrowUp")!;
        expect(matchesPress(b, ev("ArrowUp", { altKey: true }))).toBe(true);
        expect(
            matchesPress(b, ev("ArrowUp", { altKey: true, shiftKey: true })),
        ).toBe(false);
    });

    it("lets extra modifiers through for holds, and releases on any part", () => {
        const b = parseBinding("Ctrl+V")!;
        expect(
            matchesHoldDown(
                b,
                ev("v", { ctrlKey: true, shiftKey: true }, "KeyV"),
            ),
        ).toBe(true);
        expect(matchesHoldDown(b, ev("v", {}, "KeyV"))).toBe(false);
        expect(releasesHold(b, ev("Control"))).toBe(true);
        expect(releasesHold(b, ev("v", {}, "KeyV"))).toBe(true);
        expect(releasesHold(b, ev("Shift"))).toBe(false);
    });

    it("records a lone modifier without its own flag", () => {
        expect(eventToBinding(ev("Control", { ctrlKey: true }))).toMatchObject({
            ctrl: false,
            key: "control",
        });
    });

    it("only lets hold actions use bare modifiers and mouse buttons", () => {
        const ctrl = parseBinding("Control")!;
        const mouse = { ...ctrl, key: "mouse4" };
        expect(bindingAllowed(ctrl, true)).toBe(true);
        expect(bindingAllowed(ctrl, false)).toBe(false);
        expect(bindingAllowed(mouse, true)).toBe(true);
        expect(bindingAllowed(mouse, false)).toBe(false);
    });
});

describe("bindingParts", () => {
    it("names keys for display", () => {
        expect(bindingParts(parseBinding("Ctrl+Alt+ArrowDown")!)).toEqual([
            "Ctrl",
            "Alt",
            "↓",
        ]);
        expect(bindingParts(parseBinding("Mod+K", true)!, true)).toEqual([
            "Cmd",
            "K",
        ]);
    });
});
