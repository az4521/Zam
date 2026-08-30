// Pure decision for the Electron window "close" (X) button: hide to the system
// tray, or close (which quits the app). The Electron main process (main.cjs) is
// plain CommonJS required as-is and cannot import this TS module, so it mirrors
// this same trivial branch inline — keep the two in sync (there is no runtime
// import between them). This module exists so the decision is unit-testable and
// documented in one place.

export type WindowCloseAction = "hide" | "close";

/**
 * Decide what the window close (X) button should do.
 *
 * @param minimizeToTray device-local preference: keep running in the tray on close
 * @param explicitQuit   the user chose to quit (tray Quit / before-quit / quit-and-install)
 */
export function resolveWindowCloseAction(opts: {
    minimizeToTray: boolean;
    explicitQuit: boolean;
}): WindowCloseAction {
    if (opts.explicitQuit) return "close";
    return opts.minimizeToTray ? "hide" : "close";
}
