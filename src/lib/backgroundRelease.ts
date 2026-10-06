// Android: keep push decryption working while the app sits in the background.
//
// Android freezes the WebView renderer soon after the app leaves the screen
// (about 16s on a Galaxy S24) and thaws it briefly when a push arrives, so
// the push service can ask this page to decrypt (pushDecrypt.ts).
//
// 1. After PAUSE_SYNC_AFTER_HIDDEN_MS hidden, sync is paused (crypto stays
//    open). A thawed page then has no sync backlog to work through first and
//    can answer the push at once. Sync resumes when the app is shown.
//
// 2. Fallback, only on a phone where the page has been seen missing a push's
//    deadline (the push service records it, getPushDecryptMissedAt): after
//    RELEASE_AFTER_HIDDEN_MS the page stops its client, which closes its
//    OlmMachine, tells the push service not to ask it, and releases the
//    crypto store's lock, so the hidden decryptor (pushDecryptHeadless.ts)
//    handles every push. matrix-js-sdk can't restart crypto on a stopped
//    client, so coming back reloads the app (as an account switch does), with
//    drafts carried across. Skipped while anything the reload would cut off
//    is running (see releaseBlocker).

import { Capacitor } from "@capacitor/core";
import {
    PAUSE_SYNC_AFTER_HIDDEN_MS,
    RELEASE_AFTER_HIDDEN_MS,
    releaseBlocker,
    releaseNeeded,
} from "$lib/utils/backgroundRelease";
import {
    hasSendsInFlight,
    pauseSyncInBackground,
    releaseClientForBackground,
    resumeSync,
} from "$lib/matrix/client";
import { getClient } from "$lib/matrix/runtime";
import { logSync } from "$lib/matrix/syncLog";
import {
    getPushDecryptMissedAt,
    setPushDecryptPageActive,
} from "$lib/pushDecrypt";
import { saveDraftsForReload } from "$lib/stores/composerDrafts.svelte";
import { voiceCallState } from "$lib/stores/voiceCall.svelte";
import { liveLocationState } from "$lib/stores/liveLocation.svelte";
import { hasOutboxItems } from "$lib/stores/outbox.svelte";
import { pageKeepAliveHolds } from "$lib/stores/pageKeepAlive";

/** Start watching for the app going to the background. Returns the teardown. */
export function initBackgroundRelease(): () => void {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android")
        return () => {};

    let pauseTimer: ReturnType<typeof setTimeout> | null = null;
    let releaseTimer: ReturnType<typeof setTimeout> | null = null;
    let release: Promise<void> | null = null;
    // When the page last missed a push's deadline here; re-read each time the
    // app is hidden, since the push service records a miss while it is.
    let missedAt: number | null = null;

    const clearTimers = () => {
        if (pauseTimer !== null) clearTimeout(pauseTimer);
        if (releaseTimer !== null) clearTimeout(releaseTimer);
        pauseTimer = releaseTimer = null;
    };

    // Whatever a reload (or, for calls and live location, paused sync) would
    // cut off. Null when the page may step back.
    const blocker = () =>
        releaseBlocker({
            inCall:
                voiceCallState.roomId !== null ||
                voiceCallState.joinPendingRoomId !== null,
            sharingLiveLocation: liveLocationState.shares.size > 0,
            outboxPending: hasOutboxItems(),
            sendsInFlight: hasSendsInFlight(),
            keepAliveHolds: pageKeepAliveHolds(),
        });

    const pause = () => {
        pauseTimer = null;
        if (release || document.visibilityState !== "hidden") return;
        if (!getClient()) return;
        // A call or a live location share needs sync to keep running.
        const why = blocker();
        if (why === "call" || why === "live location") {
            logSync(`sync kept running in the background: ${why}`);
            return;
        }
        pauseSyncInBackground();
    };

    const tryRelease = () => {
        releaseTimer = null;
        if (release || document.visibilityState !== "hidden") return;
        if (!getClient()) return;
        if (!releaseNeeded(missedAt, Date.now())) return;
        const why = blocker();
        if (why) {
            // Stays as before: the push service asks this page first.
            logSync(`background release skipped: ${why}`);
            return;
        }
        saveDraftsForReload();
        release = (async () => {
            // First, so a push arriving meanwhile goes straight to the
            // hidden decryptor (which waits for the lock if it must).
            await setPushDecryptPageActive(false);
            await releaseClientForBackground();
        })();
    };

    const onVisibility = () => {
        if (document.visibilityState === "hidden") {
            if (release) return;
            void getPushDecryptMissedAt().then((at) => (missedAt = at));
            if (pauseTimer === null)
                pauseTimer = setTimeout(pause, PAUSE_SYNC_AFTER_HIDDEN_MS);
            if (releaseTimer === null)
                releaseTimer = setTimeout(tryRelease, RELEASE_AFTER_HIDDEN_MS);
            return;
        }
        clearTimers();
        if (release) {
            // The client is gone for good: start over, as an account switch
            // does. The open room and drafts come back with it.
            void release.finally(() => window.location.reload());
            return;
        }
        resumeSync();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        clearTimers();
        resumeSync();
    };
}
