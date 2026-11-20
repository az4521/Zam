<script lang="ts">
    import { t } from "$lib/i18n";
    import {
        TIMESTAMP_STYLES,
        buildInlineTimestampToken,
        localDateTimeToUnix,
        unixToLocalDateTimeValue,
        type TimestampStyle,
    } from "$lib/utils/inlineTimestamp";

    interface Props {
        /** Receives the `<t:UNIX:STYLE>` token to insert into the composer. */
        onInsert: (token: string) => void;
        onClose: () => void;
    }
    let { onInsert, onClose }: Props = $props();

    // Default to the current minute, in the viewer's own time zone.
    let value = $state(
        unixToLocalDateTimeValue(Math.floor(Date.now() / 60000) * 60),
    );
    let style = $state<TimestampStyle>("f");
    const seconds = $derived(localDateTimeToUnix(value));

    function styleLabel(s: TimestampStyle): string {
        switch (s) {
            case "t":
                return t("timestampPicker.styleShortTime");
            case "T":
                return t("timestampPicker.styleLongTime");
            case "d":
                return t("timestampPicker.styleShortDate");
            case "D":
                return t("timestampPicker.styleLongDate");
            case "f":
                return t("timestampPicker.styleShortDateTime");
            case "F":
                return t("timestampPicker.styleLongDateTime");
            case "R":
                return t("timestampPicker.styleRelative");
        }
    }

    function insert() {
        if (seconds === null) return;
        onInsert(buildInlineTimestampToken(seconds, style));
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    }
</script>

<div
    role="dialog"
    tabindex="-1"
    aria-label={t("timestampPicker.title")}
    class="w-64 bg-zam-backgroundSecondary border border-zam-divider rounded-lg shadow-lg p-3"
    onkeydown={onKeydown}
>
    <form
        class="flex flex-col gap-2"
        onsubmit={(e) => {
            e.preventDefault();
            insert();
        }}
    >
        <p class="text-sm font-semibold text-zam-textPrimary">
            {t("timestampPicker.title")}
        </p>
        <label class="flex flex-col gap-1 text-xs text-zam-textMuted">
            {t("timestampPicker.dateAndTime")}
            <input
                type="datetime-local"
                bind:value
                class="bg-zam-background border border-zam-divider rounded px-2 py-1 text-sm text-zam-textPrimary"
            />
        </label>
        <label class="flex flex-col gap-1 text-xs text-zam-textMuted">
            {t("timestampPicker.format")}
            <select
                bind:value={style}
                class="bg-zam-background border border-zam-divider rounded px-2 py-1 text-sm text-zam-textPrimary"
            >
                {#each TIMESTAMP_STYLES as s (s)}
                    <option value={s}>{styleLabel(s)}</option>
                {/each}
            </select>
        </label>
        <div class="flex justify-end gap-2 pt-1">
            <button
                type="button"
                onclick={onClose}
                class="px-3 py-1 rounded text-sm text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover"
            >
                {t("timestampPicker.cancel")}
            </button>
            <button
                type="submit"
                disabled={seconds === null}
                class="px-3 py-1 rounded text-sm bg-zam-accent text-white disabled:opacity-40"
            >
                {t("timestampPicker.insert")}
            </button>
        </div>
    </form>
</div>
