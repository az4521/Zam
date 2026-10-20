// The Android "WebView debugging" switch in Settings > Debug Info, backed by
// DebugToolsPlugin.java. Lets a release APK be inspected from
// chrome://inspect, which Capacitor otherwise only allows for debug builds.
import { Capacitor, registerPlugin } from "@capacitor/core";

interface DebugToolsPlugin {
    getWebViewDebugging(): Promise<{ enabled: boolean }>;
    setWebViewDebugging(options: {
        enabled: boolean;
    }): Promise<{ enabled: boolean }>;
}

const DebugTools = registerPlugin<DebugToolsPlugin>("DebugTools");

/** Only the Android app has a switch; elsewhere devtools are always there. */
export function canToggleWebViewDebugging(): boolean {
    return (
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
}

export async function getWebViewDebugging(): Promise<boolean> {
    if (!canToggleWebViewDebugging()) return false;
    return (await DebugTools.getWebViewDebugging()).enabled;
}

export async function setWebViewDebugging(enabled: boolean): Promise<boolean> {
    if (!canToggleWebViewDebugging()) return false;
    return (await DebugTools.setWebViewDebugging({ enabled })).enabled;
}
