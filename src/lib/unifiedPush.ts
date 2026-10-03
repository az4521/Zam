// Renderer-side bridge to the UnifiedPush plugin (UnifiedPushPlugin.java +
// UnifiedPushService.java): FCM-free push on Android through a distributor
// app the user picks (ntfy, NextPush, Sunup, ...). push.ts decides whether this
// or FCM is used and registers the Matrix pusher; this module only talks to
// native. Every export is safe to call off Android: it no-ops or reports
// "unavailable".

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export interface UnifiedPushDistributor {
    packageName: string;
    label: string;
}

export interface UnifiedPushStatus {
    /** Installed distributors (this app excluded). */
    distributors: UnifiedPushDistributor[];
    /** The distributor we last registered with, if still installed. */
    savedDistributor: string | null;
    /** Same, but only once the distributor has acknowledged a registration. */
    ackDistributor: string | null;
    /** Latest endpoint the distributor gave us (persisted natively). */
    endpoint: string | null;
    /** The Matrix push gateway paired with `endpoint`. */
    gateway: string | null;
    /** This build has a Firebase config and the device has Play services. */
    fcmAvailable: boolean;
}

export interface UnifiedPushEndpoint {
    endpoint: string;
    gateway: string;
}

interface UnifiedPushPlugin {
    getStatus(): Promise<UnifiedPushStatus>;
    register(options: { distributor?: string }): Promise<{
        distributor: string;
    }>;
    unregister(): Promise<void>;
    addListener(
        eventName: "endpoint",
        listenerFunc: (e: UnifiedPushEndpoint) => void,
    ): Promise<PluginListenerHandle>;
    addListener(
        eventName: "unregistered",
        listenerFunc: () => void,
    ): Promise<PluginListenerHandle>;
    addListener(
        eventName: "registrationFailed",
        listenerFunc: (e: { reason: string }) => void,
    ): Promise<PluginListenerHandle>;
}

const UnifiedPush = registerPlugin<UnifiedPushPlugin>("UnifiedPush");

/** True only on a native Android build, where the plugin is registered. */
export function unifiedPushSupported(): boolean {
    return (
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
}

const EMPTY_STATUS: UnifiedPushStatus = {
    distributors: [],
    savedDistributor: null,
    ackDistributor: null,
    endpoint: null,
    gateway: null,
    fcmAvailable: false,
};

export async function getUnifiedPushStatus(): Promise<UnifiedPushStatus> {
    if (!unifiedPushSupported()) return EMPTY_STATUS;
    try {
        const s = await UnifiedPush.getStatus();
        return { ...EMPTY_STATUS, ...s, distributors: s.distributors ?? [] };
    } catch {
        return EMPTY_STATUS;
    }
}

/** Ask the distributor for an endpoint. It arrives via onUnifiedPushEvent. */
export async function registerUnifiedPush(
    distributor?: string,
): Promise<string> {
    const { distributor: used } = await UnifiedPush.register(
        distributor ? { distributor } : {},
    );
    return used;
}

export async function unregisterUnifiedPush(): Promise<void> {
    if (!unifiedPushSupported()) return;
    await UnifiedPush.unregister().catch(() => {});
}

export interface UnifiedPushHandlers {
    onEndpoint: (e: UnifiedPushEndpoint) => void;
    onUnregistered: () => void;
    onFailed: (reason: string) => void;
}

/** Subscribe to native endpoint changes; returns an unsubscribe function. */
export async function onUnifiedPushEvents(
    handlers: UnifiedPushHandlers,
): Promise<() => Promise<void>> {
    const handles = await Promise.all([
        UnifiedPush.addListener("endpoint", handlers.onEndpoint),
        UnifiedPush.addListener("unregistered", handlers.onUnregistered),
        UnifiedPush.addListener("registrationFailed", (e) =>
            handlers.onFailed(e.reason),
        ),
    ]);
    return async () => {
        await Promise.all(handles.map((h) => h.remove()));
    };
}

// ── Provider preference (device-local) ─────────────────────────────────────

/**
 * Which transport this device uses for push:
 *   "auto"        UnifiedPush if a distributor was chosen before, or if FCM
 *                 can't work here and exactly one distributor is installed;
 *                 otherwise FCM.
 *   "fcm"         always FCM (Google).
 *   "up:<pkg>"    UnifiedPush through that distributor.
 */
export type PushProviderPref = "auto" | "fcm" | `up:${string}`;

const PREF_KEY = "pushProvider";

export function getPushProviderPref(): PushProviderPref {
    try {
        const v = localStorage.getItem(PREF_KEY);
        if (v === "fcm" || (v && v.startsWith("up:") && v.length > 3))
            return v as PushProviderPref;
    } catch {
        /* storage unavailable */
    }
    return "auto";
}

export function setPushProviderPref(pref: PushProviderPref): void {
    try {
        if (pref === "auto") localStorage.removeItem(PREF_KEY);
        else localStorage.setItem(PREF_KEY, pref);
    } catch {
        /* storage unavailable */
    }
}

export type ResolvedPushProvider =
    | { kind: "fcm" }
    | { kind: "unifiedpush"; distributor: string }
    | { kind: "none" };

/**
 * Pure: pick the transport from the preference and what's installed.
 * Kept SDK-free so it can be unit-tested.
 */
export function resolvePushProvider(
    pref: PushProviderPref,
    status: Pick<
        UnifiedPushStatus,
        "distributors" | "savedDistributor" | "fcmAvailable"
    >,
    fcmConfigured: boolean,
): ResolvedPushProvider {
    const installed = status.distributors.map((d) => d.packageName);
    const fcm: ResolvedPushProvider =
        fcmConfigured && status.fcmAvailable
            ? { kind: "fcm" }
            : { kind: "none" };

    if (pref === "fcm") return fcm;
    if (pref.startsWith("up:")) {
        const pkg = pref.slice(3);
        // The chosen distributor was uninstalled: fall back like "auto".
        if (installed.includes(pkg))
            return { kind: "unifiedpush", distributor: pkg };
    }
    if (status.savedDistributor && installed.includes(status.savedDistributor))
        return { kind: "unifiedpush", distributor: status.savedDistributor };
    if (fcm.kind === "fcm") return fcm;
    if (installed.length === 1)
        return { kind: "unifiedpush", distributor: installed[0] };
    return { kind: "none" };
}
