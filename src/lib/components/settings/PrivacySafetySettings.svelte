<script lang="ts">
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import BlockedUsersSettings from "$lib/components/settings/BlockedUsersSettings.svelte";
    import {
        setPrivateReadReceipts,
        setHideNotificationBody,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { updateServiceWorkerNotificationPrivacy } from "$lib/matrix/client";
    import { syncNativeNotificationPrivacy } from "$lib/nativeSession";

    function onToggleHideNotificationBody(value: boolean) {
        setHideNotificationBody(value);
        // The service worker and the Android FCM service each keep their own
        // copy of this flag — they cannot read localStorage.
        updateServiceWorkerNotificationPrivacy(value);
        syncNativeNotificationPrivacy(value).catch(() => {});
    }
</script>

<div class="space-y-6">
    <section data-setting-anchor="notif-privacy">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            Privacy
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Private read receipts
                </p>
                <p class="text-xs text-discord-textMuted">
                    Hide your read receipts from other users. Your unread counts
                    still work; others just can't see how far you've read.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.privateReadReceipts}
                onChange={setPrivateReadReceipts}
                label="Private read receipts"
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Hide message text in notifications
                </p>
                <p class="text-xs text-discord-textMuted">
                    Notifications on this device say who messaged you, but not
                    what they said. The sender and room names are still shown.
                    Applies to this device only.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.hideNotificationBody}
                onChange={onToggleHideNotificationBody}
                label="Hide message text in notifications"
            />
        </div>
    </section>

    <h3
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
    >
        Blocked users
    </h3>
    <BlockedUsersSettings />
</div>
