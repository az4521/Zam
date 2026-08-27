/**
 * Pure keyboard-shortcut parsing + conflict detection + resolver (zam.shortcuts.register, spec §7).
 *
 * **Normalization:** single-char keys lowercased (`"K"→"k"`); named keys lowercased whole
 * (`"Escape"→"escape"`, `"ArrowUp"→"arrowup"`).
 *
 * **Modifier aliases (case-insensitive):** `ctrl`/`control`→ctrl; `shift`→shift;
 * `alt`/`option`→alt; `meta`/`cmd`/`command`/`super`/`win`→meta; `mod`→ctrl.
 * (`mod` maps to Ctrl deterministically: Zam's core shortcuts are all Ctrl-based,
 * so `mod` = platform-agnostic Ctrl. Authors wanting Cmd use `meta`.)
 *
 * **Conflict detection:** rejects chords that: (a) fail to parse, (b) have no modifier
 * (blocks bare Escape and plain typing), (c) collide with a core global shortcut.
 * Core always wins; plugins fire after Escape and before the Ctrl-only fallback.
 *
 * **Limitation:** prefer letter keys for plugin chords. With Shift held, `e.key` becomes
 * the shifted character (`Shift+1` → `"!"`), so digit/punctuation chords won't match.
 */

export interface Chord {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
    key: string;
}

export interface KeyEventLike {
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    key: string;
}

/**
 * Parse a shortcut spec string (e.g. "Ctrl+Shift+K") into a normalized Chord.
 * Returns null if the spec is empty, modifier-only, or has multiple keys.
 */
export function parseChord(spec: string): Chord | null {
    if (!spec.trim()) return null;

    const tokens = spec
        .split("+")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

    const chord: Chord = {
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
        key: "",
    };
    const nonModifiers: string[] = [];

    for (const token of tokens) {
        const lower = token.toLowerCase();
        if (lower === "ctrl" || lower === "control") {
            chord.ctrl = true;
        } else if (lower === "shift") {
            chord.shift = true;
        } else if (lower === "alt" || lower === "option") {
            chord.alt = true;
        } else if (
            lower === "meta" ||
            lower === "cmd" ||
            lower === "command" ||
            lower === "super" ||
            lower === "win"
        ) {
            chord.meta = true;
        } else if (lower === "mod") {
            chord.ctrl = true;
        } else {
            nonModifiers.push(token);
        }
    }

    if (nonModifiers.length !== 1) return null;

    chord.key = nonModifiers[0].toLowerCase();
    return chord;
}

/**
 * Convert a keyboard event into a normalized Chord.
 */
export function eventToChord(e: KeyEventLike): Chord {
    return {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
        key: e.key.toLowerCase(),
    };
}

/**
 * Check if two chords are equal (all fields match).
 */
export function chordsEqual(a: Chord, b: Chord): boolean {
    return (
        a.ctrl === b.ctrl &&
        a.shift === b.shift &&
        a.alt === b.alt &&
        a.meta === b.meta &&
        a.key === b.key
    );
}

/**
 * Core global shortcuts reserved by AppShell (Ctrl+Shift+D, Ctrl+E, Ctrl+S).
 * Plugins cannot shadow these.
 */
export const CORE_SHORTCUT_CHORDS: Chord[] = [
    { ctrl: true, shift: true, alt: false, meta: false, key: "d" },
    { ctrl: true, shift: false, alt: false, meta: false, key: "e" },
    { ctrl: true, shift: false, alt: false, meta: false, key: "s" },
];

export type ConflictReason = "invalid" | "no-modifier" | "reserved";

/**
 * Check if a chord has a conflict that prevents it from being used.
 * Returns "invalid" if null, "no-modifier" if no modifier set (blocks bare keys),
 * "reserved" if it collides with a core shortcut, or null if OK.
 */
export function chordConflict(chord: Chord | null): ConflictReason | null {
    if (!chord) return "invalid";
    if (!chord.ctrl && !chord.shift && !chord.alt && !chord.meta)
        return "no-modifier";
    if (CORE_SHORTCUT_CHORDS.some((c) => chordsEqual(c, chord)))
        return "reserved";
    return null;
}

/**
 * Resolve a pressed chord against an array of shortcut registrations.
 * Returns the first registration whose parsed chord matches the pressed chord
 * and passes conflict checks (skips invalid/no-modifier/reserved chords).
 * Returns null if no match.
 */
export function resolveShortcut<T extends { keys: string }>(
    pressed: Chord,
    registrations: T[],
): T | null {
    for (const reg of registrations) {
        const parsed = parseChord(reg.keys);
        if (chordConflict(parsed) !== null) continue;
        if (chordsEqual(parsed!, pressed)) return reg;
    }
    return null;
}
