// The desktop app's side of voice keybinds while Zam isn't focused: tells
// Electron's main process which keys to watch (electron/globalHotkeys.cjs),
// feeds what it forwards to the runner, and keeps its status for Settings >
// Keybinds. AppShell connects it; everywhere but Electron it does nothing.
import {
    GLOBAL_ACTIONS,
    globalWatchList,
    portalShortcuts,
} from "./globalHotkeys";
import type { GlobalHotkeyStatus } from "./globalHotkeys";
import { handleGlobalInput, releaseAllHolds, resetGlobalInput } from "./runner";
import { bindingFor, keybindsState } from "$lib/stores/keybinds.svelte";
import { keybindLabel } from "./labels";

export const globalHotkeysState = $state({
    /** Null outside the desktop app (or before main has answered). */
    status: null as GlobalHotkeyStatus | null,
});

/** Whether this build can run keybinds while Zam isn't focused. */
export function globalHotkeysSupported(): boolean {
    return typeof window !== "undefined" && !!window.desktop?.hotkeys;
}

function setStatus(s: GlobalHotkeyStatus): void {
    // Holds the hook started can't be ended by it any more.
    if (s.state !== "active" && globalHotkeysState.status?.state === "active") {
        resetGlobalInput();
        if (!document.hasFocus()) releaseAllHolds();
    }
    globalHotkeysState.status = s;
}

/** Listen to the hook. Returns the disconnect. */
export function connectGlobalHotkeys(): () => void {
    const api = window.desktop?.hotkeys;
    if (!api) return () => {};
    const offInput = api.onInput((ev) =>
        handleGlobalInput(ev, document.hasFocus()),
    );
    const offStatus = api.onStatus(setStatus);
    return () => {
        offInput();
        offStatus();
        void api.watch([], [], []).catch(() => {});
    };
}

/** Send main the keys the voice bindings use now (none when the setting is
 *  off): codes for the input hook, and the same bindings as shortcuts for
 *  the Wayland portal (main uses whichever the session has). Reads the
 *  bindings, so an $effect around it re-sends on change. */
export function syncGlobalHotkeys(): void {
    const api = window.desktop?.hotkeys;
    if (!api) return;
    if (!keybindsState.globalVoice) {
        void api
            .watch([], [], [])
            .then(setStatus)
            .catch(() => {});
        return;
    }
    const bindings = GLOBAL_ACTIONS.map((id) => [id, bindingFor(id)] as const);
    const { codes, buttons } = globalWatchList(bindings.map(([, b]) => b));
    void api
        .watch(codes, buttons, portalShortcuts(bindings, keybindLabel))
        .then(setStatus)
        .catch(() => {});
}

/** Wayland: open the desktop's own settings for Zam's shortcuts. */
export function configureGlobalShortcuts(): void {
    void window.desktop?.hotkeys?.configure().catch(() => {});
}

/** Whether a held push to talk / mute will still see its key come up after
 *  the window loses focus (AppShell lets go of holds on blur otherwise). */
export function holdsOutliveBlur(): boolean {
    return (
        keybindsState.globalVoice &&
        globalHotkeysState.status?.state === "active"
    );
}

/** macOS: ask for the Accessibility permission the hook needs. */
export async function requestGlobalHotkeyPermission(): Promise<void> {
    const api = window.desktop?.hotkeys;
    if (!api) return;
    setStatus(await api.requestPermission());
}
