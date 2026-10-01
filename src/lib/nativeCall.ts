// Renderer-side bridge to the native Android call plugin (CallServicePlugin,
// see android/app/src/main/java/moe/crafty/matrix/CallServicePlugin.java),
// which keeps calls alive in the background and registers them with the
// system call stack (Telecom) so they behave like phone calls. Every export
// is a guarded no-op off native Android, so callers need no platform checks
// of their own, and none of them ever throws: a refused foreground service or
// a missing Telecom must never get in the way of the call itself.

import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export type NativeAudioRoute = "earpiece" | "speaker" | "bluetooth" | "wired";

export interface NativeAudioRouteInfo {
    /** Null before the system call stack has reported a route. */
    route: NativeAudioRoute | null;
    available: NativeAudioRoute[];
}

/** Events native raises for the web layer, which owns the call, to carry out. */
export interface NativeCallEvents {
    /** Hang up from the ongoing-call notification, a headset or the car. */
    hangUp: { roomId?: string };
    /** A ringing call answered from a headset / car / watch. */
    answer: { roomId: string; userId?: string | null };
    /** A ringing call declined from the notification or the system. */
    decline: { roomId: string };
    /** The system held the call (e.g. a cellular call was answered). */
    hold: { held: boolean };
    /** Mute toggled from a headset / car. */
    systemMute: { muted: boolean };
    audioRoute: NativeAudioRouteInfo;
}

/** Native plugin surface (implemented in CallServicePlugin.java). */
interface CallServicePlugin {
    start(options: {
        roomId: string;
        title: string;
        isDm: boolean;
    }): Promise<void>;
    stop(): Promise<void>;
    dismissIncomingCall(options: {
        roomId: string;
        declined: boolean;
    }): Promise<void>;
    silenceIncomingCall(options: { roomId: string }): Promise<void>;
    reportIncomingCall(options: {
        roomId: string;
        callerName: string;
        userId: string;
    }): Promise<void>;
    releaseLockScreen(): Promise<void>;
    setAudioRoute(options: { route: NativeAudioRoute }): Promise<void>;
    getAudioRoute(): Promise<Partial<NativeAudioRouteInfo>>;
    resume(): Promise<void>;
    canUseFullScreenIntent(): Promise<{ granted: boolean }>;
    openFullScreenIntentSettings(): Promise<void>;
    addListener<E extends keyof NativeCallEvents>(
        eventName: E,
        listenerFunc: (data: NativeCallEvents[E]) => void,
    ): Promise<PluginListenerHandle>;
}

const CallService = registerPlugin<CallServicePlugin>("CallService");

/** True only on a native Android build, where the plugin is registered. */
export function hasNativeCallService(): boolean {
    return (
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"
    );
}

/** The web layer is in (or joining) a call in this room: keep it running
 *  in the background and register it with the system as a call. Idempotent. */
export function startNativeCall(
    roomId: string,
    title: string,
    isDm: boolean,
): void {
    if (!hasNativeCallService()) return;
    CallService.start({ roomId, title, isDm }).catch((err) =>
        console.warn("Call service did not start:", err),
    );
}

export function stopNativeCall(): void {
    if (!hasNativeCallService()) return;
    CallService.stop().catch(() => {});
}

/** The ring for this room is over (declined here, the caller gave up, or it
 *  was answered): end the system's ringing call and its notification. */
export function dismissNativeIncomingCall(
    roomId: string,
    declined = false,
): void {
    if (!hasNativeCallService()) return;
    CallService.dismissIncomingCall({ roomId, declined }).catch(() => {});
}

/** The in-app card has the ring now: drop the native notification (and its
 *  ringtone) but keep the system call ringing for a headset to answer. */
export function silenceNativeIncomingCall(roomId: string): void {
    if (!hasNativeCallService()) return;
    CallService.silenceIncomingCall({ roomId }).catch(() => {});
}

/** A DM call arrived while the app is hidden (or the screen is off): ring
 *  the native way. Push usually beats this to it; native dedupes by room. */
export function reportNativeIncomingCall(
    roomId: string,
    callerName: string,
    userId: string,
): void {
    if (!hasNativeCallService()) return;
    CallService.reportIncomingCall({ roomId, callerName, userId }).catch(
        () => {},
    );
}

/** No ring and no call any more: drop the over-the-lock-screen state a
 *  full-screen incoming call put the app in. */
export function releaseNativeLockScreen(): void {
    if (!hasNativeCallService()) return;
    CallService.releaseLockScreen().catch(() => {});
}

export function setNativeAudioRoute(route: NativeAudioRoute): void {
    if (!hasNativeCallService()) return;
    CallService.setAudioRoute({ route }).catch(() => {});
}

export async function getNativeAudioRoute(): Promise<NativeAudioRouteInfo | null> {
    if (!hasNativeCallService()) return null;
    try {
        const info = await CallService.getAudioRoute();
        return { route: info.route ?? null, available: info.available ?? [] };
    } catch {
        return null;
    }
}

/** Take the call off a system hold (the other call has ended). */
export function resumeNativeCall(): void {
    if (!hasNativeCallService()) return;
    CallService.resume().catch(() => {});
}

/** Whether an incoming DM call may take over the lock screen. True wherever
 *  the question does not apply (web, desktop, Android < 14). */
export async function canUseFullScreenCalls(): Promise<boolean> {
    if (!hasNativeCallService()) return true;
    try {
        return (await CallService.canUseFullScreenIntent()).granted;
    } catch {
        return true;
    }
}

export async function openFullScreenCallSettings(): Promise<void> {
    if (!hasNativeCallService()) return;
    await CallService.openFullScreenIntentSettings().catch(() => {});
}

/** Subscribe to a native call event. Returns an unsub. */
export function onNativeCallEvent<E extends keyof NativeCallEvents>(
    event: E,
    cb: (data: NativeCallEvents[E]) => void,
): () => void {
    if (!hasNativeCallService()) return () => {};
    let handle: PluginListenerHandle | null = null;
    let disposed = false;
    void CallService.addListener(event, cb).then((h) => {
        if (disposed) void h.remove();
        else handle = h;
    });
    return () => {
        disposed = true;
        void handle?.remove();
    };
}
