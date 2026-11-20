<script lang="ts">
    import { t } from "$lib/i18n";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";
    import {
        settingsState,
        setScreenShareResolution,
        setScreenShareFps,
        setShareSystemAudio,
        setNativeScreenShare,
        setScreenShareBitrate,
        setUploadSpeedOverride,
        uploadOverride,
    } from "$lib/stores/settings.svelte";
    import { nativeShareAvailable } from "$lib/desktopScreenShare";
    import { uploadEstimate } from "$lib/stores/uploadEstimate.svelte";
    import { voiceCallState } from "$lib/stores/voiceCall.svelte";
    import { switchCallVideoCodec } from "$lib/matrix/client";
    import {
        VIDEO_CODEC_LABELS,
        type VideoCodec,
    } from "$lib/utils/videoCodecs";
    import {
        AUTO_SCREEN_SHARE_BITRATE,
        BITRATE_SLIDER_STEPS,
        MAX_SCREEN_SHARE_BITRATE,
        SHARE_AUTO_START_BPS,
        bitrateFromSlider,
        bitrateParts,
        clampBitrate,
        isAutoBitrate,
        roundBitrate,
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
    // The Windows desktop app's capture helper (matrix/call/nativeShare).
    const nativeOffered = nativeShareAvailable();

    function pickRes(key: string): void {
        setScreenShareResolution(key);
        onQualityChange?.(key, Number(settingsState.screenShareFps));
    }
    function pickFps(fps: number): void {
        setScreenShareFps(String(fps));
        onQualityChange?.(settingsState.screenShareResolution, fps);
    }

    // The bitrate is automatic by default: no cap, the share sends what the
    // upload carries right now. Turning that off picks a cap, from about
    // 240p's bitrate up to 50 Mbps, sent as picked. While dragging only the
    // label follows; the pick is saved (and a live share retargeted) on
    // release.
    const auto = $derived(isAutoBitrate(settingsState.screenShareBitrate));
    const live = $derived(uploadEstimate.live);
    const overridden = $derived(uploadOverride() !== null);
    let draftBitrate = $state<number | null>(null);
    const shownBitrate = $derived(
        draftBitrate ??
            clampBitrate(
                settingsState.screenShareBitrate,
                MAX_SCREEN_SHARE_BITRATE,
            ),
    );

    function retarget(): void {
        onQualityChange?.(
            settingsState.screenShareResolution,
            Number(settingsState.screenShareFps),
        );
    }

    function setAuto(on: boolean): void {
        // A manual cap starts from what the upload carries now, if known.
        setScreenShareBitrate(
            on
                ? AUTO_SCREEN_SHARE_BITRATE
                : clampBitrate(
                      roundBitrate(live ?? SHARE_AUTO_START_BPS),
                      MAX_SCREEN_SHARE_BITRATE,
                  ),
        );
        retarget();
    }

    function bitrateLabel(bps: number): string {
        const { unit, n } = bitrateParts(bps);
        return unit === "kbps"
            ? t("screenShareQualityChips.kbps", { n })
            : t("screenShareQualityChips.mbps", { n });
    }

    // The typed-in upload speed is in Mbps; empty or 0 goes back to measuring.
    function commitUploadOverride(text: string): void {
        const mbps = Number(text.replace(",", "."));
        setUploadSpeedOverride(
            text.trim() !== "" && Number.isFinite(mbps) && mbps > 0
                ? mbps * 1_000_000
                : 0,
        );
        // The automatic cap moved: bring a live share along with it.
        retarget();
    }

    function commitBitrate(position: number): void {
        draftBitrate = null;
        setScreenShareBitrate(
            bitrateFromSlider(position, MAX_SCREEN_SHARE_BITRATE),
        );
        retarget();
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
    const chipOn = "bg-zam-accent text-white border-zam-accent";
    const chipOff =
        "bg-zam-backgroundTertiary text-zam-textMuted border-transparent hover:bg-zam-messageHover";
</script>

<div class="space-y-3">
    <div>
        <div
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-1.5"
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
            class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-1.5"
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
                class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide mb-1.5"
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
            <div class="text-xs text-zam-textMuted mt-0.5">
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
        <div class="flex items-center justify-between gap-2 mb-1.5">
            <div
                class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide"
            >
                {t("screenShareQualityChips.bitrate")}
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-zam-textMuted">
                    {t("screenShareQualityChips.bitrateAuto")}
                </span>
                <ToggleSwitch
                    checked={auto}
                    onChange={(v) => setAuto(v)}
                    label={t("screenShareQualityChips.bitrateAuto")}
                />
            </div>
        </div>
        {#if auto}
            <div class="text-xs text-zam-textMuted">
                {t("screenShareQualityChips.bitrateAutoHint")}
            </div>
            <div class="text-xs text-zam-textMuted mt-0.5">
                {overridden
                    ? t("screenShareQualityChips.bitrateAutoOverridden", {
                          upload: bitrateLabel(
                              settingsState.uploadSpeedOverride,
                          ),
                      })
                    : live !== null
                      ? t("screenShareQualityChips.bitrateAutoNow", {
                            upload: bitrateLabel(live),
                        })
                      : t("screenShareQualityChips.bitrateAutoUnknown")}
            </div>
            <div class="flex items-center justify-between gap-2 mt-1.5">
                <label
                    for="upload-speed-override"
                    class="text-xs text-zam-textMuted"
                >
                    {t("screenShareQualityChips.uploadOverride")}
                </label>
                <input
                    id="upload-speed-override"
                    type="text"
                    inputmode="decimal"
                    autocomplete="off"
                    class="w-24 px-2 py-1 rounded text-xs bg-zam-backgroundTertiary text-zam-textPrimary border border-transparent focus:border-zam-accent outline-none text-end"
                    placeholder={t(
                        "screenShareQualityChips.uploadOverrideAuto",
                    )}
                    value={settingsState.uploadSpeedOverride > 0
                        ? String(
                              Math.round(
                                  (settingsState.uploadSpeedOverride /
                                      1_000_000) *
                                      10,
                              ) / 10,
                          )
                        : ""}
                    onchange={(e) =>
                        commitUploadOverride(e.currentTarget.value)}
                />
            </div>
            <div class="text-xs text-zam-textMuted mt-0.5">
                {t("screenShareQualityChips.uploadOverrideCapHint")}
            </div>
        {:else}
            <div class="text-xs text-zam-textPrimary tabular-nums mb-1">
                {t("screenShareQualityChips.bitrateUpTo")}
                {bitrateLabel(shownBitrate)}
            </div>
            <input
                type="range"
                min="0"
                max={BITRATE_SLIDER_STEPS}
                step="1"
                class="w-full accent-zam-accent"
                value={sliderFromBitrate(
                    shownBitrate,
                    MAX_SCREEN_SHARE_BITRATE,
                )}
                aria-label={t("screenShareQualityChips.bitrate")}
                aria-valuetext={bitrateLabel(shownBitrate)}
                oninput={(e) =>
                    (draftBitrate = bitrateFromSlider(
                        Number(e.currentTarget.value),
                        MAX_SCREEN_SHARE_BITRATE,
                    ))}
                onchange={(e) => commitBitrate(Number(e.currentTarget.value))}
            />
            <div class="text-xs text-zam-textMuted mt-0.5">
                {t("screenShareQualityChips.bitrateCapHint")}
            </div>
        {/if}
    </div>
    <div class="flex items-center justify-between gap-3">
        <div>
            <div class="text-sm text-zam-textPrimary">
                {t("screenShareQualityChips.shareSystemAudio")}
            </div>
            {#if isLive}
                <div class="text-xs text-zam-textMuted mt-0.5">
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
    {#if nativeOffered}
        <div class="flex items-center justify-between gap-3">
            <div>
                <div class="text-sm text-zam-textPrimary">
                    {t("screenShareQualityChips.nativeCapture")}
                </div>
                <div class="text-xs text-zam-textMuted mt-0.5">
                    {t("screenShareQualityChips.nativeCaptureHint")}
                </div>
            </div>
            <ToggleSwitch
                checked={settingsState.nativeScreenShare}
                onChange={(v) => setNativeScreenShare(v)}
                label={t("screenShareQualityChips.nativeCapture")}
            />
        </div>
    {/if}
</div>
