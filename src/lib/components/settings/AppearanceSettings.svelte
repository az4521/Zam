<script lang="ts">
    import { LOCALES, getLocale, setLocale, t, type Locale } from "$lib/i18n";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import ThemeColorEditor from "$lib/components/settings/ThemeColorEditor.svelte";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import {
        setRightAlignOwnBubbles,
        setShowNameColours,
        setTimeClock,
        setDateStyle,
        setCustomDatePattern,
        setAlwaysAbsolute,
        setReduceMotion,
        setKeepSidebarOpen,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import {
        previewDatePattern,
        type TimeClock,
        type DateStyle,
    } from "$lib/utils/timeFormat";

    const timeOptions: Array<{ value: TimeClock; label: string }> = [
        { value: "12h", label: t("appearanceSettings.12Hour") },
        { value: "24h", label: t("appearanceSettings.24Hour") },
    ];
    const dateOptions: Array<{ value: DateStyle; label: string }> = [
        { value: "default", label: t("common.default") },
        { value: "iso", label: "ISO" },
        { value: "dmy", label: "D/M/Y" },
        { value: "mdy", label: "M/D/Y" },
        { value: "custom", label: t("appearanceSettings.custom") },
    ];

    let customDraft = $state(settingsState.customDatePattern);
    const customPreview = $derived(previewDatePattern(customDraft));
    function onCustomInput(
        e: Event & { currentTarget: HTMLInputElement },
    ): void {
        customDraft = e.currentTarget.value;
        // Only persist patterns date-fns accepts, so a mid-typing invalid
        // pattern never blanks every timestamp in the app.
        if (previewDatePattern(customDraft) !== null)
            setCustomDatePattern(customDraft);
    }

    const currentLocale = getLocale();

    function onLocaleChange(e: Event & { currentTarget: HTMLSelectElement }) {
        setLocale(e.currentTarget.value as Locale);
    }
</script>

<div class="space-y-6">
    <section data-setting-anchor="appearance-language">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("appearanceSettings.language")}
        </p>
        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <div class="min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("appearanceSettings.displayLanguage")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("appearanceSettings.displayLanguageHint")}
                </p>
            </div>
            <select
                class="bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-2 py-1.5 border border-discord-divider focus:outline-none focus:ring-2 focus:ring-discord-accent sm:max-w-[16rem]"
                value={currentLocale}
                onchange={onLocaleChange}
                aria-label={t("appearanceSettings.displayLanguage")}
            >
                {#each LOCALES as l (l.code)}
                    <!-- Each language names itself (in its own script and
                         direction), with the English name for everyone else. -->
                    <option value={l.code}>
                        {l.nativeName === l.englishName
                            ? l.nativeName
                            : `${l.nativeName} (${l.englishName})`}
                    </option>
                {/each}
            </select>
        </div>
    </section>
    <section data-setting-anchor="appearance-layout">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("appearanceSettings.layout")}
        </p>
        <div
            data-setting-anchor="theme-rightalign"
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("appearanceSettings.rightAlignMyMessagesBubbleLayout")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("appearanceSettings.displayYourOwnMessagesOnThe")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.rightAlignOwnBubbles}
                onChange={setRightAlignOwnBubbles}
                label={t("appearanceSettings.rightAlignMyMessagesBubbleLayout")}
            />
        </div>
        <div
            data-setting-anchor="appearance-namecolours"
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("appearanceSettings.showNameColours")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("appearanceSettings.drawPeopleSNamesInThe")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.showNameColours}
                onChange={setShowNameColours}
                label={t("appearanceSettings.showNameColours")}
            />
        </div>
        <div
            data-setting-anchor="appearance-keepsidebar"
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("appearanceSettings.keepRoomListOpen")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("appearanceSettings.donTAutoCloseTheRoom")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.keepSidebarOpen}
                onChange={setKeepSidebarOpen}
                label={t("appearanceSettings.keepRoomListOpen")}
            />
        </div>
    </section>
    <ThemeColorEditor />

    <section data-setting-anchor="cust-timestamps">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            {t("appearanceSettings.timestamps")}
        </p>

        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <span class="text-sm text-discord-textPrimary"
                >{t("appearanceSettings.timeFormat")}</span
            >
            <OptionSelector
                value={settingsState.timeClock}
                options={timeOptions}
                onChange={setTimeClock}
                ariaLabel={t("appearanceSettings.timeFormat")}
            />
        </div>

        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <span class="text-sm text-discord-textPrimary"
                >{t("appearanceSettings.dateFormat")}</span
            >
            <OptionSelector
                value={settingsState.dateStyle}
                options={dateOptions}
                onChange={setDateStyle}
                ariaLabel={t("appearanceSettings.dateFormat")}
            />
        </div>

        {#if settingsState.dateStyle === "custom"}
            <div class="py-3 border-b border-discord-divider">
                <label
                    class="text-sm text-discord-textPrimary"
                    for="custom-date-pattern"
                    >{t("appearanceSettings.customDatePattern")}</label
                >
                <input
                    id="custom-date-pattern"
                    type="text"
                    value={customDraft}
                    oninput={onCustomInput}
                    spellcheck="false"
                    autocomplete="off"
                    autocapitalize="off"
                    placeholder={t("appearanceSettings.yyyyMmDd")}
                    class="mt-2 w-full px-2.5 py-1.5 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary border {customPreview ===
                    null
                        ? 'border-discord-danger'
                        : 'border-discord-divider focus:border-discord-accent'} outline-none"
                />
                {#if customPreview !== null}
                    <p class="mt-1.5 text-xs text-discord-textMuted">
                        {t("appearanceSettings.preview")}
                        <span class="text-discord-textPrimary"
                            >{customPreview}</span
                        >
                        {t("appearanceSettings.dateFnsTokensEGYyyy")}
                    </p>
                {:else}
                    <p class="mt-1.5 text-xs text-discord-danger">
                        {t(
                            "appearanceSettings.invalidFormatUseLowercaseDateFns",
                        )}
                    </p>
                {/if}
            </div>
        {/if}

        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("appearanceSettings.alwaysShowAbsoluteDates")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("appearanceSettings.replaceTodayAndYesterdayWithThe")}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.alwaysAbsolute}
                onChange={setAlwaysAbsolute}
                label={t("appearanceSettings.alwaysShowAbsoluteDates")}
            />
        </div>
    </section>

    <section data-setting-anchor="appearance-reducemotion">
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("appearanceSettings.reduceMotion")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t(
                        "appearanceSettings.minimizeAnimationsAndTransitionsYourDevice",
                    )}
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.reduceMotion}
                onChange={setReduceMotion}
                label={t("appearanceSettings.reduceMotion")}
            />
        </div>
    </section>
</div>
