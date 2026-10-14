import { Capacitor } from "@capacitor/core";

/** Whether the app itself ships the noise filter models (Android APK,
 *  Electron build) rather than fetching them into $lib/audio/modelCache. */
export function modelIsBundled(): boolean {
    return (
        Capacitor.isNativePlatform() ||
        (typeof window !== "undefined" && window.desktop !== undefined)
    );
}
