<script lang="ts">
    import { onDestroy } from "svelte";
    import { sendVoiceMessage } from "$lib/matrix/client";
    import {
        computeWaveform,
        pickAudioMimeType,
    } from "$lib/utils/voiceMessage";
    import { formatCallDuration } from "$lib/utils/callDuration";
    import { showErrorToast } from "$lib/stores/toasts.svelte";

    interface Props {
        roomId: string;
        onClose: () => void;
    }
    let { roomId, onClose }: Props = $props();

    const MAX_MS = 5 * 60 * 1000; // safety cap
    const WAVE_BARS = 48;

    type Phase = "recording" | "preview" | "sending";
    let phase = $state<Phase>("recording");
    let level = $state(0); // 0..1 live meter
    let elapsedMs = $state(0);
    let waveform = $state<number[]>([]);
    let previewUrl = $state<string | null>(null);
    let previewDurationMs = $state(0);

    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let chunks: Blob[] = [];
    let recordedBlob: Blob | null = null;
    let mimeType = "";
    let ctx: AudioContext | null = null;
    let raf = 0;
    let startTs = 0;
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;
    let autoStop: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    async function start() {
        mimeType = pickAudioMimeType();
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            showErrorToast("Microphone access was denied.");
            onClose();
            return;
        }
        recorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType } : undefined,
        );
        chunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = onStopped;
        recorder.onerror = () => {
            showErrorToast("Recording failed.");
            cleanup();
            onClose();
        };
        // Live meter (own analyser on the recording stream).
        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
            analyser.getByteTimeDomainData(buf);
            let sum = 0;
            for (const v of buf) {
                const c = (v - 128) / 128;
                sum += c * c;
            }
            level = Math.min(1, Math.sqrt(sum / buf.length) * 4);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        recorder.start();
        startTs = performance.now();
        elapsedTimer = setInterval(() => {
            elapsedMs = performance.now() - startTs;
        }, 200);
        autoStop = setTimeout(() => stop(), MAX_MS);
        phase = "recording";
    }

    function stop() {
        if (recorder && recorder.state !== "inactive") recorder.stop();
    }

    function teardownCapture() {
        cancelAnimationFrame(raf);
        if (elapsedTimer) clearInterval(elapsedTimer);
        if (autoStop) clearTimeout(autoStop);
        elapsedTimer = null;
        autoStop = null;
        stream?.getTracks().forEach((t) => t.stop());
        stream = null;
        void ctx?.close().catch(() => {});
        ctx = null;
    }

    async function onStopped() {
        if (disposed) return;
        previewDurationMs = performance.now() - startTs;
        teardownCapture();
        recordedBlob = new Blob(chunks, {
            type: mimeType || chunks[0]?.type || "audio/webm",
        });
        previewUrl = URL.createObjectURL(recordedBlob);
        // Decode for the waveform (best-effort; empty waveform is acceptable).
        try {
            const decodeCtx = new AudioContext();
            const audioBuf = await decodeCtx.decodeAudioData(
                await recordedBlob.arrayBuffer(),
            );
            waveform = computeWaveform(audioBuf.getChannelData(0), WAVE_BARS);
            void decodeCtx.close().catch(() => {});
        } catch {
            waveform = [];
        }
        phase = "preview";
    }

    async function send() {
        if (!recordedBlob || phase === "sending") return;
        if (recordedBlob.size === 0) {
            showErrorToast("Nothing was recorded.");
            discard();
            return;
        }
        phase = "sending";
        try {
            await sendVoiceMessage(
                roomId,
                recordedBlob,
                previewDurationMs,
                waveform,
            );
            cleanup();
            onClose();
        } catch (err) {
            showErrorToast(
                err instanceof Error
                    ? err.message
                    : "Failed to send voice message",
            );
            phase = "preview";
        }
    }

    function discard() {
        cleanup();
        onClose();
    }

    function cleanup() {
        disposed = true;
        // Stop + unwire the recorder before releasing the stream, so a discard
        // or unmount mid-recording doesn't fire a late onstop that rebuilds a
        // blob + object URL nothing would revoke.
        if (recorder) {
            recorder.onstop = null;
            recorder.onerror = null;
            if (recorder.state !== "inactive") {
                try {
                    recorder.stop();
                } catch {
                    /* already inactive */
                }
            }
            recorder = null;
        }
        teardownCapture();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        recordedBlob = null;
        chunks = [];
    }

    onDestroy(cleanup);
    start();
</script>

<div
    class="input-box relative flex items-center gap-3 bg-discord-backgroundSecondary rounded-lg px-3 py-2.5 border border-transparent"
>
    {#if phase === "recording"}
        <!-- Cancel -->
        <button
            type="button"
            onclick={discard}
            class="flex-shrink-0 p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors"
            title="Cancel"
            aria-label="Cancel recording"
        >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                />
            </svg>
        </button>

        <!-- Red pulsing dot -->
        <span
            class="voice-rec-dot flex-shrink-0 bg-discord-danger"
            aria-hidden="true"
        ></span>

        <!-- Elapsed time -->
        <span
            class="flex-shrink-0 text-sm font-mono tabular-nums text-discord-textPrimary"
        >
            {formatCallDuration(elapsedMs)}
        </span>

        <!-- Live level meter -->
        <div
            class="flex-1 min-w-0 h-2 rounded-full bg-discord-backgroundTertiary overflow-hidden"
            role="presentation"
        >
            <div
                class="h-full rounded-full bg-discord-accent"
                style="width: {level * 100}%"
            ></div>
        </div>

        <!-- Stop -->
        <button
            type="button"
            onclick={stop}
            class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded bg-discord-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
            Stop
        </button>
    {:else}
        <!-- Discard -->
        <button
            type="button"
            onclick={discard}
            disabled={phase === "sending"}
            class="flex-shrink-0 p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Discard"
            aria-label="Discard recording"
        >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path
                    d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                />
            </svg>
        </button>

        <!-- Waveform preview -->
        <div
            class="flex-1 min-w-0 flex items-center gap-[2px] h-8 overflow-hidden"
            role="presentation"
        >
            {#if waveform.length > 0}
                {#each waveform as bar, i (i)}
                    <div
                        class="flex-1 min-w-[2px] rounded-full bg-discord-accent/80"
                        style="height: {Math.max(8, (bar / 1024) * 100)}%"
                    ></div>
                {/each}
            {:else}
                <span class="text-xs text-discord-textMuted">Voice message</span
                >
            {/if}
        </div>

        <!-- Duration -->
        <span
            class="flex-shrink-0 text-sm font-mono tabular-nums text-discord-textMuted"
        >
            {formatCallDuration(previewDurationMs)}
        </span>

        <!-- Playback -->
        {#if previewUrl}
            <audio
                class="flex-shrink-0 h-8 max-w-[180px]"
                controls
                src={previewUrl}
            ></audio>
        {/if}

        <!-- Send -->
        <button
            type="button"
            onclick={send}
            disabled={phase === "sending"}
            class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded bg-discord-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
            {#if phase === "sending"}
                <div
                    class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                ></div>
                Sending…
            {:else}
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
                Send
            {/if}
        </button>
    {/if}
</div>

<style>
    .voice-rec-dot {
        width: 0.75rem;
        height: 0.75rem;
        border-radius: 9999px;
        animation: voice-rec-pulse 1.2s ease-in-out infinite;
    }

    @keyframes voice-rec-pulse {
        0%,
        100% {
            opacity: 1;
        }
        50% {
            opacity: 0.3;
        }
    }
</style>
