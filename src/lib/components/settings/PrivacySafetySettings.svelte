<script lang="ts">
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import BlockedUsersSettings from "$lib/components/settings/BlockedUsersSettings.svelte";
    import {
        setPrivateReadReceipts,
        setHideNotificationBody,
        setLinkPreviewMedia,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import type { LinkPreviewMedia } from "$lib/utils/linkPreviewPolicy";
    import {
        updateServiceWorkerNotificationPrivacy,
        updateServiceWorkerReceiptPrivacy,
    } from "$lib/matrix/client";
    import { syncNativeNotificationPrivacy } from "$lib/nativeSession";
    import { auth } from "$lib/stores/auth.svelte";

    const linkPreviewOptions: Array<{
        value: LinkPreviewMedia;
        label: string;
        title: string;
    }> = [
        {
            value: "all",
            label: "All",
            title: "Load preview media from wherever it is hosted",
        },
        {
            value: "proxied",
            label: "Homeserver only",
            title: "Only load preview media your own homeserver serves",
        },
        {
            value: "none",
            label: "Off",
            title: "Never load preview media automatically",
        },
    ];

    function onToggleHideNotificationBody(value: boolean) {
        setHideNotificationBody(value);
        // The service worker and the Android FCM service each keep their own
        // copy of this flag — they cannot read localStorage.
        updateServiceWorkerNotificationPrivacy(value);
        syncNativeNotificationPrivacy(value).catch(() => {});
    }

    function onTogglePrivateReadReceipts(value: boolean) {
        setPrivateReadReceipts(value);
        // The service worker keeps its own copy for quick mark-read actions.
        if (auth.userId) {
            updateServiceWorkerReceiptPrivacy(auth.userId, value);
        }
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
                onChange={onTogglePrivateReadReceipts}
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
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >Link preview media</span
                >
                <p class="text-xs text-discord-textMuted">
                    Preview images and videos usually come straight from the
                    site that hosts them, so that site learns your IP address
                    and when you read the message. "Homeserver only" loads just
                    the copies your own server serves; "Off" loads none of it.
                    Both also hide embedded YouTube players and X/Twitter cards,
                    which always load straight from those sites. Either way,
                    each affected preview keeps a button to load its media. The
                    link-preview on/off switch lives in Messages & Media.
                </p>
            </div>
            <OptionSelector
                value={settingsState.linkPreviewMedia}
                options={linkPreviewOptions}
                onChange={setLinkPreviewMedia}
                ariaLabel="Link preview media"
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
