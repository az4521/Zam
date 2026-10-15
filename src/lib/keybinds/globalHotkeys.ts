/**
 * Voice keybinds while Zam isn't focused (desktop only). The Electron main
 * process runs a passive input hook (electron/globalHotkeys.cjs) and forwards
 * only the keys and mouse buttons named here, as DOM `code`s plus modifier
 * state; the runner ($lib/keybinds/runner, handleGlobalInput) matches them
 * against the bindings like a window key event.
 *
 * The hook reports physical keys, not characters, so punctuation is read with
 * the US layout (Shift+/ is "?", as a browser on that layout says). Letters,
 * digits, F-keys, modifiers and mouse buttons don't depend on the layout.
 */
import {
    isModifierKey,
    type Binding,
    type KeybindAction,
    type KeyEventLike,
} from "./keybinds";

/** The actions that run while Zam isn't focused. */
export const GLOBAL_ACTIONS: readonly KeybindAction[] = [
    "pushToTalk",
    "pushToMute",
    "toggleMute",
    "toggleDeafen",
];

/** One forwarded input, as main sends it ("hotkeys:input"). */
export type GlobalInput =
    | {
          kind: "key";
          /** KeyboardEvent.code, e.g. "KeyV", "ControlLeft", "Backquote". */
          code: string;
          down: boolean;
          ctrl: boolean;
          shift: boolean;
          alt: boolean;
          meta: boolean;
      }
    | {
          kind: "mouse";
          /** MouseEvent.button: 1 middle, 3 back, 4 forward. */
          button: number;
          down: boolean;
      };

/** The hook's state, as main reports it ("hotkeys:status"). */
export interface GlobalHotkeyStatus {
    /** off: nothing to watch. active: running. wayland: a Wayland session,
     *  where other apps' input can't be seen. permission: macOS hasn't
     *  granted Accessibility. error: the hook failed to load or start. */
    state: "off" | "active" | "wayland" | "permission" | "error";
    error?: string;
}

// [code, key, key with Shift] for everything but letters and digits.
const CODE_KEYS: readonly [string, string, string?][] = [
    ["Backquote", "`", "~"],
    ["Minus", "-", "_"],
    ["Equal", "=", "+"],
    ["BracketLeft", "[", "{"],
    ["BracketRight", "]", "}"],
    ["Backslash", "\\", "|"],
    ["Semicolon", ";", ":"],
    ["Quote", "'", '"'],
    ["Comma", ",", "<"],
    ["Period", ".", ">"],
    ["Slash", "/", "?"],
    ["Space", " "],
    ["Enter", "enter"],
    ["NumpadEnter", "enter"],
    ["Escape", "escape"],
    ["Tab", "tab"],
    ["Backspace", "backspace"],
    ["CapsLock", "capslock"],
    ["Insert", "insert"],
    ["Delete", "delete"],
    ["Home", "home"],
    ["End", "end"],
    ["PageUp", "pageup"],
    ["PageDown", "pagedown"],
    ["ArrowUp", "arrowup"],
    ["ArrowDown", "arrowdown"],
    ["ArrowLeft", "arrowleft"],
    ["ArrowRight", "arrowright"],
    ["NumpadMultiply", "*"],
    ["NumpadAdd", "+"],
    ["NumpadSubtract", "-"],
    ["NumpadDecimal", "."],
    ["NumpadDivide", "/"],
    ["NumLock", "numlock"],
    ["ScrollLock", "scrolllock"],
    ["PrintScreen", "printscreen"],
    ["ControlLeft", "control"],
    ["ControlRight", "control"],
    ["ShiftLeft", "shift"],
    ["ShiftRight", "shift"],
    ["AltLeft", "alt"],
    ["AltRight", "alt"],
    ["MetaLeft", "meta"],
    ["MetaRight", "meta"],
    ...Array.from(
        { length: 24 },
        (_, i) => [`F${i + 1}`, `f${i + 1}`] as [string, string],
    ),
];

const BY_CODE = new Map(CODE_KEYS.map((row) => [row[0], row]));

/** What a browser on the US layout would put in KeyboardEvent.key
 *  (lowercased), or null for a code we don't know. */
export function codeToKey(code: string, shift = false): string | null {
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter) return letter[1].toLowerCase();
    const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
    if (digit) return digit[1];
    const row = BY_CODE.get(code);
    if (!row) return null;
    return shift && row[2] ? row[2] : row[1];
}

/** A forwarded key as the key event the matchers take. */
export function keyEventFromInput(
    ev: Extract<GlobalInput, { kind: "key" }>,
): KeyEventLike | null {
    const key = codeToKey(ev.code, ev.shift);
    if (key === null) return null;
    return {
        key,
        code: ev.code,
        ctrlKey: ev.ctrl,
        shiftKey: ev.shift,
        altKey: ev.alt,
        metaKey: ev.meta,
    };
}

/** Every code that can produce `key` (with or without Shift). */
export function codesForKey(key: string): string[] {
    if (/^[a-z]$/.test(key)) return [`Key${key.toUpperCase()}`];
    if (/^\d$/.test(key)) return [`Digit${key}`, `Numpad${key}`];
    return CODE_KEYS.filter((r) => r[1] === key || r[2] === key).map(
        (r) => r[0],
    );
}

const MODIFIER_CODES = {
    ctrl: ["ControlLeft", "ControlRight"],
    shift: ["ShiftLeft", "ShiftRight"],
    alt: ["AltLeft", "AltRight"],
    meta: ["MetaLeft", "MetaRight"],
} as const;

/** MouseEvent.button for a mouse binding key (see mouseButtonKey). */
const MOUSE_BUTTONS: Record<string, number> = {
    mouse3: 1,
    mouse4: 3,
    mouse5: 4,
};

/**
 * What main has to forward for these bindings: each one's key and the
 * modifiers it uses (releasing one ends a hold). Sorted, without repeats.
 */
export function globalWatchList(bindings: readonly (Binding | null)[]): {
    codes: string[];
    buttons: number[];
} {
    const codes = new Set<string>();
    const buttons = new Set<number>();
    for (const b of bindings) {
        if (!b) continue;
        if (b.key in MOUSE_BUTTONS) {
            buttons.add(MOUSE_BUTTONS[b.key]);
            continue;
        }
        for (const c of codesForKey(b.key)) codes.add(c);
        if (isModifierKey(b.key)) continue;
        for (const m of ["ctrl", "shift", "alt", "meta"] as const)
            if (b[m]) for (const c of MODIFIER_CODES[m]) codes.add(c);
    }
    return {
        codes: [...codes].sort(),
        buttons: [...buttons].sort((a, b) => a - b),
    };
}
