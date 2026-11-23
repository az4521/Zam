<script lang="ts">
    import { untrack } from "svelte";
    import { getLoudNotificationCount } from "$lib/stores/notifications.svelte";
    import { voiceCallState } from "$lib/stores/voiceCall.svelte";
    import { syncAppBadge } from "$lib/utils/appBadge";
    import {
        createWakeLockController,
        type WakeLockController,
    } from "$lib/utils/callWakeLock";

    // Holds the controller created below. Plain binding, read only inside untrack.
    let wake: WakeLockController | null = null;

    // Mount: create the wake lock controller first (effects run in declaration
    // order). Teardown (logout / unmount) releases the lock and clears the badge.
    $effect(() => {
        const controller = createWakeLockController();
        wake = controller;
        return () => {
            controller.dispose();
            wake = null;
            syncAppBadge(0);
        };
    });

    // Badge follows the loud notification count.
    $effect(() => {
        const count = getLoudNotificationCount();
        untrack(() => syncAppBadge(count));
    });

    // Keep the screen awake only for connected video calls.
    $effect(() => {
        // A brief reconnect keeps the lock, so the screen doesn't dim mid-call.
        const wanted =
            (voiceCallState.connState === "connected" ||
                voiceCallState.connState === "reconnecting") &&
            (voiceCallState.cameraOn || voiceCallState.videoTiles.length > 0);
        untrack(() => wake?.setWanted(wanted));
    });
</script>
