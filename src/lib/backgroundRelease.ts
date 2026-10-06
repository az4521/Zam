// Android: let go of the crypto store while the app sits in the background.
//
// Android freezes the WebView renderer soon after the app leaves the screen
// (about 16s on a Galaxy S24). A push then asks this page to decrypt, but a
// frozen page doesn't answer in time, and because it still holds the crypto
// store's lock the hidden push decryptor (pushDecryptHeadless.ts) can't step
// in either: the notification falls back to generic text.
//
// So once the app has been hidden for RELEASE_AFTER_HIDDEN_MS, the page stops
// its client (closing its OlmMachine), tells the native push service not to
// ask it any more, and releases the lock: every push is then decrypted by the
// hidden decryptor, which works. matrix-js-sdk can't restart crypto on a
// stopped client, so coming back reloads the app (as an account switch does),
// with drafts carried across. Skipped while anything the reload would cut off
// is running (see releaseBlocker).

import { Capacitor } from "@capacitor/core";
import {
    RELEASE_AFTER_HIDDEN_MS,
    releaseBlocker,
} from "$lib/utils/backgroundRelease";
import {
    hasSendsInFlight,
    releaseClientForBackground,
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
    let release: Promise<void> | null = null;

    const tryRelease = () => {
        timer = null;
        if (release || document.visibilityState !== "hidden") return;
        if (!getClient()) return;
        const blocker = releaseBlocker({
            inCall:
                voiceCallState.roomId !== null ||
                voiceCallState.joinPendingRoomId !== null,
            sharingLiveLocation: liveLocationState.shares.size > 0,
            outboxPending: hasOutboxItems(),
            sendsInFlight: hasSendsInFlight(),
            keepAliveHolds: pageKeepAliveHolds(),
        });
        if (blocker) {
            // Stays as before: the push service asks this page first.
            logSync(`background release skipped: ${blocker}`);
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
            if (!release && timer === null)
                timer = setTimeout(tryRelease, RELEASE_AFTER_HIDDEN_MS);
            return;
        }
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
        if (release) {
            // The client is gone for good: start over, as an account switch
            // does. The open room and drafts come back with it.
            void release.finally(() => window.location.reload());
        }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        if (timer !== null) clearTimeout(timer);
    };
}
