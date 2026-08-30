// Renderer-side bridge to the packaged desktop "minimise to tray on close"
// preference. The real logic lives in the Electron main process (see
// electron/main.cjs) and is surfaced on `window.desktop.tray` (electron/
// preload.cjs). This module is a thin pass-through that guards on the bridge's
// presence, so importing/calling it is safe on web and Android (where
// `window.desktop` is undefined) — every function no-ops there.

function bridge() {
    return typeof window !== "undefined" ? window.desktop?.tray : undefined;
}

/** Whether the desktop tray bridge is present (packaged Electron). */
export function isDesktopTray(): boolean {
    return bridge() != null;
}

/** Tell the main process whether to hide to the tray (true) or quit (false)
 *  when the window is closed. A no-op off Electron. */
export function setMinimizeToTray(enabled: boolean): void {
    bridge()?.setMinimizeToClose(enabled);
}
