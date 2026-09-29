// When a message should pop an OS notification / flash the taskbar.
//
// Matrix push rules split notifying events into "loud" (sound tweak) and
// "silent" (notify only). This device-local preference picks which of those
// raise the desktop alert: loud only, both, or neither.

export type DesktopAlertMode = "loud" | "all" | "none";

/** Default keeps the historical behaviour: every notifying event alerts. */
export const DEFAULT_DESKTOP_ALERT_MODE: DesktopAlertMode = "all";

export function normalizeDesktopAlertMode(
    value: string | null | undefined,
): DesktopAlertMode {
    return value === "loud" || value === "all" || value === "none"
        ? value
        : DEFAULT_DESKTOP_ALERT_MODE;
}

export function shouldAlertDesktop(
    mode: DesktopAlertMode,
    loud: boolean,
): boolean {
    return mode === "all" || (mode === "loud" && loud);
}

/** Flash the taskbar button (bounce the dock icon on macOS). No-op off
 *  Electron; the main process skips it while the window is focused. */
export function flashTaskbar(): void {
    if (typeof window === "undefined") return;
    window.desktop?.notify?.flash();
}
