<script lang="ts">
    import { t } from "$lib/i18n";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import BlockedUsersSettings from "$lib/components/settings/BlockedUsersSettings.svelte";
    import {
        setPrivateReadReceipts,
        setSendTypingIndicators,
        setHideNotificationBody,
        setLinkPreviewMedia,
        setIndexEncryptedRooms,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import type { LinkPreviewMedia } from "$lib/utils/linkPreviewPolicy";
    import {
        updateServiceWorkerNotificationPrivacy,
        updateServiceWorkerReceiptPrivacy,
        startEventIndex,
        deleteEventIndex,
    } from "$lib/matrix/client";
    import {
        syncNativeNotificationPrivacy,
        syncNativeReceiptPrivacy,
    } from "$lib/nativeSession";
    import { auth } from "$lib/stores/auth.svelte";

    const linkPreviewOptions: Array<{
        value: LinkPreviewMedia;
        label: string;
        title: string;
    }> = [
        {
            value: "all",
            label: t("privacySafetySettings.all"),
            title: t("privacySafetySettings.loadPreviewMediaFromWhereverIt"),
        },
        {
            value: "proxied",
            label: t("privacySafetySettings.homeserverOnly"),
            title: t("privacySafetySettings.onlyLoadPreviewMediaYourOwn"),
        },
        {
            value: "none",
            label: t("privacySafetySettings.off"),
            title: t(
                "privacySafetySettings.neverLoadPreviewMediaAutomatically",
            ),
        },
    ];

    function onToggleHideNotificationBody(value: boolean) {
        setHideNotificationBody(value);
        // The service worker and the Android FCM service each keep their own
        // copy of this flag — they cannot read localStorage.
        updateServiceWorkerNotificationPrivacy(value);
        syncNativeNotificationPrivacy(value).catch(() => {});
    }

    function onToggleIndexEncryptedRooms(value: boolean) {
        setIndexEncryptedRooms(value);
        if (value) startEventIndex();
        else if (auth.userId && auth.deviceId)
            void deleteEventIndex(auth.userId, auth.deviceId);
    }

    function onTogglePrivateReadReceipts(value: boolean) {
        setPrivateReadReceipts(value);
        // The service worker and the Android notification actions each keep
        // their own copy for quick mark-read.
        if (auth.userId) {
            updateServiceWorkerReceiptPrivacy(auth.userId, value);
            syncNativeReceiptPrivacy(auth.userId, value).catch(() => {});
        }
    }
</script>

<div class="space-y-6">
    <section data-setting-anchor="notif-privacy">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-2"
        >
            {t("privacySafetySettings.privacy")}
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("privacySafetySettings.privateReadReceipts")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("privacySafetySettings.hideYourReadReceiptsFromOther")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.privateReadReceipts}
                onChange={onTogglePrivateReadReceipts}
                label={t("privacySafetySettings.privateReadReceipts")}
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("privacySafetySettings.sendTypingIndicators")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("privacySafetySettings.letOthersInARoomSee")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.sendTypingIndicators}
                onChange={setSendTypingIndicators}
                label={t("privacySafetySettings.sendTypingIndicators")}
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("privacySafetySettings.indexEncryptedRooms")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("privacySafetySettings.indexEncryptedRoomsHint")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.indexEncryptedRooms}
                onChange={onToggleIndexEncryptedRooms}
                label={t("privacySafetySettings.indexEncryptedRooms")}
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("privacySafetySettings.hideMessageTextInNotifications")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("privacySafetySettings.notificationsOnThisDeviceSayWho")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.hideNotificationBody}
                onChange={onToggleHideNotificationBody}
                label={t(
                    "privacySafetySettings.hideMessageTextInNotifications",
                )}
            />
        </div>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >{t("privacySafetySettings.linkPreviewMedia")}</span
                >
                <p class="text-xs text-discord-textMuted">
                    {t(
                        "privacySafetySettings.previewImagesAndVideosUsuallyCome",
                    )}
                </p>
            </div>
            <OptionSelector
                value={settingsState.linkPreviewMedia}
                options={linkPreviewOptions}
                onChange={setLinkPreviewMedia}
                ariaLabel={t("privacySafetySettings.linkPreviewMedia")}
            />
        </div>
    </section>

    <h3
        class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
    >
        {t("privacySafetySettings.blockedUsers")}
    </h3>
    <BlockedUsersSettings />
</div>
