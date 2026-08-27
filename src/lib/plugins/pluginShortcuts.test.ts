import { describe, it, expect } from "vitest";
import {
    parseChord,
    eventToChord,
    chordsEqual,
    chordConflict,
    resolveShortcut,
    CORE_SHORTCUT_CHORDS,
    type Chord,
} from "./pluginShortcuts";

const chord = (p: Partial<Chord>): Chord => ({
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
    key: "",
    ...p,
});

describe("parseChord", () => {
    it("parses modifiers + key, lowercasing the key", () => {
        expect(parseChord("Ctrl+Shift+K")).toEqual(
            chord({ ctrl: true, shift: true, key: "k" }),
        );
    });
    it("accepts modifier aliases (control/option/cmd/mod)", () => {
        expect(parseChord("control+option+j")).toEqual(
            chord({ ctrl: true, alt: true, key: "j" }),
        );
        expect(parseChord("cmd+p")).toEqual(chord({ meta: true, key: "p" }));
        expect(parseChord("mod+k")).toEqual(chord({ ctrl: true, key: "k" }));
    });
    it("lowercases a named key whole", () => {
        expect(parseChord("Alt+ArrowUp")).toEqual(
            chord({ alt: true, key: "arrowup" }),
        );
    });
    it("returns null for empty / modifier-only / two keys", () => {
        expect(parseChord("")).toBeNull();
        expect(parseChord("Ctrl+Shift")).toBeNull();
        expect(parseChord("Ctrl+a+b")).toBeNull();
    });
});

describe("eventToChord", () => {
    it("reads the flags and lowercases key", () => {
        expect(
            eventToChord({
                ctrlKey: true,
                shiftKey: false,
                altKey: false,
                metaKey: false,
                key: "K",
            }),
        ).toEqual(chord({ ctrl: true, key: "k" }));
    });
});

describe("chordsEqual", () => {
    it("is true only when every field matches", () => {
        expect(
            chordsEqual(
                chord({ ctrl: true, key: "k" }),
                chord({ ctrl: true, key: "k" }),
            ),
        ).toBe(true);
        expect(
            chordsEqual(
                chord({ ctrl: true, key: "k" }),
                chord({ ctrl: true, shift: true, key: "k" }),
            ),
        ).toBe(false);
    });
});

describe("chordConflict", () => {
    it("flags invalid / no-modifier / reserved / ok", () => {
        expect(chordConflict(null)).toBe("invalid");
        expect(chordConflict(chord({ key: "k" }))).toBe("no-modifier");
        expect(chordConflict(parseChord("Ctrl+E"))).toBe("reserved");
        expect(chordConflict(parseChord("Ctrl+Shift+D"))).toBe("reserved");
        expect(chordConflict(parseChord("Ctrl+K"))).toBeNull();
    });
    it("has the four core chords reserved", () => {
        expect(CORE_SHORTCUT_CHORDS).toHaveLength(4);
    });
});

describe("resolveShortcut", () => {
    const reg = (keys: string, id: string) => ({ keys, id });
    it("returns the first non-conflicting registration matching the pressed chord", () => {
        const regs = [reg("Ctrl+K", "a"), reg("Ctrl+K", "b")];
        expect(resolveShortcut(parseChord("Ctrl+K")!, regs)?.id).toBe("a");
    });
    it("skips a registration that collides with a core shortcut (core wins)", () => {
        const regs = [reg("Ctrl+E", "shadow")];
        expect(resolveShortcut(parseChord("Ctrl+E")!, regs)).toBeNull();
    });
    it("skips invalid + modifier-less registrations", () => {
        const regs = [reg("", "x"), reg("k", "y"), reg("Ctrl+J", "z")];
        expect(resolveShortcut(parseChord("Ctrl+J")!, regs)?.id).toBe("z");
    });
    it("returns null when nothing matches", () => {
        expect(
            resolveShortcut(parseChord("Ctrl+K")!, [reg("Ctrl+J", "j")]),
        ).toBeNull();
    });
    it("allows Ctrl+Shift+Alt+D (only strict Ctrl+Shift+D is core-reserved)", () => {
        const regs = [reg("Ctrl+Shift+Alt+D", "variant")];
        expect(resolveShortcut(parseChord("Ctrl+Shift+Alt+D")!, regs)?.id).toBe(
            "variant",
        );
    });
});
