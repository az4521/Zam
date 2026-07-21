<script lang="ts">
    import { onDestroy, tick } from "svelte";
    import { fetchAttachmentBlob, mxcToHttp } from "$lib/matrix/client";
    import { formatCallDuration } from "$lib/utils/callDuration";

    interface Props {
        /** mxc:// url of the audio. */
        mxcUrl: string;
        /** Stored amplitude bars (0..1024). */
        waveform: number[];
        /** Stored clip length in ms (fallback when media metadata is unusable). */
        durationMs: number;
    }
    let { mxcUrl, waveform, durationMs }: Props = $props();

    let audioEl = $state<HTMLAudioElement>();
    let blobUrl = $state<string | null>(null);
    let loading = $state(false);
    let playing = $state(false);
    let currentMs = $state(0);
    let mediaDurationMs = $state(0);

    // Prefer the media's real duration once known — but MediaRecorder webm blobs
    // often report Infinity/NaN until fully buffered, so fall back to the
    // sender's stored value.
    const totalMs = $derived(
        mediaDurationMs > 0 ? mediaDurationMs : durationMs,
    );
    const progress = $derived(
        totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0,
    );
    // Count up while active, show the full length at rest.
    const timeLabel = $derived(
        formatCallDuration(playing || currentMs > 0 ? currentMs : totalMs),
    );

    async function ensureLoaded(): Promise<boolean> {
        if (blobUrl) return true;
        const http = mxcToHttp(mxcUrl);
        if (!http) return false;
        loading = true;
        try {
            blobUrl = await fetchAttachmentBlob(http);
            await tick(); // let the <audio> mount + bind before we play/seek
            return true;
        } catch {
            return false;
        } finally {
            loading = false;
        }
    }

    async function toggle() {
        if (playing) {
            audioEl?.pause();
            return;
        }
        if (!(await ensureLoaded())) return;
        if (audioEl && currentMs > 0) audioEl.currentTime = currentMs / 1000; // resume from a pre-seek
        await audioEl?.play().catch(() => {});
    }

    function seekFromEvent(e: MouseEvent, el: HTMLElement) {
        if (totalMs <= 0) return;
        const rect = el.getBoundingClientRect();
        const frac = Math.min(
            1,
            Math.max(0, (e.clientX - rect.left) / rect.width),
        );
        currentMs = frac * totalMs;
        if (audioEl && blobUrl) audioEl.currentTime = currentMs / 1000;
    }

    onDestroy(() => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
    });
</script>

<div
    class="flex items-center gap-3 p-3 bg-discord-backgroundTertiary rounded-lg mt-1 max-w-sm w-full"
>
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <button
        onclick={toggle}
        disabled={loading}
        class="w-8 h-8 rounded-full bg-discord-accent flex-shrink-0 flex items-center justify-center disabled:opacity-50"
    >
        {#if loading}
            <div
                class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
            ></div>
        {:else if playing}
            <svg
                class="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg
            >
        {:else}
            <svg
                class="w-4 h-4 text-white ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg
            >
        {/if}
    </button>

    <div class="flex-1 min-w-0">
        {#if waveform.length > 0}
            <div
                role="slider"
                tabindex="0"
                aria-label="Seek"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round(progress * 100)}
                class="flex items-center gap-[2px] h-6 min-w-0 overflow-hidden cursor-pointer"
                onclick={(e) => seekFromEvent(e, e.currentTarget)}
                onkeydown={(e) => {
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                        e.preventDefault();
                        const delta =
                            (e.key === "ArrowRight" ? 0.05 : -0.05) * totalMs;
                        currentMs = Math.min(
                            totalMs,
                            Math.max(0, currentMs + delta),
                        );
                        if (audioEl && blobUrl)
                            audioEl.currentTime = currentMs / 1000;
                    }
                }}
            >
                {#each waveform as bar, i}
                    {@const played = (i + 0.5) / waveform.length <= progress}
                    <div
                        class="flex-1 min-w-[2px] rounded-full {played
                            ? 'bg-discord-accent'
                            : 'bg-discord-textMuted'}"
                        style="height: {Math.max(8, (bar / 1024) * 100)}%"
                    ></div>
                {/each}
            </div>
        {:else}
            <p class="text-discord-textPrimary text-xs font-medium truncate">
                Voice message
            </p>
        {/if}
    </div>

    <span
        class="text-discord-textMuted text-xs tabular-nums flex-shrink-0 w-9 text-right"
    >
        {timeLabel}
    </span>

    {#if blobUrl}
        <!-- svelte-ignore a11y_media_has_caption -->
        <audio
            bind:this={audioEl}
            src={blobUrl}
            class="hidden"
            onplay={() => (playing = true)}
            onpause={() => (playing = false)}
            onended={() => {
                playing = false;
                currentMs = 0;
            }}
            ontimeupdate={() => {
                if (audioEl) currentMs = audioEl.currentTime * 1000;
            }}
            onloadedmetadata={() => {
                if (audioEl && Number.isFinite(audioEl.duration))
                    mediaDurationMs = audioEl.duration * 1000;
            }}
        ></audio>
    {/if}
</div>
