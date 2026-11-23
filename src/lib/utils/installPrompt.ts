// Pure decision logic for the web "Install app" affordance. The store in
// stores/installPrompt.svelte.ts gathers the environment; this decides which
// UI (if any) the About surface shows. Kept free of DOM and SDK imports so it
// can be unit-tested directly.

export interface InstallEnv {
    /** navigator.userAgent */
    ua: string;
    /** navigator.maxTouchPoints (iPadOS reports a Mac UA, so touch is the tell) */
    maxTouchPoints: number;
    /** Already running as an installed app (display-mode standalone or iOS standalone). */
    standalone: boolean;
    /** Capacitor native shell (Android APK). */
    isNative: boolean;
    /** Electron desktop build (window.desktop present). */
    isElectron: boolean;
    /** A beforeinstallprompt event was captured and not yet used. */
    canPrompt: boolean;
}

export type InstallUi = "none" | "prompt" | "ios-hint";

export function isIosDevice(ua: string, maxTouchPoints: number): boolean {
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    // iPadOS 13+ requests the desktop site by default and reports "Macintosh".
    return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

/**
 * True for Safari on iOS/iPadOS. Other iOS browsers (Chrome, Firefox, Edge,
 * Opera, DuckDuckGo) carry their own tokens and are excluded, since the
 * "Share > Add to Home Screen" instruction is written for Safari.
 */
export function isIosSafari(ua: string, maxTouchPoints: number): boolean {
    if (!isIosDevice(ua, maxTouchPoints)) return false;
    if (!/Safari\//.test(ua)) return false;
    return !/CriOS|FxiOS|EdgiOS|OPiOS|EdgA|DuckDuckGo/.test(ua);
}

export function chooseInstallUi(env: InstallEnv): InstallUi {
    // Native shells and the Electron desktop app have their own install story;
    // an already-installed app has nothing to offer.
    if (env.isNative || env.isElectron || env.standalone) return "none";
    if (env.canPrompt) return "prompt";
    if (isIosSafari(env.ua, env.maxTouchPoints)) return "ios-hint";
    return "none";
}
