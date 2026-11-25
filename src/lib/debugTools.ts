// The Android "WebView debugging" switch in Settings > Debug Info, backed by
// DebugToolsPlugin.java. Lets a release APK be inspected from
// chrome://inspect, which Capacitor otherwise only allows for debug builds.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { isMobileNative } from "./utils/mobileNative";

interface DebugToolsPlugin {
    getWebViewDebugging(): Promise<{ enabled: boolean }>;
    setWebViewDebugging(options: {
        enabled: boolean;
    }): Promise<{ enabled: boolean }>;
    getPushLog(): Promise<{ text: string }>;
}

const DebugTools = registerPlugin<DebugToolsPlugin>("DebugTools");

/** Only the Android and iOS apps have a switch; elsewhere devtools are always there. */
export function canToggleWebViewDebugging(): boolean {
    return Capacitor.isNativePlatform() && isMobileNative();
}

export async function getWebViewDebugging(): Promise<boolean> {
    if (!canToggleWebViewDebugging()) return false;
    return (await DebugTools.getWebViewDebugging()).enabled;
}

/**
 * What the Android push service did with each recent push (posted, skipped
 * and why, FCM priority as delivered). Null off Android, or from an APK older
 * than the method, so the export still works there.
 */
export async function getNativePushLog(): Promise<string | null> {
    if (!canToggleWebViewDebugging()) return null;
    try {
        return (await DebugTools.getPushLog()).text;
    } catch {
        return null;
    }
}

export async function setWebViewDebugging(enabled: boolean): Promise<boolean> {
    if (!canToggleWebViewDebugging()) return false;
    return (await DebugTools.setWebViewDebugging({ enabled })).enabled;
}
