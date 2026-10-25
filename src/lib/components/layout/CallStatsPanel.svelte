<script lang="ts">
    import { t } from "$lib/i18n";
    import { onMount } from "svelte";
    import { X } from "lucide-svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import ModalDialog from "$lib/components/ui/ModalDialog.svelte";
    import { openModal, clearModalIfOwner } from "$lib/stores/interface.svelte";
    import { voiceCallState } from "$lib/stores/voiceCall.svelte";
    import { getRoom } from "$lib/matrix/client";
    import {
        getCallDebugStats,
        type CallDebugConnection,
    } from "$lib/matrix/livekitCall";
    import {
        summarizeTransport,
        summarizeRtpStreams,
        codecLabel,
        opusFeatures,
        pathIsTcp,
        rttTone,
        lossTone,
        jitterTone,
        type CallPath,
        type RtpStreamSummary,
        type StatTone,
        type StreamSource,
        type TransportSummary,
    } from "$lib/utils/callStats";
    import { showToast } from "$lib/stores/toasts.svelte";

    interface Props {
        onClose: () => void;
    }
    let { onClose }: Props = $props();

    onMount(() => {
        const token = openModal("call-stats", onClose);
        return () => {
            clearModalIfOwner(token);
        };
    });

    const POLL_MS = 1000;

    interface ParticipantView {
        identity: string;
        name: string;
        quality: string;
        audio: TransportSummary | null;
    }
    interface ConnectionView {
        raw: CallDebugConnection;
        publisher: TransportSummary | null;
        subscriber: TransportSummary | null;
        participants: ParticipantView[];
        /** Sent streams first, then received; inactive simulcast layers
         *  left out. */
        streams: RtpStreamSummary[];
    }

    let connections = $state<ConnectionView[] | null>(null);
    // Previous summary per transport / participant, for interval rates.
    const prev = new Map<string, TransportSummary>();
    const prevStreams = new Map<string, RtpStreamSummary[]>();

    const SOURCE_ORDER: StreamSource[] = [
        "microphone",
        "camera",
        "screen_share",
        "screen_share_audio",
        "unknown",
    ];

    function foldStreams(
        key: string,
        stats: CallDebugConnection["publisher"],
        owners: CallDebugConnection["owners"],
        at: number,
    ): RtpStreamSummary[] {
        if (!stats) return [];
        const s = summarizeRtpStreams(
            stats,
            at,
            owners,
            prevStreams.get(key) ?? [],
        );
        prevStreams.set(key, s);
        return s;
    }

    function streamsOf(c: CallDebugConnection, at: number) {
        const all = [
            ...foldStreams(`${c.key}|pub`, c.publisher, c.owners, at),
            ...foldStreams(`${c.key}|sub`, c.subscriber, c.owners, at),
        ].filter((s) => s.active !== false);
        return all.sort(
            (a, b) =>
                (a.direction === b.direction
                    ? 0
                    : a.direction === "send"
                      ? -1
                      : 1) ||
                (a.identity ?? "").localeCompare(b.identity ?? "") ||
                SOURCE_ORDER.indexOf(a.source) -
                    SOURCE_ORDER.indexOf(b.source) ||
                (b.width ?? 0) - (a.width ?? 0),
        );
    }

    function fold(
        key: string,
        stats: CallDebugConnection["publisher"],
        at: number,
    ): TransportSummary | null {
        if (!stats) return null;
        const s = summarizeTransport(stats, at, prev.get(key) ?? null);
        prev.set(key, s);
        return s;
    }

    function displayName(userId: string): string {
        const roomId = voiceCallState.roomId;
        const member = roomId ? getRoom(roomId)?.getMember(userId) : null;
        return member?.name || userId;
    }

    async function poll(): Promise<void> {
        const raw = await getCallDebugStats();
        const at = performance.now();
        if (!raw) {
            connections = [];
            return;
        }
        connections = raw.map((c) => ({
            raw: c,
            publisher: fold(`${c.key}|pub`, c.publisher, at),
            subscriber: fold(`${c.key}|sub`, c.subscriber, at),
            participants: c.participants.map((p) => ({
                identity: p.identity,
                name: displayName(p.userId),
                quality: p.quality,
                audio: fold(`${c.key}|p|${p.identity}`, p.audio, at),
            })),
            streams: streamsOf(c, at),
        }));
    }

    $effect(() => {
        let alive = true;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const loop = async () => {
            try {
                await poll();
            } catch (e) {
                console.warn("[callStats] poll failed", e);
            }
            if (alive) timer = setTimeout(loop, POLL_MS);
        };
        void loop();
        return () => {
            alive = false;
            clearTimeout(timer);
        };
    });

    const ms = (v: number | null) => (v === null ? "-" : `${Math.round(v)} ms`);
    const kbps = (v: number | null) =>
        v === null
            ? "-"
            : v >= 1000
              ? `${(v / 1000).toFixed(2)} Mbit/s`
              : `${Math.round(v)} kbit/s`;
    const pct = (v: number | null) =>
        v === null ? "-" : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;

    function pathLabel(path: CallPath): string {
        switch (path) {
            case "udp":
                return t("callStats.pathUdp");
            case "tcp":
                return t("callStats.pathTcp");
            case "relay-udp":
                return t("callStats.pathRelayUdp");
            case "relay-tcp":
                return t("callStats.pathRelayTcp");
            case "relay-tls":
                return t("callStats.pathRelayTls");
            default:
                return t("callStats.pathUnknown");
        }
    }

    function pathTone(path: CallPath): StatTone {
        if (pathIsTcp(path)) return "bad";
        return path === "relay-udp" ? "warn" : "ok";
    }

    function qualityTone(q: string): StatTone {
        if (q === "excellent" || q === "good") return "ok";
        if (q === "poor") return "warn";
        return q === "lost" ? "bad" : "ok";
    }

    function qualityLabel(q: string): string {
        switch (q) {
            case "excellent":
                return t("callStats.qualityExcellent");
            case "good":
                return t("callStats.qualityGood");
            case "poor":
                return t("callStats.qualityPoor");
            case "lost":
                return t("callStats.qualityLost");
            default:
                return t("callStats.qualityUnknown");
        }
    }

    function sourceLabel(source: StreamSource): string {
        switch (source) {
            case "microphone":
                return t("callStats.sourceMicrophone");
            case "camera":
                return t("callStats.sourceCamera");
            case "screen_share":
                return t("callStats.sourceScreenShare");
            case "screen_share_audio":
                return t("callStats.sourceScreenShareAudio");
            default:
                return t("callStats.sourceUnknown");
        }
    }

    function streamTitle(s: RtpStreamSummary): string {
        const who =
            s.direction === "send"
                ? t("callStats.you")
                : s.identity
                  ? displayName(
                        s.identity.slice(0, s.identity.lastIndexOf(":")),
                    )
                  : "?";
        return `${who} · ${sourceLabel(s.source)}`;
    }

    function limitLabel(reason: string): string {
        switch (reason) {
            case "cpu":
                return t("callStats.limitCpu");
            case "bandwidth":
                return t("callStats.limitBandwidth");
            case "none":
                return t("callStats.limitNone");
            default:
                return t("callStats.limitOther");
        }
    }

    function limitTone(reason: string): StatTone {
        if (reason === "cpu") return "bad";
        return reason === "bandwidth" ? "warn" : "ok";
    }

    function implLabel(s: RtpStreamSummary): string {
        const kind =
            s.hardware === null
                ? ""
                : ` (${s.hardware ? t("callStats.hardware") : t("callStats.software")})`;
        return `${s.implementation ?? "?"}${kind}`;
    }

    function bitrateLabel(s: RtpStreamSummary): string {
        if (s.targetKbps === null || s.kind === "audio") return kbps(s.kbps);
        return t("callStats.bitrateTarget", {
            rate: kbps(s.kbps),
            target: kbps(s.targetKbps),
        });
    }

    const sendsVideo = (c: ConnectionView) =>
        c.streams.filter((s) => s.direction === "send" && s.kind === "video");
    const softwareEncode = $derived(
        connections?.some((c) =>
            sendsVideo(c).some((s) => s.hardware === false),
        ) ?? false,
    );
    const cpuLimited = $derived(
        connections?.some((c) =>
            sendsVideo(c).some((s) => s.qualityLimitation === "cpu"),
        ) ?? false,
    );

    const TONE_CLASS: Record<StatTone, string> = {
        ok: "text-discord-textPrimary",
        warn: "text-discord-warning",
        bad: "text-discord-danger",
    };

    const anyTcp = $derived(
        connections?.some(
            (c) =>
                (c.publisher && pathIsTcp(c.publisher.path)) ||
                (c.subscriber && pathIsTcp(c.subscriber.path)),
        ) ?? false,
    );

    const serverSwitchedTcp = $derived(
        connections?.some(
            (c) =>
                c.publisher?.serverOfferedNoUdp ||
                c.subscriber?.serverOfferedNoUdp,
        ) ?? false,
    );

    async function copyJson(): Promise<void> {
        const snapshot = {
            takenAt: new Date().toISOString(),
            userAgent: navigator.userAgent,
            connections: connections?.map((c) => ({
                server: c.raw.server,
                publishing: c.raw.publishing,
                state: c.raw.state,
                region: c.raw.region,
                serverVersion: c.raw.serverVersion,
                signalRttMs: c.raw.signalRttMs,
                localQuality: c.raw.localQuality,
                publisher: c.publisher,
                subscriber: c.subscriber,
                participants: c.participants.map((p) => ({
                    identity: p.identity,
                    quality: p.quality,
                    audioIn: p.audio?.audioIn ?? null,
                    intervalAudioLoss: p.audio?.intervalAudioLoss ?? null,
                })),
                streams: c.streams,
            })),
        };
        try {
            await navigator.clipboard.writeText(
                JSON.stringify(snapshot, null, 2),
            );
            showToast(t("callStats.copied"));
        } catch {
            showToast(t("callStats.copyFailed"));
        }
    }
</script>

{#snippet row(label: string, value: string, tone: StatTone = "ok")}
    <div class="flex justify-between gap-3 py-0.5">
        <dt class="text-discord-textMuted">{label}</dt>
        <dd class="font-mono text-end {TONE_CLASS[tone]}">{value}</dd>
    </div>
{/snippet}

{#snippet transport(title: string, s: TransportSummary | null)}
    <div class="min-w-0">
        <h4
            class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted mb-1"
        >
            {title}
        </h4>
        {#if !s}
            <p class="text-discord-textMuted">{t("callStats.noTransport")}</p>
        {:else}
            <dl>
                {@render row(
                    t("callStats.path"),
                    pathLabel(s.path),
                    pathTone(s.path),
                )}
                {@render row(
                    t("callStats.iceRtt"),
                    ms(s.iceRttMs),
                    rttTone(s.iceRttMs),
                )}
                {#if s.mediaRttMs !== null}
                    {@render row(
                        t("callStats.mediaRtt"),
                        ms(s.mediaRttMs),
                        rttTone(s.mediaRttMs),
                    )}
                {/if}
                {@render row(t("callStats.upload"), kbps(s.sendKbps))}
                {@render row(t("callStats.download"), kbps(s.recvKbps))}
                {#if s.availableOutgoingKbps !== null}
                    {@render row(
                        t("callStats.availableUpload"),
                        kbps(s.availableOutgoingKbps),
                    )}
                {/if}
                {#if s.outgoingLoss !== null}
                    {@render row(
                        t("callStats.outgoingLoss"),
                        pct(s.outgoingLoss),
                        lossTone(s.outgoingLoss),
                    )}
                {/if}
                {#if s.remoteAddress}
                    {@render row(t("callStats.remoteAddress"), s.remoteAddress)}
                {/if}
                {#if s.serverOfferedNoUdp}
                    {@render row(
                        t("callStats.serverCandidates"),
                        t("callStats.serverCandidatesNoUdp"),
                        "bad",
                    )}
                {/if}
                {#if s.localCandidateType}
                    {@render row(
                        t("callStats.candidates"),
                        `${s.localCandidateType} → ${s.remoteCandidateType ?? "?"}`,
                    )}
                {/if}
            </dl>
        {/if}
    </div>
{/snippet}

{#snippet stream(s: RtpStreamSummary)}
    <div class="min-w-0 rounded bg-discord-backgroundSecondary px-3 py-2">
        <h4 class="flex flex-wrap items-baseline gap-x-2 mb-1">
            <span class="font-medium text-discord-textPrimary"
                >{streamTitle(s)}</span
            >
            <span class="text-xs text-discord-textMuted">
                {s.direction === "send"
                    ? t("callStats.sent")
                    : t("callStats.received")}
                {#if s.rid}· {t("callStats.layer", { rid: s.rid })}{/if}
            </span>
        </h4>
        <dl class="text-xs">
            {@render row(t("callStats.codec"), codecLabel(s.codec))}
            {#if s.kind === "audio" && opusFeatures(s.codec?.fmtp ?? null).length}
                {@render row(
                    t("callStats.codecOptions"),
                    opusFeatures(s.codec?.fmtp ?? null).join(", "),
                )}
            {/if}
            {@render row(t("callStats.bitrate"), bitrateLabel(s))}
            {#if s.packetMs !== null}
                {@render row(
                    t("callStats.packetDuration"),
                    `${Math.round(s.packetMs)} ms`,
                )}
            {/if}
            {#if s.width && s.height}
                {@render row(
                    t("callStats.resolution"),
                    `${s.width}×${s.height}${s.fps !== null ? ` @ ${Math.round(s.fps)} fps` : ""}`,
                )}
            {/if}
            {#if s.implementation || s.hardware !== null}
                {@render row(
                    s.direction === "send"
                        ? t("callStats.encoder")
                        : t("callStats.decoder"),
                    implLabel(s),
                    s.kind === "video" && s.hardware === false ? "warn" : "ok",
                )}
            {/if}
            {#if s.qualityLimitation}
                {@render row(
                    t("callStats.limitedBy"),
                    limitLabel(s.qualityLimitation),
                    limitTone(s.qualityLimitation),
                )}
            {/if}
            {#if s.kind === "video" && s.frameTimeMs !== null}
                {@render row(t("callStats.frameTime"), ms(s.frameTimeMs))}
            {/if}
            {#if s.retransmitShare !== null && s.kind === "video"}
                {@render row(
                    t("callStats.resent"),
                    pct(s.retransmitShare),
                    lossTone(s.retransmitShare),
                )}
            {/if}
            {#if s.framesDropped}
                {@render row(
                    t("callStats.droppedFrames"),
                    String(s.framesDropped),
                )}
            {/if}
            {#if s.kind === "video" && (s.nackCount !== null || s.pliCount !== null)}
                {@render row(
                    t("callStats.nackPli"),
                    `${s.nackCount ?? "-"} / ${s.pliCount ?? "-"}`,
                )}
            {/if}
            {#if s.direction === "receive" && s.jitterMs !== null}
                {@render row(
                    t("callStats.jitter"),
                    ms(s.jitterMs),
                    jitterTone(s.jitterMs),
                )}
            {/if}
        </dl>
    </div>
{/snippet}

<Portal>
    <ModalDialog
        {onClose}
        labelledBy="call-stats-title"
        panelClass="relative bg-discord-background rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90dvh] flex flex-col"
    >
        <div
            class="flex items-center gap-2 px-5 py-3 border-b border-discord-divider flex-shrink-0"
        >
            <h2
                id="call-stats-title"
                class="text-lg font-bold text-discord-textPrimary"
            >
                {t("callStats.title")}
            </h2>
            <button
                onclick={() => void copyJson()}
                disabled={!connections?.length}
                class="ms-auto px-2.5 py-1 rounded text-sm bg-discord-backgroundSecondary text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-50"
            >
                {t("callStats.copyJson")}
            </button>
            <button
                onclick={onClose}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover"
                title={t("common.closeDialog")}
                aria-label={t("common.closeDialog")}
            >
                <X size={18} />
            </button>
        </div>

        <div class="overflow-y-auto px-5 py-4 space-y-4 text-sm">
            {#if connections === null}
                <p class="text-discord-textMuted">{t("callStats.loading")}</p>
            {:else if connections.length === 0}
                <p class="text-discord-textMuted">{t("callStats.notInCall")}</p>
            {:else}
                {#if serverSwitchedTcp}
                    <p
                        role="status"
                        class="rounded px-3 py-2 bg-discord-danger/15 text-discord-textPrimary"
                    >
                        {t("callStats.serverSwitchedTcp")}
                    </p>
                {:else if anyTcp}
                    <p
                        role="status"
                        class="rounded px-3 py-2 bg-discord-danger/15 text-discord-textPrimary"
                    >
                        {t("callStats.tcpWarning")}
                    </p>
                {/if}
                {#if cpuLimited}
                    <p
                        role="status"
                        class="rounded px-3 py-2 bg-discord-danger/15 text-discord-textPrimary"
                    >
                        {t("callStats.cpuLimitHint")}
                    </p>
                {/if}
                {#if softwareEncode}
                    <p
                        role="status"
                        class="rounded px-3 py-2 bg-discord-warning/15 text-discord-textPrimary"
                    >
                        {t("callStats.softwareEncodeHint")}
                    </p>
                {/if}
                {#each connections as c (c.raw.key)}
                    <section
                        class="rounded-lg border border-discord-divider p-3 space-y-3"
                    >
                        <div class="flex flex-wrap items-baseline gap-x-2">
                            <h3 class="font-semibold text-discord-textPrimary">
                                {c.raw.server}
                            </h3>
                            <span class="text-xs text-discord-textMuted">
                                {c.raw.publishing
                                    ? t("callStats.publishing")
                                    : t("callStats.listening")}
                                · {c.raw.state}
                                {#if c.raw.region}· {c.raw.region}{/if}
                                {#if c.raw.serverVersion}· v{c.raw
                                        .serverVersion}{/if}
                            </span>
                        </div>
                        <dl>
                            {@render row(
                                t("callStats.signalRtt"),
                                ms(c.raw.signalRttMs),
                                rttTone(c.raw.signalRttMs),
                            )}
                            {@render row(
                                t("callStats.yourQuality"),
                                qualityLabel(c.raw.localQuality),
                                qualityTone(c.raw.localQuality),
                            )}
                        </dl>
                        <div class="grid gap-4 sm:grid-cols-2">
                            {@render transport(
                                t("callStats.sending"),
                                c.publisher,
                            )}
                            {@render transport(
                                t("callStats.receiving"),
                                c.subscriber,
                            )}
                        </div>
                        {#if c.participants.length > 0}
                            <div class="overflow-x-auto">
                                <table class="w-full text-xs">
                                    <thead>
                                        <tr
                                            class="text-start text-discord-textMuted"
                                        >
                                            <th
                                                class="text-start font-medium py-1 pe-2"
                                                >{t(
                                                    "callStats.participant",
                                                )}</th
                                            >
                                            <th
                                                class="text-start font-medium py-1 pe-2"
                                                >{t(
                                                    "callStats.theirQuality",
                                                )}</th
                                            >
                                            <th
                                                class="text-end font-medium py-1 pe-2"
                                                >{t("callStats.loss")}</th
                                            >
                                            <th
                                                class="text-end font-medium py-1 pe-2"
                                                >{t("callStats.jitter")}</th
                                            >
                                            <th
                                                class="text-end font-medium py-1"
                                                >{t("callStats.buffer")}</th
                                            >
                                        </tr>
                                    </thead>
                                    <tbody class="font-mono">
                                        {#each c.participants as p (p.identity)}
                                            <tr
                                                class="border-t border-discord-divider"
                                            >
                                                <td
                                                    class="py-1 pe-2 font-sans text-discord-textPrimary truncate max-w-[12rem]"
                                                    title={p.identity}
                                                    >{p.name}</td
                                                >
                                                <td
                                                    class="py-1 pe-2 font-sans {TONE_CLASS[
                                                        qualityTone(p.quality)
                                                    ]}"
                                                    >{qualityLabel(
                                                        p.quality,
                                                    )}</td
                                                >
                                                <td
                                                    class="py-1 pe-2 text-end {TONE_CLASS[
                                                        lossTone(
                                                            p.audio
                                                                ?.intervalAudioLoss ??
                                                                null,
                                                        )
                                                    ]}"
                                                    >{pct(
                                                        p.audio
                                                            ?.intervalAudioLoss ??
                                                            null,
                                                    )}</td
                                                >
                                                <td
                                                    class="py-1 pe-2 text-end {TONE_CLASS[
                                                        jitterTone(
                                                            p.audio?.audioIn
                                                                .jitterMs ??
                                                                null,
                                                        )
                                                    ]}"
                                                    >{ms(
                                                        p.audio?.audioIn
                                                            .jitterMs ?? null,
                                                    )}</td
                                                >
                                                <td
                                                    class="py-1 text-end text-discord-textPrimary"
                                                    >{ms(
                                                        p.audio?.audioIn
                                                            .jitterBufferMs ??
                                                            null,
                                                    )}</td
                                                >
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {/if}
                        {#if c.streams.length > 0}
                            <div>
                                <h4
                                    class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted mb-1"
                                >
                                    {t("callStats.streams")}
                                </h4>
                                <div class="grid gap-2 sm:grid-cols-2">
                                    {#each c.streams as s (s.id)}
                                        {@render stream(s)}
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </section>
                {/each}
                <p class="text-xs text-discord-textMuted">
                    {t("callStats.legend")}
                </p>
            {/if}
        </div>
    </ModalDialog>
</Portal>
