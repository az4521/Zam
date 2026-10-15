import { describe, it, expect, beforeEach } from "vitest";
import { parseBinding } from "$lib/keybinds/keybinds";
import {
    bindingFor,
    isDefaultBinding,
    keybindsState,
    resetAllKeybinds,
    resetKeybind,
    setKeybind,
} from "./keybinds.svelte";

beforeEach(() => {
    localStorage.clear();
    resetAllKeybinds();
});

describe("keybinds store", () => {
    it("starts on Discord's defaults", () => {
        expect(bindingFor("toggleMute")).toEqual(parseBinding("Ctrl+Shift+M"));
        expect(bindingFor("pushToTalk")).toBeNull();
        expect(isDefaultBinding("toggleMute")).toBe(true);
    });

    it("rebinds, persists, and frees the keys from the action that had them", () => {
        const cleared = setKeybind("pushToTalk", parseBinding("Ctrl+Shift+M")!);
        expect(cleared).toEqual(["toggleMute"]);
        expect(bindingFor("pushToTalk")).toEqual(parseBinding("Ctrl+Shift+M"));
        expect(bindingFor("toggleMute")).toBeNull();
        const saved = JSON.parse(localStorage.getItem("zam.keybinds.v1")!);
        expect(saved).toEqual({ pushToTalk: "Ctrl+Shift+m", toggleMute: null });
    });

    it("drops the override when set back to the default", () => {
        setKeybind("search", parseBinding("Ctrl+J")!);
        expect(isDefaultBinding("search")).toBe(false);
        setKeybind("search", parseBinding("Ctrl+F")!);
        expect(isDefaultBinding("search")).toBe(true);
        expect(keybindsState.overrides).toEqual({});
    });

    it("unbinds and resets", () => {
        setKeybind("search", null);
        expect(bindingFor("search")).toBeNull();
        resetKeybind("search");
        expect(bindingFor("search")).toEqual(parseBinding("Ctrl+F"));
    });
});
