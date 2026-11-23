// Web install affordance (PWA "Add to Home Screen" / "Install app").
//
// Chromium fires `beforeinstallprompt` early, once the app is installable. We
// keep that event (preventDefault stops the mini-infobar) and call prompt() only
// from a user gesture (the About button). iOS Safari has no event; it gets a
// manual Share-sheet hint instead. Everything is inert in Capacitor native and
// in Electron.

import { Capacitor } from "@capacitor/core";
import { chooseInstallUi, type InstallUi } from "$lib/utils/installPrompt";

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{
        outcome: "accepted" | "dismissed";
        platform: string;
    }>;
}

export type InstallPromptResult = "accepted" | "dismissed" | "unavailable";

// $state.raw: the event is a platform object, not a plain value to proxy.
let deferred = $state.raw<BeforeInstallPromptEvent | null>(null);
let installedFlag = $state(false);
let standaloneFlag = $state(false);

let initialized = false;

function isElectron(): boolean {
    return (
        typeof window !== "undefined" &&
        Boolean((window as unknown as { desktop?: unknown }).desktop)
    );
}

function isNative(): boolean {
    try {
        return Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}

function inert(): boolean {
    return isNative() || isElectron();
}

function ui(): InstallUi {
    if (typeof navigator === "undefined") return "none";
    return chooseInstallUi({
        ua: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        standalone: installedFlag || standaloneFlag,
        isNative: isNative(),
        isElectron: isElectron(),
        canPrompt: deferred !== null,
    });
}

export const installPrompt = {
    /** A native install prompt is captured and can be shown now. */
    get canPrompt(): boolean {
        return ui() === "prompt";
    },
    /** Running as an installed app, or the app was just installed. */
    get installed(): boolean {
        return installedFlag || standaloneFlag;
    },
    /** iOS Safari outside standalone: show the Share > Add to Home Screen hint. */
    get iosManualHint(): boolean {
        return ui() === "ios-hint";
    },
};

/**
 * Attach the browser listeners. Idempotent; safe to call at layout init, since
 * `beforeinstallprompt` can fire before any component mounts.
 */
export function initInstallPrompt(): void {
    if (initialized) return;
    initialized = true;
    if (typeof window === "undefined" || inert()) return;

    window.addEventListener("beforeinstallprompt", (e: Event) => {
        // Keep the event for a later user-initiated prompt() call; stop the
        // browser from showing its own mini-infobar at an arbitrary moment.
        e.preventDefault();
        deferred = e as BeforeInstallPromptEvent;
    });
    window.addEventListener("appinstalled", () => {
        installedFlag = true;
        deferred = null;
    });

    const mq = window.matchMedia?.("(display-mode: standalone)");
    if (mq) {
        standaloneFlag = mq.matches;
        mq.addEventListener?.("change", (ev) => {
            standaloneFlag = ev.matches;
        });
    }
    if (
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    ) {
        standaloneFlag = true;
    }
}

/**
 * Show the captured install prompt. Must run from a user gesture. Resolves
 * "unavailable" when there is no captured event (iOS, already installed,
 * native/Electron, or the browser has not deemed the app installable).
 */
export async function promptInstall(): Promise<InstallPromptResult> {
    const ev = deferred;
    if (!ev || inert() || installedFlag || standaloneFlag) return "unavailable";
    // An event can only be prompted once; drop it either way.
    deferred = null;
    try {
        await ev.prompt();
        const choice = await ev.userChoice;
        if (choice.outcome === "accepted") installedFlag = true;
        return choice.outcome;
    } catch {
        return "unavailable";
    }
}
