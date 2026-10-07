// Android: keep push decryption working while the app sits in the background.
//
// A push is decrypted by asking this page (pushDecrypt.ts) or, failing that,
// by the hidden decryptor (pushDecryptHeadless.ts), which may only open the
// crypto store while no page holds its lock. But the page's JavaScript doesn't
// run while the app is in the background: the WebView holds a push's request
// until the activity resumes (seen answering 6.5 minutes late, the moment the
// app was opened), even when Android thaws the renderer for the push. So a
// backgrounded page can't decrypt anything, and its lock shuts the hidden
// decryptor out.
//
// So once the app has been hidden for RELEASE_AFTER_HIDDEN_MS, the page tells
// the push service not to ask it, stops its client (closing its OlmMachine)
// and releases the store's lock: every push is then decrypted by the hidden
// decryptor. Coming back restarts crypto and sync in place (the lock is
// waited for if a push decrypt holds it). If that fails the app reloads, as
// an account switch does, with drafts carried across. Skipped while anything
// a reload would cut off is running (see releaseBlocker).

import { Capacitor } from "@capacitor/core";
import {
    RELEASE_AFTER_HIDDEN_MS,
    releaseBlocker,
} from "$lib/utils/backgroundRelease";
import {
    hasSendsInFlight,
    releaseClientForBackground,
    restartAfterBackgroundRelease,
} from "$lib/matrix/client";
import { getClient } from "$lib/matrix/runtime";
import { logSync } from "$lib/matrix/syncLog";
import { setPushDecryptPageActive } from "$lib/pushDecrypt";
import { saveDraftsForReload } from "$lib/stores/composerDrafts.svelte";
import { voiceCallState } from "$lib/stores/voiceCall.svelte";
import { liveLocationState } from "$lib/stores/liveLocation.svelte";
import { hasOutboxItems } from "$lib/stores/outbox.svelte";
import { pageKeepAliveHolds } from "$lib/stores/pageKeepAlive";

/** Start watching for the app going to the background. Returns the teardown. */
export function initBackgroundRelease(): () => void {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android")
        return () => {};

    let timer: ReturnType<typeof setTimeout> | null = null;
    // The release in progress or done; null while the page holds the store.
    let release: Promise<void> | null = null;
    // Coming back: restarting in place (or reloading). One at a time.
    let returning: Promise<void> | null = null;

    const tryRelease = () => {
        timer = null;
        if (release || returning || document.visibilityState !== "hidden")
            return;
        if (!getClient()) return;
        const why = releaseBlocker({
            inCall:
                voiceCallState.roomId !== null ||
                voiceCallState.joinPendingRoomId !== null,
            sharingLiveLocation: liveLocationState.shares.size > 0,
            outboxPending: hasOutboxItems(),
            sendsInFlight: hasSendsInFlight(),
            keepAliveHolds: pageKeepAliveHolds(),
        });
        if (why) {
            // Stays as before: the push service asks this page first.
            logSync(`background release skipped: ${why}`);
            return;
        }
        release = (async () => {
            // First, so a push arriving meanwhile goes straight to the
            // hidden decryptor (which waits for the lock if it must).
            await setPushDecryptPageActive(false);
            await releaseClientForBackground();
        })();
    };

    const comeBack = async (released: Promise<void>) => {
        await released.catch(() => {});
        let restarted = false;
        try {
            restarted = await restartAfterBackgroundRelease();
        } catch (err) {
            logSync(`restart after the background release failed: ${err}`);
        }
        if (!restarted) {
            // The client is gone for good: start over, as an account switch
            // does. The open room and drafts come back with it.
            saveDraftsForReload();
            window.location.reload();
            return;
        }
        await setPushDecryptPageActive(true);
    };

    const onVisibility = () => {
        if (document.visibilityState === "hidden") {
            if (!release && !returning && timer === null)
                timer = setTimeout(tryRelease, RELEASE_AFTER_HIDDEN_MS);
            return;
        }
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        if (release && !returning) {
            const released = release;
            returning = comeBack(released).finally(() => {
                release = null;
                returning = null;
            });
        }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        if (timer !== null) clearTimeout(timer);
    };
}
