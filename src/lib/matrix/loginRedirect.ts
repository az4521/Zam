// How a browser-based sign-in (legacy SSO or native OAuth) leaves the app and
// comes back, per runtime. Shared so both flows ride the same three channels:
//   - web:      this origin (full page load)
//   - Electron: the system browser hits the app's local server at
//               `/sso-callback`, which forwards it over IPC (electron/main.cjs)
//   - Android:  the `moe.crafty.matrix:` deep link (AndroidManifest.xml)

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/** Custom URL scheme the Android app owns (AndroidManifest.xml). */
export const NATIVE_SCHEME = "moe.crafty.matrix";

export function isElectronWithSso(): boolean {
    return typeof window !== "undefined" && !!window.desktop?.sso;
}

/** Leave for the provider's page: system browser on desktop, navigation elsewhere. */
export function openLoginUrl(url: string): void {
    if (isElectronWithSso()) {
        // The window-open handler hands this to the system browser.
        window.open(url, "_blank", "noopener");
    } else {
        // Web: a plain navigation. Capacitor sends off-app navigations to the
        // system browser.
        window.location.assign(url);
    }
}

/** Whether opening the provider's page navigates this document away. */
export function loginLeavesPage(): boolean {
    return !isElectronWithSso() && !Capacitor.isNativePlatform();
}

/**
 * Deliver callback URLs as they arrive: the current page (web), the Electron
 * local-server relay, or the Android deep link (including the one that
 * cold-started the app). `isCallbackUrl` says whether the page URL carries
 * callback parameters worth handing over. Returns a disposer.
 */
export function listenForLoginCallbacks(
    cb: (rawUrl: string) => void,
    isCallbackUrl: (url: URL) => boolean,
): () => void {
    const disposers: Array<() => void> = [];

    if (isCallbackUrl(new URL(window.location.href))) cb(window.location.href);

    if (window.desktop?.sso) {
        disposers.push(window.desktop.sso.onCallback(cb));
    }

    if (Capacitor.isNativePlatform()) {
        let disposed = false;
        const isOurs = (u: string) => u.startsWith(`${NATIVE_SCHEME}:`);
        App.getLaunchUrl()
            .then((launch) => {
                if (!disposed && launch?.url && isOurs(launch.url))
                    cb(launch.url);
            })
            .catch(() => {});
        const handle = App.addListener("appUrlOpen", (e) => {
            if (isOurs(e.url)) cb(e.url);
        });
        disposers.push(() => {
            disposed = true;
            void handle.then((h) => h.remove()).catch(() => {});
        });
    }

    return () => disposers.forEach((d) => d());
}
