/**
 * Zam's keyboard shortcuts: every action, its Discord default, and the pure
 * maths of matching a key event against a binding. The user's changes live
 * in $lib/stores/keybinds.svelte; AppShell runs the actions.
 *
 * A binding is one key plus modifiers. The key is the physical key for
 * letters and digits (`e.code`: KeyA -> "a", Digit1 -> "1"), so Shift+1 and
 * macOS Option chords still match and non-Latin layouts behave like Discord,
 * and `e.key` lowercased for everything else ("arrowup", "escape", "/").
 * Hold actions (push to talk / push to mute) may also be a bare modifier
 * ("control") or a mouse side button ("mouse4", "mouse5").
 */

export interface Binding {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
    key: string;
}

export type KeybindCategory = "navigation" | "chat" | "voice" | "app";

export type KeybindAction =
    // Navigation
    | "quickSwitcher"
    | "prevChannel"
    | "nextChannel"
    | "prevUnreadChannel"
    | "nextUnreadChannel"
    | "prevMentionChannel"
    | "nextMentionChannel"
    | "prevServer"
    | "nextServer"
    | "navigateBack"
    | "navigateForward"
    | "previousTextChannel"
    | "returnToCall"
    | "markChannelRead"
    | "markServerRead"
    | "jumpToOldestUnread"
    // Chat
    | "emojiPicker"
    | "gifPicker"
    | "stickerPicker"
    | "uploadFile"
    | "search"
    | "togglePins"
    | "toggleInbox"
    | "toggleMembers"
    // Voice
    | "toggleMute"
    | "toggleDeafen"
    | "pushToTalk"
    | "pushToMute"
    | "answerCall"
    | "declineCall"
    | "startCall"
    | "toggleCamera"
    | "toggleScreenShare"
    | "leaveCall"
    // App
    | "openSettings"
    | "createDm"
    | "createOrJoinSpace"
    | "shortcutsHelp"
    | "toggleDebug";

export interface KeybindDef {
    id: KeybindAction;
    category: KeybindCategory;
    /** Discord's default, or null (unbound until the user sets one). */
    defaultBinding: string | null;
    /** Runs while held (keydown starts, keyup ends) instead of once. */
    hold?: boolean;
}

/** Every action in display order. `Mod` is Ctrl, or Cmd on macOS. */
export const KEYBIND_DEFS: readonly KeybindDef[] = [
    { id: "quickSwitcher", category: "navigation", defaultBinding: "Mod+K" },
    {
        id: "prevChannel",
        category: "navigation",
        defaultBinding: "Alt+ArrowUp",
    },
    {
        id: "nextChannel",
        category: "navigation",
        defaultBinding: "Alt+ArrowDown",
    },
    {
        id: "prevUnreadChannel",
        category: "navigation",
        defaultBinding: "Alt+Shift+ArrowUp",
    },
    {
        id: "nextUnreadChannel",
        category: "navigation",
        defaultBinding: "Alt+Shift+ArrowDown",
    },
    {
        id: "prevMentionChannel",
        category: "navigation",
        defaultBinding: "Mod+Alt+Shift+ArrowUp",
    },
    {
        id: "nextMentionChannel",
        category: "navigation",
        defaultBinding: "Mod+Alt+Shift+ArrowDown",
    },
    {
        id: "prevServer",
        category: "navigation",
        defaultBinding: "Mod+Alt+ArrowUp",
    },
    {
        id: "nextServer",
        category: "navigation",
        defaultBinding: "Mod+Alt+ArrowDown",
    },
    {
        id: "navigateBack",
        category: "navigation",
        defaultBinding: "Alt+ArrowLeft",
    },
    {
        id: "navigateForward",
        category: "navigation",
        defaultBinding: "Alt+ArrowRight",
    },
    {
        id: "previousTextChannel",
        category: "navigation",
        defaultBinding: "Mod+B",
    },
    { id: "returnToCall", category: "navigation", defaultBinding: "Mod+Alt+A" },
    { id: "markChannelRead", category: "navigation", defaultBinding: "Escape" },
    {
        id: "markServerRead",
        category: "navigation",
        defaultBinding: "Shift+Escape",
    },
    {
        id: "jumpToOldestUnread",
        category: "navigation",
        defaultBinding: "Shift+PageUp",
    },

    { id: "emojiPicker", category: "chat", defaultBinding: "Mod+E" },
    { id: "gifPicker", category: "chat", defaultBinding: "Mod+G" },
    { id: "stickerPicker", category: "chat", defaultBinding: "Mod+S" },
    { id: "uploadFile", category: "chat", defaultBinding: "Mod+Shift+U" },
    { id: "search", category: "chat", defaultBinding: "Mod+F" },
    { id: "togglePins", category: "chat", defaultBinding: "Mod+P" },
    { id: "toggleInbox", category: "chat", defaultBinding: "Mod+I" },
    { id: "toggleMembers", category: "chat", defaultBinding: "Mod+U" },

    { id: "toggleMute", category: "voice", defaultBinding: "Mod+Shift+M" },
    { id: "toggleDeafen", category: "voice", defaultBinding: "Mod+Shift+D" },
    { id: "pushToTalk", category: "voice", defaultBinding: null, hold: true },
    { id: "pushToMute", category: "voice", defaultBinding: null, hold: true },
    { id: "answerCall", category: "voice", defaultBinding: "Mod+Enter" },
    { id: "declineCall", category: "voice", defaultBinding: "Escape" },
    { id: "startCall", category: "voice", defaultBinding: "Mod+'" },
    { id: "toggleCamera", category: "voice", defaultBinding: null },
    { id: "toggleScreenShare", category: "voice", defaultBinding: null },
    { id: "leaveCall", category: "voice", defaultBinding: null },

    { id: "openSettings", category: "app", defaultBinding: "Mod+," },
    { id: "createDm", category: "app", defaultBinding: "Mod+Shift+T" },
    {
        id: "createOrJoinSpace",
        category: "app",
        defaultBinding: "Mod+Shift+N",
    },
    { id: "shortcutsHelp", category: "app", defaultBinding: "Mod+/" },
    { id: "toggleDebug", category: "app", defaultBinding: "Mod+Alt+Shift+D" },
];

export const KEYBIND_CATEGORIES: readonly KeybindCategory[] = [
    "navigation",
    "chat",
    "voice",
    "app",
];

export function keybindDef(id: KeybindAction): KeybindDef {
    return KEYBIND_DEFS.find((d) => d.id === id)!;
}

export function isKeybindAction(id: string): id is KeybindAction {
    return KEYBIND_DEFS.some((d) => d.id === id);
}

const MODIFIER_KEYS = new Set(["control", "shift", "alt", "meta", "os"]);

/** Whether `key` is a modifier on its own (bindable only for hold actions). */
export function isModifierKey(key: string): boolean {
    return MODIFIER_KEYS.has(key);
}

const KEY_ALIASES: Record<string, string> = {
    up: "arrowup",
    down: "arrowdown",
    left: "arrowleft",
    right: "arrowright",
    esc: "escape",
    space: " ",
    spacebar: " ",
    ctrl: "control",
    cmd: "meta",
    plus: "+",
};

/**
 * Parse "Ctrl+Shift+M" style text. `Mod` means Ctrl, or Meta when `mac`.
 * A trailing "+" is the plus key ("Ctrl++"). Null when there isn't exactly
 * one non-modifier key, except a lone modifier ("Control"), which parses to
 * that key with no modifier flags.
 */
export function parseBinding(spec: string, mac = false): Binding | null {
    const s = spec.trim();
    if (!s) return null;
    const tokens = s.endsWith("++")
        ? [...s.slice(0, -2).split("+"), "+"]
        : s.split("+");
    const b: Binding = {
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
        key: "",
    };
    const keys: string[] = [];
    for (const raw of tokens) {
        const t = raw.trim().toLowerCase();
        if (!t) return null;
        if (t === "mod") {
            if (mac) b.meta = true;
            else b.ctrl = true;
        } else if (t === "ctrl" || t === "control") {
            b.ctrl = true;
        } else if (t === "shift") {
            b.shift = true;
        } else if (t === "alt" || t === "option") {
            b.alt = true;
        } else if (t === "meta" || t === "cmd" || t === "command") {
            b.meta = true;
        } else {
            keys.push(KEY_ALIASES[t] ?? t);
        }
    }
    if (keys.length === 0 && tokens.length === 1) {
        // A lone modifier: the modifier itself is the key.
        const only = tokens[0].trim().toLowerCase();
        const key = KEY_ALIASES[only] ?? only;
        return {
            ctrl: false,
            shift: false,
            alt: false,
            meta: false,
            key: key === "option" ? "alt" : key === "command" ? "meta" : key,
        };
    }
    if (keys.length !== 1) return null;
    b.key = keys[0];
    return b;
}

const KEY_NAMES: Record<string, string> = {
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    escape: "Esc",
    " ": "Space",
    enter: "Enter",
    pageup: "Page Up",
    pagedown: "Page Down",
    backspace: "Backspace",
    delete: "Delete",
    tab: "Tab",
    home: "Home",
    end: "End",
    control: "Ctrl",
    shift: "Shift",
    alt: "Alt",
    meta: "Meta",
    mouse4: "Mouse 4",
    mouse5: "Mouse 5",
    mouse3: "Middle click",
    capslock: "Caps Lock",
};

/** Display parts for a binding: ["Ctrl", "Shift", "M"]. */
export function bindingParts(b: Binding, mac = false): string[] {
    const parts: string[] = [];
    if (b.ctrl) parts.push("Ctrl");
    if (b.meta) parts.push(mac ? "Cmd" : "Meta");
    if (b.alt) parts.push(mac ? "Option" : "Alt");
    if (b.shift) parts.push("Shift");
    const name =
        b.key === "meta" && mac
            ? "Cmd"
            : (KEY_NAMES[b.key] ??
              (b.key.length === 1
                  ? b.key.toUpperCase()
                  : b.key[0].toUpperCase() + b.key.slice(1)));
    parts.push(name);
    return parts;
}

/** Canonical storage text, e.g. "Ctrl+Shift+m" (parseBinding round-trips). */
export function serializeBinding(b: Binding): string {
    const parts: string[] = [];
    if (b.ctrl) parts.push("Ctrl");
    if (b.meta) parts.push("Meta");
    if (b.alt) parts.push("Alt");
    if (b.shift) parts.push("Shift");
    parts.push(b.key === "+" ? "plus" : b.key === " " ? "space" : b.key);
    return parts.join("+");
}

export function bindingsEqual(a: Binding, b: Binding): boolean {
    return (
        a.ctrl === b.ctrl &&
        a.shift === b.shift &&
        a.alt === b.alt &&
        a.meta === b.meta &&
        a.key === b.key
    );
}

export interface KeyEventLike {
    key: string;
    code?: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
}

/** The binding key a key event stands for (see the module comment). */
export function eventKey(e: KeyEventLike): string {
    const code = e.code ?? "";
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter) return letter[1].toLowerCase();
    const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
    if (digit) return digit[1];
    const k = e.key.toLowerCase();
    if (k === "os") return "meta";
    return k;
}

/** The binding a key event would record or trigger. A press of a modifier
 *  on its own records that modifier as the key, without its own flag. */
export function eventToBinding(e: KeyEventLike): Binding {
    const key = eventKey(e);
    if (isModifierKey(key))
        return { ctrl: false, shift: false, alt: false, meta: false, key };
    return {
        ctrl: e.ctrlKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
        key,
    };
}

/** Mouse side buttons as binding keys (button 1 is the middle button). */
export function mouseButtonKey(button: number): string | null {
    return button === 1
        ? "mouse3"
        : button === 3
          ? "mouse4"
          : button === 4
            ? "mouse5"
            : null;
}

/** Whether a binding has a modifier that text fields don't type with. */
export function bindingWorksWhileTyping(b: Binding): boolean {
    return b.ctrl || b.alt || b.meta;
}

/** Exact match of a press against a binding. */
export function matchesPress(b: Binding, e: KeyEventLike): boolean {
    return bindingsEqual(b, eventToBinding(e));
}

/** A hold binding is pressed when its key goes down with at least its own
 *  modifiers held (extra modifiers don't block push to talk). */
export function matchesHoldDown(b: Binding, e: KeyEventLike): boolean {
    if (eventKey(e) !== b.key) return false;
    return (
        (!b.ctrl || e.ctrlKey) &&
        (!b.shift || e.shiftKey) &&
        (!b.alt || e.altKey) &&
        (!b.meta || e.metaKey)
    );
}

/** Whether releasing this key ends a held binding: its key, or one of its
 *  modifiers. */
export function releasesHold(b: Binding, e: KeyEventLike): boolean {
    const key = eventKey(e);
    if (key === b.key) return true;
    return (
        (b.ctrl && key === "control") ||
        (b.shift && key === "shift") ||
        (b.alt && key === "alt") ||
        (b.meta && key === "meta")
    );
}

/** Which bindable keys a recording should refuse as the whole binding
 *  (they'd break typing or the app's own Escape handling). */
export function bindingAllowed(b: Binding, hold: boolean): boolean {
    if (!b.key || b.key === "unidentified" || b.key === "dead") return false;
    if (isModifierKey(b.key) || b.key.startsWith("mouse")) return hold;
    return true;
}
