<script lang="ts">
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import ThemeColorEditor from "$lib/components/settings/ThemeColorEditor.svelte";
    import OptionSelector from "$lib/components/ui/OptionSelector.svelte";
    import {
        setRightAlignOwnBubbles,
        setTimeClock,
        setDateStyle,
        setCustomDatePattern,
        setAlwaysAbsolute,
        setReduceMotion,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import {
        previewDatePattern,
        type TimeClock,
        type DateStyle,
    } from "$lib/utils/timeFormat";

    const timeOptions: Array<{ value: TimeClock; label: string }> = [
        { value: "12h", label: "12-hour" },
        { value: "24h", label: "24-hour" },
    ];
    const dateOptions: Array<{ value: DateStyle; label: string }> = [
        { value: "default", label: "Default" },
        { value: "iso", label: "ISO" },
        { value: "dmy", label: "D/M/Y" },
        { value: "mdy", label: "M/D/Y" },
        { value: "custom", label: "Custom" },
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
</script>

<div class="space-y-6">
    <div
        data-setting-anchor="theme-rightalign"
        class="flex items-center gap-3 py-2 border-b border-discord-divider"
    >
        <div class="flex-1 min-w-0">
            <p class="text-sm text-discord-textPrimary">
                Right-align my messages (bubble layout)
            </p>
            <p class="text-xs text-discord-textMuted">
                Display your own messages on the right in a colored bubble
            </p>
        </div>
        <ToggleSwitch
            checked={settingsState.rightAlignOwnBubbles}
            onChange={setRightAlignOwnBubbles}
            label="Right-align my messages (bubble layout)"
        />
    </div>
    <ThemeColorEditor />

    <section data-setting-anchor="cust-timestamps">
        <p
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-3"
        >
            Timestamps
        </p>

        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <span class="text-sm text-discord-textPrimary">Time format</span>
            <OptionSelector
                value={settingsState.timeClock}
                options={timeOptions}
                onChange={setTimeClock}
                ariaLabel="Time format"
            />
        </div>

        <div
            class="flex flex-col gap-2 py-2 border-b border-discord-divider sm:flex-row sm:items-center sm:justify-between"
        >
            <span class="text-sm text-discord-textPrimary">Date format</span>
            <OptionSelector
                value={settingsState.dateStyle}
                options={dateOptions}
                onChange={setDateStyle}
                ariaLabel="Date format"
            />
        </div>

        {#if settingsState.dateStyle === "custom"}
            <div class="py-3 border-b border-discord-divider">
                <label
                    class="text-sm text-discord-textPrimary"
                    for="custom-date-pattern">Custom date pattern</label
                >
                <input
                    id="custom-date-pattern"
                    type="text"
                    value={customDraft}
                    oninput={onCustomInput}
                    spellcheck="false"
                    autocomplete="off"
                    autocapitalize="off"
                    placeholder="yyyy-MM-dd"
                    class="mt-2 w-full px-2.5 py-1.5 rounded bg-discord-backgroundTertiary text-sm text-discord-textPrimary border {customPreview ===
                    null
                        ? 'border-discord-danger'
                        : 'border-discord-divider focus:border-discord-accent'} outline-none"
                />
                {#if customPreview !== null}
                    <p class="mt-1.5 text-xs text-discord-textMuted">
                        Preview: <span class="text-discord-textPrimary"
                            >{customPreview}</span
                        > · date-fns tokens, e.g. yyyy-MM-dd
                    </p>
                {:else}
                    <p class="mt-1.5 text-xs text-discord-danger">
                        Invalid format - use lowercase date-fns tokens like
                        yyyy-MM-dd.
                    </p>
                {/if}
            </div>
        {/if}

        <div class="flex items-center gap-3 py-2">
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    Always show absolute dates
                </p>
                <p class="text-xs text-discord-textMuted">
                    Replace "Today" and "Yesterday" with the full date
                    everywhere.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.alwaysAbsolute}
                onChange={setAlwaysAbsolute}
                label="Always show absolute dates"
            />
        </div>
    </section>

    <section data-setting-anchor="appearance-reducemotion">
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">Reduce motion</p>
                <p class="text-xs text-discord-textMuted">
                    Minimize animations and transitions. Your device's system
                    "reduce motion" setting is always respected as well.
                </p>
            </div>
            <ToggleSwitch
                checked={settingsState.reduceMotion}
                onChange={setReduceMotion}
                label="Reduce motion"
            />
        </div>
    </section>
</div>
