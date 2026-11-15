// Settings > General > Network: one interface over the desktop bridge
// (electron/proxy.cjs via window.desktop.proxy) and the Android plugin
// (ZamProxy.java via ProxyPlugin). Null on the web, where the browser owns
// the proxy.

import { Capacitor, registerPlugin } from "@capacitor/core";

export type ProxyBridge = NonNullable<NonNullable<Window["desktop"]>["proxy"]>;

interface AndroidProxyPlugin {
    info(): Promise<DesktopProxyInfo>;
    set(prefs: DesktopProxyPrefs): Promise<DesktopProxyInfo>;
    callTargets(options: { hosts: string[] }): Promise<void>;
}

let android: ProxyBridge | null = null;

function androidBridge(): ProxyBridge {
    if (!android) {
        const plugin = registerPlugin<AndroidProxyPlugin>("Proxy");
        android = {
            info: () => plugin.info(),
            set: (prefs) => plugin.set(prefs),
            callTargets: (hosts) => plugin.callTargets({ hosts }),
            // No resolveProxy in WebView: the call debug panel leaves the
            // Proxy rows out.
        };
    }
    return android;
}

export function proxyBridge(): ProxyBridge | null {
    if (typeof window === "undefined") return null;
    const desktop = window.desktop?.proxy;
    if (desktop) return desktop;
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android")
        return androidBridge();
    return null;
}
