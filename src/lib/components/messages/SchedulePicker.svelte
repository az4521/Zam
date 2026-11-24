<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        fromDateTimeLocal,
        schedulePresets,
        toDateTimeLocal,
    } from "$lib/utils/scheduledMessages";
    import { compactDateTime } from "$lib/utils/timeFormat";

    interface Props {
        /** Receives the chosen send time (ms since epoch). */
        onPick: (at: number) => void;
        onClose: () => void;
    }
    let { onPick, onClose }: Props = $props();

    const presets = schedulePresets(new Date());
    const minValue = toDateTimeLocal(Date.now());
    // Default to one hour from now, in the viewer's own time zone.
    let value = $state(toDateTimeLocal(Date.now() + 60 * 60 * 1000));
    const customAt = $derived(fromDateTimeLocal(value));
    const customValid = $derived(customAt !== null && customAt > Date.now());

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    }

    function pickCustom() {
        if (customAt !== null && customValid) onPick(customAt);
    }
</script>

<div
    role="dialog"
    tabindex="-1"
    aria-label={t("schedulePicker.title")}
    class="w-64 bg-zam-backgroundSecondary border border-zam-divider rounded-lg shadow-lg py-1"
    onkeydown={onKeydown}
>
    <p class="px-3 pt-2 pb-1 text-sm font-semibold text-zam-textPrimary">
        {t("schedulePicker.title")}
    </p>
    {#each presets as preset (preset.key)}
        <button
            type="button"
            onclick={() => onPick(preset.at)}
            class="w-full flex items-center justify-between gap-3 px-3 py-2 text-start text-sm text-zam-textPrimary hover:bg-zam-messageHover transition-colors"
        >
            <span>{t(`schedulePicker.${preset.key}`)}</span>
            <span class="text-xs text-zam-textMuted flex-shrink-0"
                >{compactDateTime(preset.at)}</span
            >
        </button>
    {/each}
    <div
        class="border-t border-zam-divider mt-1 pt-2 px-3 pb-2 flex flex-col gap-2"
    >
        <label class="flex flex-col gap-1 text-xs text-zam-textMuted">
            {t("schedulePicker.customTime")}
            <input
                type="datetime-local"
                min={minValue}
                bind:value
                class="bg-zam-background border border-zam-divider rounded px-2 py-1 text-sm text-zam-textPrimary"
            />
        </label>
        <button
            type="button"
            onclick={pickCustom}
            disabled={!customValid}
            class="self-end px-3 py-1 rounded text-sm font-semibold text-zam-accent hover:bg-zam-messageHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
            {t("schedulePicker.setTime")}
        </button>
    </div>
</div>
