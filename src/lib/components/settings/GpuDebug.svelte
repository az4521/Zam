<script lang="ts">
    import { onMount } from "svelte";
    import { t } from "$lib/i18n";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";

    // Desktop only (rendered when window.desktop.gpu exists): Chromium's GPU
    // report, which video codecs decode and encode on the GPU, and the
    // switches to turn hardware acceleration (or Linux GPU encoding) off for
    // drivers that misbehave.
    type GpuReport = Awaited<
        ReturnType<NonNullable<NonNullable<Window["desktop"]>["gpu"]>["info"]>
    >;
    type Decode = "hardware" | "software" | "unsupported";

    // One common stream per codec; HEVC twice because 10-bit (Main10) is the
    // one phones record and the one drivers most often lack.
    const CODECS: [string, string][] = [
        ["H.264", 'video/mp4; codecs="avc1.640028"'],
        ["HEVC", 'video/mp4; codecs="hvc1.1.6.L120.90"'],
        ["HEVC 10-bit", 'video/mp4; codecs="hvc1.2.4.L120.90"'],
        ["VP9", 'video/webm; codecs="vp09.00.40.08"'],
        ["AV1", 'video/mp4; codecs="av01.0.08M.08"'],
    ];

    // WebCodecs names for the codecs a call can send. Calls send VP8 (LiveKit's
    // default), so that row is what decides whether a call encodes on the GPU.
    const ENCODE_CODECS: [string, string][] = [
        ["VP8", "vp8"],
        ["VP9", "vp09.00.10.08"],
        ["H.264", "avc1.42001f"],
        ["AV1", "av01.0.04M.08"],
    ];

    let report = $state<GpuReport | null>(null);
    let decode = $state<[string, Decode][]>([]);
    let encode = $state<[string, Decode][]>([]);
    let error = $state("");
    let loading = $state(false);
    let copied = $state(false);

    // Chromium reports a codec it can only play in software as supported but
    // not power efficient; power efficient means the GPU decodes it.
    async function probe(contentType: string): Promise<Decode> {
        if (!MediaSource.isTypeSupported(contentType)) return "unsupported";
        try {
            const result = await navigator.mediaCapabilities.decodingInfo({
                type: "media-source",
                video: {
                    contentType,
                    width: 1920,
                    height: 1080,
                    bitrate: 8_000_000,
                    framerate: 30,
                },
            });
            if (!result.supported) return "unsupported";
            return result.powerEfficient ? "hardware" : "software";
        } catch {
            return "software";
        }
    }

    // WebCodecs refuses a "prefer-hardware" config when no GPU encoder takes
    // it, so asking twice tells hardware from software. A 720p30 stream is
    // what a call's top camera layer sends. Calls encode at a constant bitrate
    // (WebRTC on Linux asks VA-API for CBR); WebCodecs' default is variable,
    // which a CBR-only encoder like Zam's NVENC driver would fail.
    async function probeEncode(codec: string): Promise<Decode> {
        const config = {
            codec,
            width: 1280,
            height: 720,
            bitrate: 2_500_000,
            bitrateMode: "constant" as const,
            framerate: 30,
        };
        const supported = async (
            hardwareAcceleration: HardwareAcceleration,
        ) => {
            try {
                return !!(
                    await VideoEncoder.isConfigSupported({
                        ...config,
                        hardwareAcceleration,
                    })
                ).supported;
            } catch {
                return false;
            }
        };
        if (await supported("prefer-hardware")) return "hardware";
        return (await supported("no-preference")) ? "software" : "unsupported";
    }

    async function load() {
        const gpu = window.desktop?.gpu;
        if (!gpu) return;
        loading = true;
        error = "";
        try {
            const [next, codecs, encoders] = await Promise.all([
                gpu.info(),
                Promise.all(
                    CODECS.map(
                        async ([name, type]) =>
                            [name, await probe(type)] as [string, Decode],
                    ),
                ),
                typeof VideoEncoder === "undefined"
                    ? []
                    : Promise.all(
                          ENCODE_CODECS.map(
                              async ([name, codec]) =>
                                  [name, await probeEncode(codec)] as [
                                      string,
                                      Decode,
                                  ],
                          ),
                      ),
            ]);
            report = next;
            decode = codecs;
            encode = encoders;
        } catch (e) {
            error = (e as Error)?.message ?? String(e);
        } finally {
            loading = false;
        }
    }

    onMount(load);

    async function setHardwareAcceleration(enabled: boolean) {
        if (!report) return;
        report.hardwareAcceleration = enabled;
        try {
            await window.desktop?.gpu?.setHardwareAcceleration(enabled);
        } catch (e) {
            report.hardwareAcceleration = !enabled;
            error = (e as Error)?.message ?? String(e);
        }
    }

    async function setVideoEncode(enabled: boolean) {
        const ve = report?.videoEncode;
        if (!ve) return;
        ve.enabled = enabled;
        try {
            await window.desktop?.gpu?.setVideoEncode(enabled);
        } catch (e) {
            ve.enabled = !enabled;
            error = (e as Error)?.message ?? String(e);
        }
    }

    async function setSkiaGraphite(enabled: boolean) {
        const sg = report?.skiaGraphite;
        if (!sg) return;
        sg.enabled = enabled;
        try {
            await window.desktop?.gpu?.setSkiaGraphite(enabled);
        } catch (e) {
            sg.enabled = !enabled;
            error = (e as Error)?.message ?? String(e);
        }
    }

    // Applies on the next launch (zam.sh); a flag rather than a comparison with
    // activeAtLaunch, which stays false on machines zam.sh finds no NVIDIA in.
    let nvidiaEncodeChanged = $state(false);

    async function setNvidiaEncode(enabled: boolean) {
        const ne = report?.nvidiaEncode;
        if (!ne) return;
        ne.enabled = enabled;
        nvidiaEncodeChanged = true;
        try {
            await window.desktop?.gpu?.setNvidiaEncode(enabled);
        } catch (e) {
            ne.enabled = !enabled;
            error = (e as Error)?.message ?? String(e);
        }
    }

    type NvidiaMode = "auto" | "vulkan" | "off";
    // The Vulkan path only takes effect on the next launch (zam.sh).
    let nvidiaChanged = $state(false);

    async function setNvidiaVideo(mode: NvidiaMode) {
        const nv = report?.nvidiaVideo;
        if (!nv) return;
        const prev = nv.mode;
        nv.mode = mode;
        nv.failedAt = null;
        nvidiaChanged = true;
        try {
            await window.desktop?.gpu?.setNvidiaVideo(mode);
        } catch (e) {
            nv.mode = prev;
            error = (e as Error)?.message ?? String(e);
        }
    }

    // The flag is only on with hardware acceleration, so a run without it
    // can't tell whether the encode choice changed.
    const encodeChanged = $derived(
        !!report?.videoEncode &&
            report.hardwareAccelerationAtLaunch &&
            report.videoEncode.enabled !== report.videoEncode.activeAtLaunch,
    );

    const graphiteChanged = $derived(
        !!report?.skiaGraphite &&
            report.hardwareAccelerationAtLaunch &&
            report.skiaGraphite.enabled !== report.skiaGraphite.activeAtLaunch,
    );

    const decodeLabel = (d: Decode) =>
        d === "hardware"
            ? t("gpuDebug.decodeHardware")
            : d === "software"
              ? t("gpuDebug.decodeSoftware")
              : t("gpuDebug.decodeUnsupported");

    const reportJson = $derived(
        report
            ? JSON.stringify(
                  {
                      ...report,
                      videoDecode: Object.fromEntries(decode),
                      videoEncode: Object.fromEntries(encode),
                  },
                  null,
                  2,
              )
            : "",
    );

    async function copy() {
        try {
            await navigator.clipboard.writeText(reportJson);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch {
            /* clipboard denied: the report is still on screen to select */
        }
    }
</script>

<section>
    <div class="mb-2 flex items-center gap-2">
        <p
            class="flex-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("gpuDebug.title")}
        </p>
        <button
            onclick={load}
            disabled={loading}
            class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary disabled:opacity-50"
            >{t("debugSettings.refresh")}</button
        >
        <button
            onclick={copy}
            disabled={!report}
            class="px-2.5 py-1 rounded text-xs font-semibold bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary disabled:opacity-50"
            >{copied ? t("debugSettings.copied") : t("common.copy")}</button
        >
    </div>

    <div class="flex items-center gap-3 py-2 border-b border-discord-divider">
        <div class="flex-1 min-w-0">
            <p class="text-sm text-discord-textPrimary">
                {t("gpuDebug.hardwareAcceleration")}
            </p>
            <p class="text-xs text-discord-textMuted">
                {t("gpuDebug.hardwareAccelerationHint")}
            </p>
        </div>
        <ToggleSwitch
            checked={report?.hardwareAcceleration ?? true}
            onChange={setHardwareAcceleration}
            label={t("gpuDebug.hardwareAcceleration")}
        />
    </div>
    {#if report?.skiaGraphite}
        {@const sg = report.skiaGraphite}
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("gpuDebug.skiaGraphite")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("gpuDebug.skiaGraphiteHint")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {sg.activeAtLaunch
                        ? t("gpuDebug.nvidiaVideoActive")
                        : t("gpuDebug.nvidiaVideoInactive")}
                </p>
            </div>
            <ToggleSwitch
                checked={sg.enabled}
                onChange={setSkiaGraphite}
                label={t("gpuDebug.skiaGraphite")}
            />
        </div>
    {/if}
    {#if report?.videoEncode}
        {@const ve = report.videoEncode}
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("gpuDebug.videoEncode")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("gpuDebug.videoEncodeHint")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {ve.activeAtLaunch
                        ? t("gpuDebug.nvidiaVideoActive")
                        : t("gpuDebug.nvidiaVideoInactive")}
                </p>
            </div>
            <ToggleSwitch
                checked={ve.enabled}
                onChange={setVideoEncode}
                label={t("gpuDebug.videoEncode")}
            />
        </div>
    {/if}
    {#if report?.nvidiaVideo}
        {@const nv = report.nvidiaVideo}
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("gpuDebug.nvidiaVideo")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("gpuDebug.nvidiaVideoHint")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {nv.activeAtLaunch
                        ? t("gpuDebug.nvidiaVideoActive")
                        : t("gpuDebug.nvidiaVideoInactive")}
                </p>
                {#if nv.failedAt && nv.mode === "auto"}
                    <p class="text-xs text-discord-warning">
                        {t("gpuDebug.nvidiaVideoFailed")}
                    </p>
                {/if}
            </div>
            <select
                class="bg-discord-backgroundTertiary text-discord-textPrimary text-sm rounded px-2 py-1.5 border border-discord-divider focus:outline-none focus:ring-2 focus:ring-discord-accent sm:max-w-[16rem]"
                value={nv.mode}
                onchange={(e) =>
                    setNvidiaVideo(e.currentTarget.value as NvidiaMode)}
                aria-label={t("gpuDebug.nvidiaVideo")}
            >
                <option value="auto">{t("gpuDebug.nvidiaVideoAuto")}</option>
                <option value="vulkan">{t("gpuDebug.nvidiaVideoVulkan")}</option
                >
                <option value="off">{t("gpuDebug.nvidiaVideoOff")}</option>
            </select>
        </div>
    {/if}
    {#if report?.nvidiaEncode}
        {@const ne = report.nvidiaEncode}
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <div class="flex-1 min-w-0">
                <p class="text-sm text-discord-textPrimary">
                    {t("gpuDebug.nvidiaEncode")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {t("gpuDebug.nvidiaEncodeHint")}
                </p>
                <p class="text-xs text-discord-textMuted">
                    {ne.activeAtLaunch
                        ? t("gpuDebug.nvidiaVideoActive")
                        : t("gpuDebug.nvidiaVideoInactive")}
                </p>
            </div>
            <ToggleSwitch
                checked={ne.enabled}
                onChange={setNvidiaEncode}
                label={t("gpuDebug.nvidiaEncode")}
            />
        </div>
    {/if}
    {#if report && (nvidiaChanged || report.hardwareAcceleration !== report.hardwareAccelerationAtLaunch || encodeChanged || graphiteChanged || nvidiaEncodeChanged)}
        <div
            class="flex items-center gap-3 py-2 border-b border-discord-divider"
        >
            <p class="flex-1 text-xs text-discord-warning">
                {t("gpuDebug.restartToApply")}
            </p>
            <button
                onclick={() => window.desktop?.gpu?.relaunch()}
                class="px-3 py-1.5 rounded text-sm font-medium bg-discord-accent hover:bg-discord-accentHover text-white"
                >{t("gpuDebug.restart")}</button
            >
        </div>
    {/if}

    {#if error}
        <p class="mt-2 text-xs text-discord-danger break-all">{error}</p>
    {:else if !report}
        <p class="mt-2 text-xs text-discord-textMuted">
            {t("common.loading")}
        </p>
    {:else}
        <p
            class="mt-3 mb-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("gpuDebug.videoDecoding")}
        </p>
        {#each decode as [name, d]}
            <div
                class="flex items-start gap-3 text-sm py-1 border-b border-discord-divider"
            >
                <span class="text-discord-textMuted flex-shrink-0 w-44"
                    >{name}</span
                >
                <span
                    class="font-mono text-xs {d === 'hardware'
                        ? 'text-discord-textPositive'
                        : d === 'software'
                          ? 'text-discord-warning'
                          : 'text-discord-danger'}">{decodeLabel(d)}</span
                >
            </div>
        {/each}

        {#if encode.length}
            <p
                class="mt-3 mb-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
            >
                {t("gpuDebug.videoEncoding")}
            </p>
            {#each encode as [name, d]}
                <div
                    class="flex items-start gap-3 text-sm py-1 border-b border-discord-divider"
                >
                    <span class="text-discord-textMuted flex-shrink-0 w-44"
                        >{name}</span
                    >
                    <span
                        class="font-mono text-xs {d === 'hardware'
                            ? 'text-discord-textPositive'
                            : d === 'software'
                              ? 'text-discord-warning'
                              : 'text-discord-danger'}">{decodeLabel(d)}</span
                    >
                </div>
            {/each}
            <p class="mt-1 text-xs text-discord-textMuted">
                {t("gpuDebug.videoEncodingHint")}
            </p>
        {/if}

        <p
            class="mt-3 mb-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
        >
            {t("gpuDebug.featureStatus")}
        </p>
        {#each Object.entries(report.featureStatus) as [feature, status]}
            <div
                class="flex items-start gap-3 text-sm py-1 border-b border-discord-divider"
            >
                <span
                    class="text-discord-textMuted flex-shrink-0 w-44 break-all font-mono text-xs"
                    >{feature}</span
                >
                <span
                    class="text-discord-textPrimary break-all font-mono text-xs"
                    >{status}</span
                >
            </div>
        {/each}

        <details class="mt-3">
            <summary
                class="cursor-pointer text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >{t("gpuDebug.details")}</summary
            >
            <pre
                class="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-discord-backgroundTertiary p-2 text-xs font-mono text-discord-textPrimary select-text">{reportJson}</pre>
        </details>
    {/if}
</section>
