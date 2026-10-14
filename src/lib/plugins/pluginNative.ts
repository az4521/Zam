/**
 * zam.native: a repo plugin's own native code, in the desktop and Android
 * apps. The native side does the work that has to be trusted (electron/
 * pluginNative.cjs, android PluginNativePlugin.java): it fetches the
 * plugin's manifest itself from the pinned commit, asks the user in a system
 * dialog, downloads and checks every file, and starts the plugin's host (a
 * utility process on desktop; a class loaded into the app on Android). Each
 * connect() gets a fresh MessagePort to that host; it arrives as the window
 * message "zam:plugin-native-port:<id>". Messages over it are strings or
 * ArrayBuffers (Android's WebMessagePort carries nothing else).
 */
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { Manifest } from "./manifest";
import { normalizeRepoRef } from "./repo";
import type { PluginFileSource } from "./pluginAssets";

const PORT_TIMEOUT_MS = 15_000;

interface NativeRequest {
    id: string;
    pluginId: string;
    owner: string;
    repo: string;
    sha: string;
    path: string;
}

interface Bridge {
    platform: string;
    open(req: NativeRequest): Promise<{ ok: boolean; error?: string }>;
    remove(pluginId: string): Promise<void>;
}

interface AndroidPluginNative {
    platform(): Promise<{ platform: string }>;
    open(req: NativeRequest): Promise<void>;
    remove(o: { pluginId: string }): Promise<void>;
}
const AndroidNative = registerPlugin<AndroidPluginNative>("PluginNative");

function onAndroid(): boolean {
    return (
        typeof window !== "undefined" &&
        Capacitor.getPlatform() === "android" &&
        Capacitor.isPluginAvailable("PluginNative")
    );
}

// The Android ABI is only known asynchronously; ask once, early.
let androidPlatform: string | null = null;
if (onAndroid())
    AndroidNative.platform()
        .then((r) => (androidPlatform = r.platform))
        .catch(() => {});

function bridge(): Bridge | undefined {
    if (typeof window === "undefined") return undefined;
    const desktop = window.desktop?.pluginNative;
    if (desktop) return desktop;
    if (onAndroid() && androidPlatform) {
        const platform = androidPlatform;
        return {
            platform,
            open: (req) =>
                AndroidNative.open(req).then(
                    () => ({ ok: true }),
                    (err: unknown) => ({
                        ok: false,
                        error: String((err as Error)?.message ?? err),
                    }),
                ),
            remove: (pluginId) => AndroidNative.remove({ pluginId }),
        };
    }
    return undefined;
}

/** Whether `manifest` ships native code this desktop build can run. */
export function nativeAvailable(
    manifest: Manifest,
    source: PluginFileSource | null,
): boolean {
    const b = bridge();
    return (
        !!b &&
        !!source &&
        !!manifest.capabilities?.includes("native") &&
        !!manifest.native?.platforms[b.platform]
    );
}

function randomId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** The port posted to the window as `zam:plugin-native-port:<id>`. */
export function waitForWindowPort(
    tag: string,
    timeoutMs = PORT_TIMEOUT_MS,
): Promise<MessagePort> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            window.removeEventListener("message", onMessage);
            reject(new Error("the native host's port never arrived"));
        }, timeoutMs);
        function onMessage(e: MessageEvent) {
            if (e.data !== tag || !e.ports[0]) return;
            clearTimeout(timer);
            window.removeEventListener("message", onMessage);
            resolve(e.ports[0]);
        }
        window.addEventListener("message", onMessage);
    });
}

export async function connectNative(
    pluginId: string,
    manifest: Manifest,
    source: PluginFileSource | null,
): Promise<MessagePort> {
    const b = bridge();
    if (!b || !source || !nativeAvailable(manifest, source))
        throw new Error("this plugin has no native code for this device");
    const ref = normalizeRepoRef(source.repoRef);
    const id = randomId();
    const port = waitForWindowPort(`zam:plugin-native-port:${id}`);
    const r = await b.open({
        id,
        pluginId,
        owner: ref.owner,
        repo: ref.repo,
        sha: source.sha,
        path: source.path,
    });
    if (!r.ok) {
        port.catch(() => {});
        throw new Error(r.error ?? "the native host didn't start");
    }
    return port;
}

/** Stop the plugin's host and delete its native files (uninstall). */
export function removePluginNative(pluginId: string): void {
    void bridge()?.remove(pluginId);
}
