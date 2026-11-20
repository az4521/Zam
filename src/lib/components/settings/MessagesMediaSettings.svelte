<script lang="ts">
    import { t } from "$lib/i18n";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        setShowMatrixIds,
        setShowReadReceiptAvatars,
        setHoldToOpenMessageMenu,
        setSpellCheckEnabled,
        setLinkPreviewsEnabled,
        setPauseVideoOnScrollOff,
        setFaststartVideos,
        setProgressiveJpegs,
        setStripMetadata,
        setRandomizeFileNames,
        setGifsAsWebp,
        setHideRecentEmoji,
        setLightboxFitToScreen,
        setReplyPingDefault,
        setGifDefaultTab,
        setMidiSoundBank,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import { type GifTab } from "$lib/utils/klipy";
    import type { MidiSoundBankChoice } from "$lib/utils/midiSoundBankChoice";
    import {
        canUseSystemSoundBank,
        hasSystemSoundBank,
        resetSoundBank,
    } from "$lib/utils/midiSoundBank";
    import {
        CUSTOM_SOUND_BANK_ACCEPT,
        deleteStoredSoundBank,
        getStoredSoundBankInfo,
        isRiff,
        putStoredSoundBank,
        validateCustomSoundBankFile,
    } from "$lib/utils/customSoundBank";
    import { formatMediaSize } from "$lib/utils/roomMedia";
    import {
        importFavouriteGifs,
        setFavouritesEncrypted,
    } from "$lib/stores/favourites.svelte";
    import { privateModeState } from "$lib/matrix/privateAccountData.svelte";
    import { Loader2 } from "lucide-svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import {
        fetchLinkPreview,
        isGifSiteUrl,
    } from "$lib/utils/linkPreviewFetch";
    import {
        discordItemToFavourite,
        discordItemsToFavourites,
        mapWithLimit,
        usableDiscordItems,
        type DiscordFavouriteItem,
    } from "$lib/utils/discordFavourites";
    import { allowsThirdPartyEmbed } from "$lib/utils/linkPreviewPolicy";

    const gifTabOptions: Array<{ value: GifTab; label: string }> = [
        { value: "gifs", label: "GIFs" },
        { value: "favourites", label: t("messagesMediaSettings.favourites") },
    ];

    // Only the desktop app can read the OS's bank; elsewhere the "System"
    // option isn't offered at all. null until checked.
    const systemBankSupported = canUseSystemSoundBank();
    let systemBankAvailable = $state<boolean | null>(
        systemBankSupported ? null : false,
    );
    let customBank = $state<{ name: string; size: number } | null>(null);
    let customBankLoaded = $state(false);
    let bankFileInput = $state<HTMLInputElement | null>(null);
    let bankUploadBusy = $state(false);
    let bankUploadError = $state<string | null>(null);

    // Discord favourites import: only where the desktop app provides the bridge.
    const discordImportAvailable =
        typeof window !== "undefined" && !!window.desktop?.discordFavourites;
    let discordBusy = $state(false);

    // Encrypted favourites are account state, shown live from the server. Turning
    // them off is two-step: the list becomes readable by the homeserver again.
    let confirmingEncryptionOff = $state(false);
    const encryptedOn = $derived(privateModeState.mode === "encrypted");
    const encryptionBusy = $derived(
        privateModeState.switching || privateModeState.mode === "unknown",
    );
    async function setEncryption(enable: boolean) {
        confirmingEncryptionOff = false;
        await setFavouritesEncrypted(enable);
    }
    function onEncryptionToggle(checked: boolean) {
        if (checked) void setEncryption(true);
        else confirmingEncryptionOff = true;
    }
    let discordProgress = $state<{ done: number; total: number } | null>(null);
    let discordOutcome = $state<string | null>(null);
    let discordMounted = true;
    $effect(() => () => {
        discordMounted = false;
    });

    // Checks each Discord link the way the chat previews it, then imports the
    // ones with media. The UI writes are skipped once the row is gone.
    async function importDiscordFavourites() {
        const bridge = window.desktop?.discordFavourites;
        if (!bridge || discordBusy) return;
        discordBusy = true;
        discordOutcome = null;
        discordProgress = null;
        const setOutcome = (msg: string) => {
            if (discordMounted) discordOutcome = msg;
        };
        try {
            const result = await bridge.read();
            if (!result.found) {
                setOutcome(t("messagesMediaSettings.discordImportNotFound"));
                return;
            }
            const items: DiscordFavouriteItem[] = usableDiscordItems(
                result.items,
            );
            const total = items.length;
            const allowEmbeds = allowsThirdPartyEmbed(
                settingsState.linkPreviewMedia,
            );
            if (discordMounted) discordProgress = { done: 0, total };
            let done = 0;
            const built = await mapWithLimit(
                items,
                4,
                async (item) => {
                    try {
                        const { preview } = await fetchLinkPreview(
                            item.url,
                            allowEmbeds,
                        );
                        return discordItemToFavourite(
                            item,
                            preview,
                            isGifSiteUrl(item.url),
                        );
                    } catch {
                        return null;
                    }
                },
                () => {
                    done++;
                    if (discordMounted) discordProgress = { done, total };
                },
            );
            const entries = built.filter(
                (e): e is NonNullable<typeof e> => e !== null,
            );
            const broken =
                result.invalid +
                (result.items.length - items.length) +
                (total - entries.length);
            const favourites = discordItemsToFavourites(entries, Date.now());
            if (favourites.length === 0) {
                setOutcome(
                    t("messagesMediaSettings.discordImportNoneImportable"),
                );
                return;
            }
            const added = await importFavouriteGifs(favourites);
            if (added === 0) {
                setOutcome(
                    t("messagesMediaSettings.discordImportAllPresent", {
                        count: favourites.length,
                    }),
                );
                return;
            }
            let msg = t("messagesMediaSettings.discordImportSuccess", {
                added,
            });
            if (result.skippedDiscord + broken > 0)
                msg +=
                    " " +
                    t("messagesMediaSettings.discordImportSkipped", {
                        discord: result.skippedDiscord,
                        broken,
                    });
            setOutcome(msg);
        } catch (err) {
            console.error("Discord favourites import failed:", err);
            showErrorToast(t("messagesMediaSettings.discordImportFailed"));
        } finally {
            if (discordMounted) {
                discordBusy = false;
                discordProgress = null;
            }
        }
    }

    $effect(() => {
        if (systemBankSupported)
            void hasSystemSoundBank().then(
                (has) => (systemBankAvailable = has),
            );
        void getStoredSoundBankInfo().then((info) => {
            customBank = info;
            customBankLoaded = true;
        });
    });

    // What actually plays: a choice that can't be met falls back to the
    // bundled bank, as utils/midiSoundBank does.
    const effectiveSoundBank = $derived.by((): MidiSoundBankChoice => {
        const choice = settingsState.midiSoundBank;
        if (choice === "system" && systemBankAvailable === false)
            return "bundled";
        if (choice === "custom" && customBankLoaded && !customBank)
            return "bundled";
        return choice;
    });

    const soundBankOptions = $derived<
        Array<{
            value: MidiSoundBankChoice;
            label: string;
            title?: string;
            disabled?: boolean;
        }>
    >([
        ...(systemBankSupported
            ? [
                  {
                      value: "system" as const,
                      label: t("midiSoundBank.system"),
                      title:
                          systemBankAvailable === false
                              ? t("midiSoundBank.noSystemSoundBankFound")
                              : undefined,
                      disabled: systemBankAvailable === false,
                  },
              ]
            : []),
        { value: "bundled", label: t("midiSoundBank.included") },
        { value: "custom", label: t("midiSoundBank.custom") },
    ]);

    function chooseSoundBank(value: MidiSoundBankChoice) {
        bankUploadError = null;
        // No custom bank yet: pick one first; it's selected once stored.
        if (value === "custom" && !customBank) {
            bankFileInput?.click();
            return;
        }
        setMidiSoundBank(value);
    }

    async function handleBankFile(e: Event) {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = ""; // allow re-selecting the same filename later
        if (!file) return;
        bankUploadError = null;
        const v = validateCustomSoundBankFile(file);
        if (!v.ok) {
            bankUploadError = v.reason;
            return;
        }
        bankUploadBusy = true;
        try {
            const data = await file.arrayBuffer();
            if (!isRiff(data)) {
                bankUploadError = t("midiSoundBank.notASoundBank");
                return;
            }
            const stored = await putStoredSoundBank({
                name: file.name,
                size: file.size,
                data,
                storedAt: Date.now(),
            });
            if (!stored) {
                bankUploadError = t("midiSoundBank.couldNotSave");
                return;
            }
            customBank = { name: file.name, size: file.size };
            resetSoundBank();
            setMidiSoundBank("custom");
        } catch {
            bankUploadError = t("midiSoundBank.couldNotSave");
        } finally {
            bankUploadBusy = false;
        }
    }

    async function removeCustomBank() {
        bankUploadBusy = true;
        bankUploadError = null;
        await deleteStoredSoundBank();
        customBank = null;
        resetSoundBank();
        if (settingsState.midiSoundBank === "custom")
            setMidiSoundBank("bundled");
        bankUploadBusy = false;
    }
</script>

<div class="space-y-6">
    <section data-setting-anchor="cust-messages">
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-3"
        >
            {t("messagesMediaSettings.messages")}
        </p>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.showMatrixIds")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.showFullMatrixIdsLikeUser")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showMatrixIds}
                onChange={setShowMatrixIds}
                label={t("messagesMediaSettings.showMatrixIds")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.readReceiptAvatars")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.showWhoHasReadEachMessage")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showReadReceiptAvatars}
                onChange={setShowReadReceiptAvatars}
                label={t("messagesMediaSettings.readReceiptAvatars")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.pingOnReply")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.pingOnReplyDescription")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.replyPingDefault}
                onChange={setReplyPingDefault}
                label={t("messagesMediaSettings.pingOnReply")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.holdToOpenMessageMenu")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.onTouchDevicesOpenAMessage")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.holdToOpenMessageMenu}
                onChange={setHoldToOpenMessageMenu}
                label={t("messagesMediaSettings.holdToOpenMessageMenu")}
            />
        </div>
        <div class="flex items-center gap-3 py-2 border-b border-zam-divider">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.checkSpelling")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.underlineMisspelledWordsAnd")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.spellCheckEnabled}
                onChange={setSpellCheckEnabled}
                label={t("messagesMediaSettings.checkSpelling")}
            />
        </div>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-zam-textPrimary"
                    >{t("messagesMediaSettings.linkPreviews")}</span
                >
                <p class="text-xs text-zam-textMuted">
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
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.pauseVideosOffScreen")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.pauseAPlayingVideoWhenIt")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.pauseVideoOnScrollOff}
                onChange={setPauseVideoOnScrollOff}
                label={t("messagesMediaSettings.pauseVideosOffScreen")}
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.fitImagesToScreen")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.fitImagesToScreenDescription")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.lightboxFitToScreen}
                onChange={setLightboxFitToScreen}
                label={t("messagesMediaSettings.fitImagesToScreen")}
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.sendVideosThatStreamFaster")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.rearrangeMp4VideosYouSend")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.faststartVideos}
                onChange={setFaststartVideos}
                label={t("messagesMediaSettings.sendVideosThatStreamFaster")}
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.sendPhotosThatAppearSooner")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.rewriteJpegPhotosYouSend")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.progressiveJpegs}
                onChange={setProgressiveJpegs}
                label={t("messagesMediaSettings.sendPhotosThatAppearSooner")}
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.removeLocationAndMetadata")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.stripMetadataDescription")}
                </p>
                <p class="mt-1 text-xs font-semibold text-zam-danger">
                    {t("messagesMediaSettings.stripMetadataWarning")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.stripMetadata}
                onChange={setStripMetadata}
                label={t("messagesMediaSettings.removeLocationAndMetadata")}
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.randomizeFileNames")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.randomizeFileNamesDescription")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.randomizeFileNames}
                onChange={setRandomizeFileNames}
                label={t("messagesMediaSettings.randomizeFileNames")}
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.sendGifsAsAnimatedWebp")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.reencodeGifsYouSend")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.gifsAsWebp}
                onChange={setGifsAsWebp}
                label={t("messagesMediaSettings.sendGifsAsAnimatedWebp")}
            />
        </div>
        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-zam-textPrimary">
                    {t("messagesMediaSettings.hideRecentEmoji")}
                </p>
                <p class="text-xs text-zam-textMuted">
                    {t("messagesMediaSettings.hideRecentEmojiDescription")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.hideRecentEmoji}
                onChange={setHideRecentEmoji}
                label={t("messagesMediaSettings.hideRecentEmoji")}
            />
        </div>
    </section>

    <section data-setting-anchor="cust-gifs">
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-3"
        >
            {t("common.gifs")}
        </p>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-zam-textPrimary"
                    >{t("messagesMediaSettings.defaultTab")}</span
                >
                <p class="text-xs text-zam-textMuted">
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
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-zam-textPrimary"
                    >{t("privateData.toggleLabel")}</span
                >
                <p class="text-xs text-zam-textMuted">
                    {t("privateData.toggleHelp")}
                </p>
                {#if confirmingEncryptionOff}
                    <p class="text-xs text-zam-textPrimary mt-1" role="alert">
                        {t("privateData.offWarning")}
                    </p>
                {/if}
            </div>
            {#if confirmingEncryptionOff}
                <div class="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded bg-zam-backgroundSecondary text-sm text-zam-textPrimary hover:bg-zam-messageHover transition-colors"
                        onclick={() => (confirmingEncryptionOff = false)}
                        >{t("common.cancel")}</button
                    >
                    <button
                        type="button"
                        class="px-3 py-1.5 rounded bg-zam-backgroundSecondary text-sm text-zam-textPrimary hover:bg-zam-messageHover disabled:opacity-50 transition-colors"
                        onclick={() => setEncryption(false)}
                        disabled={encryptionBusy}
                        >{t("privateData.turnOff")}</button
                    >
                </div>
            {:else}
                <div class="flex items-center gap-2 shrink-0">
                    {#if encryptionBusy}
                        <Loader2
                            size={16}
                            class="animate-spin text-zam-accent"
                        />
                    {/if}
                    <div
                        class:opacity-50={encryptionBusy}
                        class:pointer-events-none={encryptionBusy}
                        aria-disabled={encryptionBusy}
                    >
                        <ToggleSwitch
                            checked={encryptedOn}
                            onChange={onEncryptionToggle}
                            label={t("privateData.toggleLabel")}
                        />
                    </div>
                </div>
            {/if}
        </div>
        {#if discordImportAvailable}
            <div
                class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
                <div class="flex-1 min-w-0">
                    <span class="text-sm text-zam-textPrimary"
                        >{t("messagesMediaSettings.discordImportTitle")}</span
                    >
                    <p class="text-xs text-zam-textMuted">
                        {t("messagesMediaSettings.discordImportDescription")}
                    </p>
                    {#if discordBusy && discordProgress}
                        <p
                            class="text-xs text-zam-textMuted"
                            aria-live="polite"
                        >
                            {t("messagesMediaSettings.discordImportChecking", {
                                done: discordProgress.done,
                                total: discordProgress.total,
                            })}
                        </p>
                    {:else if discordOutcome}
                        <p
                            class="text-xs text-zam-textMuted"
                            aria-live="polite"
                        >
                            {discordOutcome}
                        </p>
                    {/if}
                </div>
                <button
                    type="button"
                    class="px-3 py-1.5 rounded bg-zam-backgroundSecondary text-sm text-zam-textPrimary hover:bg-zam-messageHover disabled:opacity-50 transition-colors"
                    onclick={importDiscordFavourites}
                    disabled={discordBusy}
                >
                    {discordBusy
                        ? t("messagesMediaSettings.discordImportBusy")
                        : t("messagesMediaSettings.discordImportButton")}
                </button>
            </div>
        {/if}
    </section>

    <section data-setting-anchor="cust-midi">
        <p
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-3"
        >
            {t("midiSoundBank.midi")}
        </p>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-zam-textPrimary"
                    >{t("midiSoundBank.soundBank")}</span
                >
                <p class="text-xs text-zam-textMuted">
                    {t("midiSoundBank.theInstrumentSoundsUsedTo")}
                </p>
            </div>
            <OptionSelector
                value={effectiveSoundBank}
                options={soundBankOptions}
                onChange={chooseSoundBank}
                ariaLabel={t("midiSoundBank.soundBank")}
            />
        </div>
        {#if systemBankSupported && systemBankAvailable === false}
            <p class="text-xs text-zam-textMuted">
                {t("midiSoundBank.noSystemSoundBankFound")}
            </p>
        {/if}
        <input
            bind:this={bankFileInput}
            type="file"
            accept={CUSTOM_SOUND_BANK_ACCEPT}
            class="hidden"
            onchange={handleBankFile}
        />
        {#if customBank || effectiveSoundBank === "custom"}
            <div class="mt-2 flex flex-wrap items-center gap-2">
                {#if customBank}
                    <span
                        class="min-w-0 truncate text-sm text-zam-textPrimary"
                        title={customBank.name}
                    >
                        {customBank.name}
                        <span class="text-xs text-zam-textMuted"
                            >({formatMediaSize(customBank.size)})</span
                        >
                    </span>
                {/if}
                <button
                    type="button"
                    class="px-3 py-1.5 rounded bg-zam-backgroundSecondary text-sm text-zam-textPrimary hover:bg-zam-messageHover disabled:opacity-50 transition-colors"
                    onclick={() => bankFileInput?.click()}
                    disabled={bankUploadBusy}
                >
                    {customBank
                        ? t("midiSoundBank.chooseAnotherFile")
                        : t("midiSoundBank.chooseFile")}
                </button>
                {#if customBank}
                    <button
                        type="button"
                        class="px-2 py-1 rounded text-xs text-zam-danger hover:bg-zam-danger hover:text-white disabled:opacity-50 transition-colors"
                        onclick={removeCustomBank}
                        disabled={bankUploadBusy}
                    >
                        {t("common.remove")}
                    </button>
                {/if}
            </div>
        {/if}
        {#if bankUploadBusy}
            <p class="mt-1 text-xs text-zam-textMuted">
                {t("midiSoundBank.saving")}
            </p>
        {/if}
        {#if bankUploadError}
            <p class="mt-1 text-xs text-zam-danger">{bankUploadError}</p>
        {/if}
        <p class="mt-1 text-xs text-zam-textMuted">
            {t("midiSoundBank.sf2Sf3OrDlsUpTo")}
        </p>
    </section>
</div>
