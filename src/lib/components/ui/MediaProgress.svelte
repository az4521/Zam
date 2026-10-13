<script lang="ts">
    import { t } from "$lib/i18n";
    import type { DownloadProgress } from "$lib/utils/downloadProgress";

    interface Props {
        /** What is being fetched, e.g. "Decrypting image...". */
        label: string;
        /** Latest byte counts, or null before the first report. */
        progress?: DownloadProgress | null;
    }
    let { label, progress = null }: Props = $props();

    const fraction = $derived(
        progress && progress.total
            ? Math.min(1, progress.loaded / progress.total)
            : null,
    );

    function size(bytes: number): string {
        return bytes < 1024 * 1024
            ? t("messageItem.kb", {
                  toFixed: Math.max(1, Math.round(bytes / 1024)).toString(),
              })
            : t("messageItem.mb", {
                  toFixed: (bytes / (1024 * 1024)).toFixed(1),
              });
    }

    const detail = $derived.by(() => {
        if (!progress || progress.loaded <= 0) return null;
        return progress.total
            ? t("mediaProgress.ofTotal", {
                  loaded: size(progress.loaded),
                  total: size(progress.total),
              })
            : size(progress.loaded);
    });
</script>

<div
    class="flex items-center gap-2 p-3 bg-discord-backgroundSecondary rounded-lg mt-1 max-w-sm w-full"
>
    <div
        class="w-4 h-4 border-2 border-discord-accent border-t-transparent rounded-full animate-spin flex-shrink-0"
    ></div>
    <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-2">
            <span class="text-xs text-discord-textMuted truncate">{label}</span>
            {#if detail}
                <span
                    class="text-[11px] text-discord-textMuted tabular-nums flex-shrink-0"
                    >{detail}</span
                >
            {/if}
        </div>
        {#if fraction !== null}
            <div
                class="mt-1.5 h-1 rounded-full bg-discord-backgroundTertiary overflow-hidden"
                role="progressbar"
                aria-label={label}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(fraction * 100)}
            >
                <div
                    class="h-full bg-discord-accent transition-[width] duration-150"
                    style="width: {Math.round(fraction * 100)}%"
                ></div>
            </div>
        {/if}
    </div>
</div>
