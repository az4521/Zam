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
 *
 * On Wayland there is no hook: main hands the bindings to the desktop's
 * GlobalShortcuts portal as shortcut triggers (portalTrigger) and forwards
 * each action going down and up ({ kind: "action" }).
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
      }
    | {
          /** Wayland: the portal says one of our shortcuts went down / up. */
          kind: "action";
          id: KeybindAction;
          down: boolean;
      };

/** A shortcut as main hands it to the portal. */
export interface PortalShortcut {
    id: KeybindAction;
    /** Shown by the desktop in its shortcut settings. */
    description: string;
    /** The keys we'd like, in the shortcuts spec's syntax ("CTRL+SHIFT+m");
     *  "" lets the user pick. The desktop decides in the end. */
    trigger: string;
}

/** The hook's state, as main reports it ("hotkeys:status"). */
export interface GlobalHotkeyStatus {
    /** off: nothing to watch. active: running. wayland: a Wayland session
     *  without the GlobalShortcuts portal, where other apps' input can't be
     *  seen. permission: macOS hasn't granted Accessibility. error: the hook
     *  failed to load or start, or the portal refused the shortcuts. */
    state: "off" | "active" | "wayland" | "permission" | "error";
    error?: string;
    /** Set when the portal does the work (Wayland). */
    backend?: "portal";
    /** Portal: the trigger the desktop gave each shortcut ("" = none). */
    shortcuts?: { id: string; trigger: string }[];
    /** Portal: the desktop can open its own editor for them. */
    configurable?: boolean;
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

// Shortcut trigger key names (xkbcommon keysyms) for binding keys that
// aren't spelled the same.
const KEYSYMS: Record<string, string> = {
    " ": "space",
    enter: "Return",
    escape: "Escape",
    tab: "Tab",
    backspace: "BackSpace",
    capslock: "Caps_Lock",
    insert: "Insert",
    delete: "Delete",
    home: "Home",
    end: "End",
    pageup: "Page_Up",
    pagedown: "Page_Down",
    arrowup: "Up",
    arrowdown: "Down",
    arrowleft: "Left",
    arrowright: "Right",
    numlock: "Num_Lock",
    scrolllock: "Scroll_Lock",
    printscreen: "Print",
    control: "Control_L",
    shift: "Shift_L",
    alt: "Alt_L",
    meta: "Super_L",
    "`": "grave",
    "~": "asciitilde",
    "-": "minus",
    _: "underscore",
    "=": "equal",
    "+": "plus",
    "[": "bracketleft",
    "{": "braceleft",
    "]": "bracketright",
    "}": "braceright",
    "\\": "backslash",
    "|": "bar",
    ";": "semicolon",
    ":": "colon",
    "'": "apostrophe",
    '"': "quotedbl",
    ",": "comma",
    "<": "less",
    ".": "period",
    ">": "greater",
    "/": "slash",
    "?": "question",
    "*": "asterisk",
    "!": "exclam",
    "@": "at",
    "#": "numbersign",
    $: "dollar",
    "%": "percent",
    "^": "asciicircum",
    "&": "ampersand",
    "(": "parenleft",
    ")": "parenright",
};

/**
 * A binding as a shortcuts-spec trigger ("CTRL+SHIFT+m", "F13",
 * "Control_L"), or "" when it has no keyboard equivalent (a mouse button)
 * and the user has to pick keys in the desktop's dialog.
 */
export function portalTrigger(b: Binding): string {
    if (b.key.startsWith("mouse")) return "";
    const f = /^f(\d{1,2})$/.exec(b.key);
    const key = f
        ? `F${f[1]}`
        : /^[a-z0-9]$/.test(b.key)
          ? b.key
          : KEYSYMS[b.key];
    if (!key) return "";
    const mods: string[] = [];
    if (b.ctrl) mods.push("CTRL");
    if (b.alt) mods.push("ALT");
    if (b.shift) mods.push("SHIFT");
    if (b.meta) mods.push("LOGO");
    return [...mods, key].join("+");
}

/** The portal shortcuts for these actions' bindings (unbound ones left
 *  out). `describe` names an action for the desktop's settings. */
export function portalShortcuts(
    bindings: readonly (readonly [KeybindAction, Binding | null])[],
    describe: (id: KeybindAction) => string,
): PortalShortcut[] {
    return bindings
        .filter(([, b]) => !!b)
        .map(([id, b]) => ({
            id,
            description: describe(id),
            trigger: portalTrigger(b!),
        }));
}
