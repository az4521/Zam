import { Capacitor } from "@capacitor/core";

/**
 * True in the Capacitor Android or iOS shell. Native features with a port on
 * both platforms (calls, link previews, file sink, history prefetch, proxy,
 * media saving, debug toggle, plugin sockets) gate on this; Android-only ones
 * (APK/web-bundle updates, UnifiedPush, screen share, native plugin code)
 * keep checking for "android".
 */
export function isMobileNative(): boolean {
    try {
        const platform = Capacitor.getPlatform();
        return platform === "android" || platform === "ios";
    } catch {
        return false;
    }
}

export function isIos(): boolean {
    try {
        return Capacitor.getPlatform() === "ios";
    } catch {
        return false;
    }
}
