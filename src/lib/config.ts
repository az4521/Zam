import { Capacitor } from "@capacitor/core";

/** Default homeserver shown in the login form. */
export const DEFAULT_HOMESERVER = "https://matrix.crafty.moe";

/** Default homeserver shown when running as an APK, installed PWA, or Electron app. */
export const INSTALLED_APP_DEFAULT_HOMESERVER = "https://matrix.org";

type StandaloneNavigator = Navigator & { standalone?: boolean };

/** Whether the login page is running inside one of the installed app shells. */
export function isInstalledApp(): boolean {
    if (Capacitor.isNativePlatform()) return true;
    if (typeof window === "undefined" || typeof navigator === "undefined")
        return false;

    return (
        window.desktop !== undefined ||
        /electron/i.test(navigator.userAgent) ||
        window.matchMedia?.("(display-mode: standalone)").matches === true ||
        (navigator as StandaloneNavigator).standalone === true
    );
}

/** Select the login-page default for the current runtime. */
export function getDefaultHomeserver(): string {
    return isInstalledApp()
        ? INSTALLED_APP_DEFAULT_HOMESERVER
        : DEFAULT_HOMESERVER;
}
