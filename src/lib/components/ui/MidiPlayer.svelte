<script lang="ts">
    import { t } from "$lib/i18n";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import {
        readSavedVolume,
        rememberVolume,
        saveVolume,
    } from "$lib/actions/rememberVolume";
    import { midiUrlToWavUrl } from "$lib/utils/midi";
    import {
        midiDurationSeconds,
        openMidiStream,
        type MidiStream,
    } from "$lib/utils/midiStream";
    import { formatCallDuration } from "$lib/utils/callDuration";

    interface Props {
        /** Blob URL of the MIDI file. */
        midiUrl: string;
        /** The file can't be played at all (neither path worked). */
        onfail?: () => void;
    }
    let { midiUrl, onfail }: Props = $props();

    // Device-local volume, shared with every other media player.
    const saved = readSavedVolume();
    let volume = $state(saved?.volume ?? 1);
    let muted = $state(saved?.muted ?? false);
    const shownVolume = $derived(muted ? 0 : volume);

    // "stream" plays through the real-time worklet; "wav" is the rendered
    // fallback for devices without it or without a sound bank.
    let mode = $state<"loading" | "stream" | "wav">("loading");
    let wavUrl = $state<string | null>(null);
    let playing = $state(false);
    let position = $state(0);
    let duration = $state(0);
    let stream: MidiStream | null = null;
    // Set while a pointer is on the seek slider, so playback doesn't pull
    // the thumb back under the user's finger.
    let scrubbing = false;

    // Phones and tablets get the cheaper synth settings.
    const lowPower = () =>
        interfaceState.isMobile || interfaceState.isTouchscreen;

    $effect(() => {
        const url = midiUrl;
        let cancelled = false;
        let madeWav: string | null = null;

        // Render the whole song to WAV, as before the worklet existed.
        const toWav = async () => {
            stream?.destroy();
            stream = null;
            playing = false;
            mode = "loading";
            try {
                const made = await midiUrlToWavUrl(url);
                if (cancelled) return URL.revokeObjectURL(made);
                madeWav = made;
                wavUrl = made;
                mode = "wav";
            } catch {
                if (!cancelled) onfail?.();
            }
        };

        (async () => {
            try {
                const data = await (await fetch(url)).arrayBuffer();
                if (cancelled) return;
                duration = midiDurationSeconds(data);
                const opened = await openMidiStream(
                    data,
                    { mobile: lowPower() },
                    {
                        onTime: (current, total) => {
                            if (!scrubbing) position = current;
                            if (total > 0) duration = total;
                        },
                        onPlaying: () => {
                            playing = true;
                        },
                        onEnded: () => {
                            playing = false;
                            // Time arrives about 4 times a second, so the
                            // last report falls short of the end.
                            if (!scrubbing) position = duration;
                        },
                        onPreempted: () => {
                            playing = false;
                        },
                        onBlocked: () => {
                            playing = false;
                        },
                        onError: () => void toWav(),
                    },
                );
                if (cancelled) return opened?.destroy();
                if (opened) {
                    opened.setVolume(volume, muted);
                    stream = opened;
                    mode = "stream";
                    // The card's play click already asked for audio, so start
                    // now. If the browser blocks it, the stream reports that
                    // and the button stays on play.
                    opened.play();
                } else {
                    await toWav();
                }
            } catch {
                if (!cancelled) await toWav();
            }
        })();

        return () => {
            cancelled = true;
            stream?.destroy();
            stream = null;
            if (madeWav) URL.revokeObjectURL(madeWav);
            wavUrl = null;
            playing = false;
        };
    });

    // The button follows the stream's events, so a play that is still loading
    // (or is blocked) doesn't show as playing. The stream's own flag decides
    // what a click does, so a click during that wait cancels it.
    function toggle(): void {
        if (!stream) return;
        if (stream.isPlaying) {
            stream.pause();
            playing = false;
        } else {
            stream.play();
        }
    }

    function seekTo(e: Event): void {
        position = Number((e.currentTarget as HTMLInputElement).value);
        stream?.seek(position);
    }

    function setVolume(e: Event): void {
        volume = Number((e.currentTarget as HTMLInputElement).value);
        muted = false;
        stream?.setVolume(volume, muted);
        saveVolume(volume, muted);
    }
</script>

{#if mode === "stream"}
    <div class="flex flex-col gap-1 w-full">
        <input
            type="range"
            min="0"
            max={duration > 0 ? duration : 1}
            step="0.1"
            value={position}
            oninput={seekTo}
            onpointerdown={() => (scrubbing = true)}
            onchange={() => (scrubbing = false)}
            aria-label={t("midiPlayer.seek")}
            class="w-full h-1 accent-discord-accent cursor-pointer"
        />
        <div class="flex items-center gap-2">
            <button
                type="button"
                onclick={toggle}
                aria-label={playing
                    ? t("midiPlayer.pause")
                    : t("midiPlayer.play")}
                class="w-7 h-7 rounded-full bg-discord-accent flex-shrink-0 flex items-center justify-center"
            >
                {#if playing}
                    <svg
                        class="w-3.5 h-3.5 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        ><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg
                    >
                {:else}
                    <svg
                        class="w-3.5 h-3.5 text-white ms-0.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg
                    >
                {/if}
            </button>
            <span class="text-discord-textMuted text-xs tabular-nums">
                {formatCallDuration(position * 1000)} / {formatCallDuration(
                    duration * 1000,
                )}
            </span>
            <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={shownVolume}
                oninput={setVolume}
                aria-label={t("midiPlayer.volume")}
                class="ms-auto w-20 h-1 accent-discord-accent cursor-pointer"
            />
        </div>
    </div>
{:else if mode === "wav" && wavUrl}
    <!-- svelte-ignore a11y_media_has_caption -->
    <audio controls autoplay use:rememberVolume src={wavUrl} class="w-full h-8"
    ></audio>
{:else}
    <p class="text-xs text-discord-textMuted">{t("common.loading")}</p>
{/if}
