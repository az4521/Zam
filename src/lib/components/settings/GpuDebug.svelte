<script lang="ts">
    import { onMount } from "svelte";
    import { t } from "$lib/i18n";
    import ToggleSwitch from "$lib/components/ui/ToggleSwitch.svelte";

    // Desktop only (rendered when window.desktop.gpu exists): Chromium's GPU
    // report, which video codecs decode on the GPU, and the switch to turn
    // hardware acceleration off for drivers that misrender.
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

    let report = $state<GpuReport | null>(null);
    let decode = $state<[string, Decode][]>([]);
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

    async function load() {
        const gpu = window.desktop?.gpu;
        if (!gpu) return;
        loading = true;
        error = "";
        try {
            const [next, codecs] = await Promise.all([
                gpu.info(),
                Promise.all(
                    CODECS.map(
                        async ([name, type]) =>
                            [name, await probe(type)] as [string, Decode],
                    ),
                ),
            ]);
            report = next;
            decode = codecs;
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

    const decodeLabel = (d: Decode) =>
        d === "hardware"
            ? t("gpuDebug.decodeHardware")
            : d === "software"
              ? t("gpuDebug.decodeSoftware")
              : t("gpuDebug.decodeUnsupported");

    const reportJson = $derived(
        report
            ? JSON.stringify(
                  { ...report, videoDecode: Object.fromEntries(decode) },
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
    {#if report && (nvidiaChanged || report.hardwareAcceleration !== report.hardwareAccelerationAtLaunch)}
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
