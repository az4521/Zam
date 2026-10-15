// The user's keyboard shortcuts: Discord's defaults ($lib/keybinds/keybinds)
// with whatever they changed in Settings > Keybinds on top. Kept per device
// in localStorage, like Discord's own keybinds.
import {
    KEYBIND_DEFS,
    bindingsEqual,
    isKeybindAction,
    keybindDef,
    matchesPress,
    parseBinding,
    serializeBinding,
    type Binding,
    type KeybindAction,
    type KeyEventLike,
} from "$lib/keybinds/keybinds";

const STORAGE_KEY = "zam.keybinds.v1";

/** macOS uses Cmd where everyone else uses Ctrl ("Mod" in the defaults). */
export const IS_MAC =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Changed actions only: binding text, or null for "unbound". */
type Overrides = Partial<Record<KeybindAction, string | null>>;

function loadOverrides(): Overrides {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const out: Overrides = {};
        for (const [id, v] of Object.entries(parsed ?? {})) {
            if (!isKeybindAction(id)) continue;
            if (v === null) out[id] = null;
            else if (typeof v === "string" && parseBinding(v, IS_MAC))
                out[id] = v;
        }
        return out;
    } catch {
        return {};
    }
}

function saveOverrides(o: Overrides): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
    } catch {
        /* storage blocked: the change still holds for this session */
    }
}

const GLOBAL_KEY = "zam.keybinds.global.v1";

function loadGlobalVoice(): boolean {
    try {
        return localStorage.getItem(GLOBAL_KEY) === "1";
    } catch {
        return false;
    }
}

export const keybindsState = $state({
    overrides: loadOverrides(),
    /** Settings > Keybinds is listening for a new key: shortcuts are off. */
    recording: false,
    /** Desktop: voice keybinds also work while Zam isn't focused
     *  ($lib/keybinds/globalHotkeys). Off until the user turns it on, since
     *  macOS asks for a permission for it. */
    globalVoice: loadGlobalVoice(),
});

export function setGlobalVoiceKeybinds(on: boolean): void {
    keybindsState.globalVoice = on;
    try {
        localStorage.setItem(GLOBAL_KEY, on ? "1" : "0");
    } catch {
        /* storage blocked: the change still holds for this session */
    }
}

/** The binding an action has now, or null when it's unbound. */
export function bindingFor(id: KeybindAction): Binding | null {
    const o = keybindsState.overrides;
    const spec = id in o ? o[id] : keybindDef(id).defaultBinding;
    return spec ? parseBinding(spec, IS_MAC) : null;
}

export function isDefaultBinding(id: KeybindAction): boolean {
    return !(id in keybindsState.overrides);
}

/** Other actions bound to `b` right now. */
export function actionsUsing(
    b: Binding,
    except?: KeybindAction,
): KeybindAction[] {
    return KEYBIND_DEFS.filter((d) => {
        if (d.id === except) return false;
        const cur = bindingFor(d.id);
        return !!cur && bindingsEqual(cur, b);
    }).map((d) => d.id);
}

/**
 * Bind `id` to `b` (null unbinds it). Any other action on the same keys is
 * unbound, so one press never runs two things; returns those actions.
 * Escape stays shared by "decline call" and "mark as read" by default,
 * because each only acts when the other can't (see AppShell).
 */
export function setKeybind(
    id: KeybindAction,
    b: Binding | null,
): KeybindAction[] {
    const next: Overrides = { ...keybindsState.overrides };
    const cleared = b ? actionsUsing(b, id) : [];
    for (const other of cleared) next[other] = null;
    const def = keybindDef(id).defaultBinding;
    const defBinding = def ? parseBinding(def, IS_MAC) : null;
    const same = b && defBinding ? bindingsEqual(b, defBinding) : !b && !def;
    if (same) delete next[id];
    else next[id] = b ? serializeBinding(b) : null;
    keybindsState.overrides = next;
    saveOverrides(next);
    return cleared;
}

export function resetKeybind(id: KeybindAction): void {
    const next: Overrides = { ...keybindsState.overrides };
    delete next[id];
    keybindsState.overrides = next;
    saveOverrides(next);
}

export function resetAllKeybinds(): void {
    keybindsState.overrides = {};
    saveOverrides({});
}

/** The first of `ids` (all press actions by default) this key press
 *  triggers, or null. Hold actions match through holdActionFor instead. */
export function pressedAction(
    e: KeyEventLike,
    ids: readonly KeybindAction[] = PRESS_ACTIONS,
): KeybindAction | null {
    for (const id of ids) {
        const b = bindingFor(id);
        if (b && matchesPress(b, e)) return id;
    }
    return null;
}

const PRESS_ACTIONS = KEYBIND_DEFS.filter((d) => !d.hold).map((d) => d.id);

/** Which composer picker a key press opens, if any. */
export function pickerForKey(
    e: KeyEventLike,
): "emoji" | "gif" | "sticker" | null {
    const id = pressedAction(e, ["emojiPicker", "gifPicker", "stickerPicker"]);
    return id === "emojiPicker"
        ? "emoji"
        : id === "gifPicker"
          ? "gif"
          : id === "stickerPicker"
            ? "sticker"
            : null;
}
