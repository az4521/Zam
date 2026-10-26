<script lang="ts">
    import { t } from "$lib/i18n";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        settingsState,
        setScreenShareResolution,
        setScreenShareFps,
        setShareSystemAudio,
        setScreenShareBitrate,
    } from "$lib/stores/settings.svelte";
    import {
        measuredUpload,
        screenShareBitrateCeiling,
    } from "$lib/stores/uploadEstimate.svelte";
    import { voiceCallState } from "$lib/stores/voiceCall.svelte";
    import { switchCallVideoCodec } from "$lib/matrix/client";
    import {
        VIDEO_CODEC_LABELS,
        type VideoCodec,
    } from "$lib/utils/videoCodecs";
    import {
        BITRATE_SLIDER_STEPS,
        bitrateFromSlider,
        bitrateParts,
        clampBitrate,
        sliderFromBitrate,
    } from "$lib/utils/screenShareBitrate";
    import {
        SCREEN_RESOLUTIONS,
        SCREEN_FPS_OPTIONS,
    } from "$lib/utils/voiceCall";

    interface Props {
        onQualityChange?: (resKey: string, fps: number) => void;
    }
    let { onQualityChange }: Props = $props();

    // Live mode = a share is currently running and onQualityChange adjusts it.
    // Setup mode = pre-share settings, onQualityChange is undefined.
    const isLive = $derived(onQualityChange !== undefined);

    function pickRes(key: string): void {
        setScreenShareResolution(key);
        onQualityChange?.(key, Number(settingsState.screenShareFps));
    }
    function pickFps(fps: number): void {
        setScreenShareFps(String(fps));
        onQualityChange?.(settingsState.screenShareResolution, fps);
    }

    // The bitrate is picked apart from resolution and fps, from about 240p's
    // bitrate up to 10% under the measured upload. While dragging only the
    // label follows; the pick is saved (and a live share retargeted) on
    // release.
    const ceiling = $derived(screenShareBitrateCeiling());
    const measured = $derived(measuredUpload());
    let draftBitrate = $state<number | null>(null);
    const shownBitrate = $derived(
        draftBitrate ?? clampBitrate(settingsState.screenShareBitrate, ceiling),
    );

    function bitrateLabel(bps: number): string {
        const { unit, n } = bitrateParts(bps);
        return unit === "kbps"
            ? t("screenShareQualityChips.kbps", { n })
            : t("screenShareQualityChips.mbps", { n });
    }

    function commitBitrate(position: number): void {
        draftBitrate = null;
        setScreenShareBitrate(bitrateFromSlider(position, ceiling));
        onQualityChange?.(
            settingsState.screenShareResolution,
            Number(settingsState.screenShareFps),
        );
    }

    // In a call: the codecs we can send that everyone can watch, plus the one
    // in use if someone who joined since can't (they get an H.264 backup).
    const codecs = $derived(voiceCallState.codecs);
    const codecChoices = $derived(
        codecs
            ? codecs.sendable.filter(
                  (c) => codecs.available.includes(c) || c === codecs.current,
              )
            : [],
    );

    function pickCodec(codec: VideoCodec): void {
        if (codec === codecs?.current && codec === codecs.picked) return;
        void switchCallVideoCodec(codec);
    }

    const chipBase =
        "px-2.5 py-1 rounded text-xs font-medium border transition-colors";
    const chipOn = "bg-discord-accent text-white border-discord-accent";
    const chipOff =
        "bg-discord-backgroundTertiary text-discord-textMuted border-transparent hover:bg-discord-messageHover";
</script>

<div class="space-y-3">
    <div>
        <div
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
        >
            {t("screenShareQualityChips.resolution")}
        </div>
        <div class="flex flex-wrap gap-1.5">
            {#each SCREEN_RESOLUTIONS as r (r.key)}
                <button
                    type="button"
                    class="{chipBase} {settingsState.screenShareResolution ===
                    r.key
                        ? chipOn
                        : chipOff}"
                    aria-pressed={settingsState.screenShareResolution === r.key}
                    onclick={() => pickRes(r.key)}
                >
                    {r.label}
                </button>
            {/each}
        </div>
    </div>
    <div>
        <div
            class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
        >
            {t("screenShareQualityChips.frameRate")}
        </div>
        <div class="flex flex-wrap gap-1.5">
            {#each SCREEN_FPS_OPTIONS as f (f)}
                <button
                    type="button"
                    class="{chipBase} {settingsState.screenShareFps ===
                    String(f)
                        ? chipOn
                        : chipOff}"
                    aria-pressed={settingsState.screenShareFps === String(f)}
                    onclick={() => pickFps(f)}
                >
                    {t("screenShareQualityChips.fps", { f })}
                </button>
            {/each}
        </div>
    </div>
    {#if codecs && codecChoices.length > 0}
        <div>
            <div
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
            >
                {t("screenShareQualityChips.videoCodec")}
            </div>
            <div class="flex flex-wrap gap-1.5">
                {#each codecChoices as codec (codec)}
                    <button
                        type="button"
                        class="{chipBase} {codecs.current === codec
                            ? chipOn
                            : chipOff}"
                        aria-pressed={codecs.current === codec}
                        title={codecs.hardware.includes(codec)
                            ? t("screenShareQualityChips.codecHardware")
                            : t("screenShareQualityChips.codecSoftware")}
                        onclick={() => pickCodec(codec)}
                    >
                        {VIDEO_CODEC_LABELS[codec]}
                        {#if codecs.hardware.includes(codec)}
                            <span class="ml-0.5 opacity-75"
                                >{t("screenShareQualityChips.hw")}</span
                            >
                        {/if}
                    </button>
                {/each}
            </div>
            <div class="text-xs text-discord-textMuted mt-0.5">
                {codecs.picked !== codecs.current
                    ? t("screenShareQualityChips.codecEncryptedFallbackHint", {
                          picked: VIDEO_CODEC_LABELS[codecs.picked],
                          current: VIDEO_CODEC_LABELS[codecs.current],
                      })
                    : codecs.available.includes(codecs.current)
                      ? t("screenShareQualityChips.codecHint")
                      : t("screenShareQualityChips.codecBackupHint", {
                            codec: VIDEO_CODEC_LABELS[codecs.current],
                        })}
            </div>
        </div>
    {/if}
    <div>
        <div class="flex items-baseline justify-between gap-2 mb-1.5">
            <div
                class="text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
            >
                {t("screenShareQualityChips.bitrate")}
            </div>
            <div class="text-xs text-discord-textPrimary tabular-nums">
                {bitrateLabel(shownBitrate)}
            </div>
        </div>
        <input
            type="range"
            min="0"
            max={BITRATE_SLIDER_STEPS}
            step="1"
            class="w-full accent-discord-accent"
            value={sliderFromBitrate(shownBitrate, ceiling)}
            aria-label={t("screenShareQualityChips.bitrate")}
            aria-valuetext={bitrateLabel(shownBitrate)}
            oninput={(e) =>
                (draftBitrate = bitrateFromSlider(
                    Number(e.currentTarget.value),
                    ceiling,
                ))}
            onchange={(e) => commitBitrate(Number(e.currentTarget.value))}
        />
        <div class="text-xs text-discord-textMuted mt-0.5">
            {measured === null
                ? t("screenShareQualityChips.bitrateUnmeasured", {
                      max: bitrateLabel(ceiling),
                  })
                : t("screenShareQualityChips.bitrateMeasured", {
                      upload: bitrateLabel(measured),
                      max: bitrateLabel(ceiling),
                  })}
        </div>
    </div>
    <div class="flex items-center justify-between gap-3">
        <div>
            <div class="text-sm text-discord-textPrimary">
                {t("screenShareQualityChips.shareSystemAudio")}
            </div>
            {#if isLive}
                <div class="text-xs text-discord-textMuted mt-0.5">
                    {t("screenShareQualityChips.appliesToNextShare")}
                </div>
            {/if}
        </div>
        <ToggleSwitch
            checked={settingsState.shareSystemAudio}
            onChange={(v) => setShareSystemAudio(v)}
            label={isLive
                ? t("screenShareQualityChips.shareSystemAudioAppliesToNext")
                : t("screenShareQualityChips.shareSystemAudio")}
        />
    </div>
</div>
