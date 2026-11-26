<script lang="ts">
    import { t } from "$lib/i18n";
    import { Pause, Play, Square, Volume2 } from "lucide-svelte";
    import {
        fileShareState,
        seekFileShare,
        setFileShareMonitorVolume,
        toggleFileSharePlay,
    } from "$lib/stores/fileShare.svelte";
    import { stopFileShare } from "$lib/matrix/client";

    /** m:ss, or h:mm:ss past an hour. */
    function formatTime(seconds: number): string {
        const total =
            Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = String(total % 60).padStart(2, "0");
        if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${s}`;
        return `${m}:${s}`;
    }

    // Space plays and pauses while the bar has focus. Buttons keep their own
    // space (it clicks them). The call's push-to-talk and other key handlers
    // must not see these keys.
    function onKey(e: KeyboardEvent): void {
        if (e.key !== " ") return;
        e.stopPropagation();
        if (e.target instanceof HTMLButtonElement) return;
        e.preventDefault();
        toggleFileSharePlay();
    }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
    role="toolbar"
    tabindex="0"
    aria-label={t("fileShare.controls")}
    class="flex w-full items-center gap-2 rounded bg-black/70 px-2 py-1 text-xs text-white"
    onclick={(e) => e.stopPropagation()}
    onkeydown={onKey}
>
    <button
        type="button"
        onclick={() => toggleFileSharePlay()}
        class="rounded p-1 hover:bg-white/15"
        title={fileShareState.playing
            ? t("fileShare.pause")
            : t("fileShare.play")}
        aria-label={fileShareState.playing
            ? t("fileShare.pause")
            : t("fileShare.play")}
    >
        {#if fileShareState.playing}<Pause size={16} />{:else}<Play
                size={16}
            />{/if}
    </button>
    <span class="whitespace-nowrap tabular-nums">
        {formatTime(fileShareState.currentTime)} / {formatTime(
            fileShareState.duration,
        )}
    </span>
    <input
        type="range"
        class="min-w-12 flex-1 accent-zam-accent"
        min="0"
        max={fileShareState.duration || 0}
        step="0.1"
        value={fileShareState.currentTime}
        oninput={(e) => seekFileShare(Number(e.currentTarget.value))}
        aria-label={t("fileShare.seek")}
        title={t("fileShare.seek")}
    />
    <Volume2 size={14} class="shrink-0" aria-hidden="true" />
    <input
        type="range"
        class="w-14 shrink-0 accent-zam-accent"
        min="0"
        max="100"
        step="1"
        value={Math.round(fileShareState.monitorVolume * 100)}
        oninput={(e) =>
            setFileShareMonitorVolume(Number(e.currentTarget.value) / 100)}
        aria-label={t("fileShare.localVolume")}
        title={t("fileShare.localVolume")}
    />
    <button
        type="button"
        onclick={() => void stopFileShare()}
        class="shrink-0 rounded p-1 hover:bg-white/15"
        title={t("common.stopSharing")}
        aria-label={t("common.stopSharing")}
    >
        <Square size={14} />
    </button>
</div>
