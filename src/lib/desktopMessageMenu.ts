// Renderer side of the Electron right-click menu for a message row
// (electron/main.cjs builds the native menu; preload exposes
// `window.desktop.contextMenu`). The row hands over its action list on
// `contextmenu` — synchronously, so main has it before Chromium's own
// `context-menu` event for that same click — and main sends back the key of the
// item the user picks. A no-op on web and Android, where `window.desktop` is
// undefined.

export interface DesktopMenuItem {
    key: string;
    label: string;
    danger?: boolean;
}

/** Runs the chosen key for the row that was right-clicked last. */
let current: ((key: string) => void) | null = null;

/** Offer `items` in the native menu for this right-click; `run` gets the pick. */
export function publishMessageMenu(
    items: DesktopMenuItem[],
    run: (key: string) => void,
): void {
    const bridge =
        typeof window !== "undefined" ? window.desktop?.contextMenu : undefined;
    if (!bridge?.setMessageActions) return;
    current = run;
    bridge.setMessageActions(items);
}

/** Route picks from the native menu to the row that published them. Returns an
 *  unsubscribe function (a no-op off Electron). */
export function installDesktopMessageMenu(): () => void {
    const bridge =
        typeof window !== "undefined" ? window.desktop?.contextMenu : undefined;
    if (!bridge?.onMessageAction) return () => {};
    return bridge.onMessageAction((key) => current?.(key));
}
