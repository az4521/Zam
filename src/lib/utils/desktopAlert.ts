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

/** Whether this shell can flash the taskbar (the desktop app only). */
export function canFlashTaskbar(): boolean {
    return typeof window !== "undefined" && !!window.desktop?.notify?.flash;
}

/** Flash the taskbar button (bounce the dock icon on macOS). No-op off
 *  Electron; the main process skips it while the window is focused. */
export function flashTaskbar(): void {
    if (typeof window === "undefined") return;
    window.desktop?.notify?.flash();
}

/** A desktop-shell notification, shaped like the bits of `Notification` that
 *  the app's bookkeeping touches (close + the click/close callbacks). */
export interface NativeNotificationHandle {
    close: () => void;
    onclick: (() => void) | null;
    onclose: (() => void) | null;
}

let nextNativeId = 1;
const nativeHandles = new Map<number, NativeNotificationHandle>();
let unsubscribeNative: (() => void) | null = null;

/**
 * Post an OS notification through the Electron main process. Returns null off
 * Electron (the caller then falls back to the Web Notification API). Popups are
 * replaced per `tag`, and clicks/closes are routed back to the handle.
 */
export function showNativeNotification(opts: {
    title: string;
    body: string;
    tag: string;
    silent?: boolean;
}): NativeNotificationHandle | null {
    if (typeof window === "undefined") return null;
    const bridge = window.desktop?.notify;
    if (!bridge?.show || !bridge.onEvent) return null;
    unsubscribeNative ??= bridge.onEvent(({ id, type }) => {
        const handle = nativeHandles.get(id);
        if (!handle) return;
        if (type === "close") nativeHandles.delete(id);
        (type === "click" ? handle.onclick : handle.onclose)?.();
    });
    const id = nextNativeId++;
    const handle: NativeNotificationHandle = {
        onclick: null,
        onclose: null,
        close: () => {
            nativeHandles.delete(id);
            bridge.close(id);
        },
    };
    nativeHandles.set(id, handle);
    bridge.show({ id, ...opts });
    return handle;
}

/** Show the red unread dot on the desktop tray icon. No-op off Electron. */
export function setTrayUnread(unread: boolean): void {
    if (typeof window === "undefined") return;
    window.desktop?.tray?.setUnread?.(unread);
}
