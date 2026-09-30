<script lang="ts">
    import { t } from "$lib/i18n";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        setShowMatrixIds,
        setShowReadReceiptAvatars,
        setHoldToOpenMessageMenu,
        setLinkPreviewsEnabled,
        setPauseVideoOnScrollOff,
        setGifDefaultTab,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { type GifTab } from "$lib/utils/klipy";

    const gifTabOptions: Array<{ value: GifTab; label: string }> = [
        { value: "gifs", label: "GIFs" },
        { value: "favourites", label: t("messagesMediaSettings.favourites") },
    ];
</script>

<div class="space-y-6">
    <section data-setting-anchor="cust-messages">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("messagesMediaSettings.messages")}
        </p>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("messagesMediaSettings.showMatrixIds")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("messagesMediaSettings.showFullMatrixIdsLikeUser")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showMatrixIds}
                onChange={setShowMatrixIds}
                label={t("messagesMediaSettings.showMatrixIds")}
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("messagesMediaSettings.readReceiptAvatars")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("messagesMediaSettings.showWhoHasReadEachMessage")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showReadReceiptAvatars}
                onChange={setShowReadReceiptAvatars}
                label={t("messagesMediaSettings.readReceiptAvatars")}
            />
        </div>
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("messagesMediaSettings.holdToOpenMessageMenu")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("messagesMediaSettings.onTouchDevicesOpenAMessage")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.holdToOpenMessageMenu}
                onChange={setHoldToOpenMessageMenu}
                label={t("messagesMediaSettings.holdToOpenMessageMenu")}
            />
        </div>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >{t("messagesMediaSettings.linkPreviews")}</span
                >
                <p class="text-xs text-discord-textMuted">
                    {t("messagesMediaSettings.whenOffNoLinkPreviewIs")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.linkPreviewsEnabled}
                onChange={setLinkPreviewsEnabled}
                label={t("messagesMediaSettings.linkPreviews")}
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("messagesMediaSettings.pauseVideosOffScreen")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("messagesMediaSettings.pauseAPlayingVideoWhenIt")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.pauseVideoOnScrollOff}
                onChange={setPauseVideoOnScrollOff}
                label={t("messagesMediaSettings.pauseVideosOffScreen")}
            />
        </div>
    </section>

    <section data-setting-anchor="cust-gifs">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("common.gifs")}
        </p>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >{t("messagesMediaSettings.defaultTab")}</span
                >
                <p class="text-xs text-discord-textMuted">
                    {t("messagesMediaSettings.whichTabTheGifPickerOpens")}
                </p>
            </div>
            <OptionSelector
                value={settingsState.gifDefaultTab}
                options={gifTabOptions}
                onChange={setGifDefaultTab}
                ariaLabel={t("messagesMediaSettings.defaultGifTab")}
            />
        </div>
    </section>
</div>
