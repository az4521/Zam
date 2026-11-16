// The startup call for the RTCRtpScriptTransform shim: Android only (the
// native platform, not the web or the service worker). Kept apart from the
// shim so the worker bundle never imports Capacitor.
import { Capacitor } from "@capacitor/core";
import {
    installScriptTransformPolyfill,
    type ScriptTransformGlobal,
} from "./rtcScriptTransform";

export function installAndroidScriptTransform(): boolean {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android")
        return false;
    return installScriptTransformPolyfill(globalThis as ScriptTransformGlobal);
}
