/**
 * Bring the app window to the foreground in response to an OS-notification
 * click.
 *
 * In Electron the window may be hidden to the system tray, and `window.focus()`
 * cannot un-hide a hidden BrowserWindow — the preload bridge
 * (`window.desktop.showWindow`, see electron/preload.cjs) sends an IPC message
 * that does. In the browser, and in any build without the bridge, there is
 * nothing to un-hide, so a plain `window.focus()` is the right (and only) tool.
 */
export function restoreAppWindow(): void {
    if (typeof window === "undefined") return;
    if (window.desktop?.showWindow) {
        window.desktop.showWindow();
        return;
    }
    window.focus();
}
