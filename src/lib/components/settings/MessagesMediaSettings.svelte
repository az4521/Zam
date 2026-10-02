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
            setMidiSoundBank("system");
        bankUploadBusy = false;
    }
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

    <section data-setting-anchor="cust-midi">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("midiSoundBank.midi")}
        </p>
        <div
            class="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="flex-1 min-w-0">
                <span class="text-sm text-discord-textPrimary"
                    >{t("midiSoundBank.soundBank")}</span
                >
                <p class="text-xs text-discord-textMuted">
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
            <p class="text-xs text-discord-textMuted">
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
                        class="min-w-0 truncate text-sm text-discord-textPrimary"
                        title={customBank.name}
                    >
                        {customBank.name}
                        <span class="text-xs text-discord-textMuted"
                            >({formatMediaSize(customBank.size)})</span
                        >
                    </span>
                {/if}
                <button
                    type="button"
                    class="px-3 py-1.5 rounded bg-discord-backgroundSecondary text-sm text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-50 transition-colors"
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
                        class="px-2 py-1 rounded text-xs text-discord-danger hover:bg-discord-danger hover:text-white disabled:opacity-50 transition-colors"
                        onclick={removeCustomBank}
                        disabled={bankUploadBusy}
                    >
                        {t("common.remove")}
                    </button>
                {/if}
            </div>
        {/if}
        {#if bankUploadBusy}
            <p class="mt-1 text-xs text-discord-textMuted">
                {t("midiSoundBank.saving")}
            </p>
        {/if}
        {#if bankUploadError}
            <p class="mt-1 text-xs text-discord-danger">{bankUploadError}</p>
        {/if}
        <p class="mt-1 text-xs text-discord-textMuted">
            {t("midiSoundBank.sf2Sf3OrDlsUpTo")}
        </p>
    </section>
</div>
