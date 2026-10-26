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
        diagnoseVideo,
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
        type VideoStatus,
        type VideoTrackDebug,
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
    interface VideoView {
        key: string;
        track: VideoTrackDebug;
        /** The RTP stream carrying it (the largest active layer when sent). */
        stream: RtpStreamSummary | null;
        status: VideoStatus;
        tone: StatTone;
        /** Frames decoded (received) or encoded (sent) per second, from the
         *  interval. */
        framesPerSec: number | null;
        /** Frames that arrived per second (received only). */
        receivedPerSec: number | null;
    }
    /** How a connection's traffic is routed (desktop proxy), PAC style. */
    interface RouteView {
        signalling: string | null;
        sending: string | null;
        receiving: string | null;
    }
    interface ConnectionView {
        raw: CallDebugConnection;
        publisher: TransportSummary | null;
        subscriber: TransportSummary | null;
        participants: ParticipantView[];
        /** Sent streams first, then received; inactive simulcast layers
         *  left out. */
        streams: RtpStreamSummary[];
        videos: VideoView[];
        routes: RouteView | null;
    }

    let connections = $state<ConnectionView[] | null>(null);
    // Previous summary per transport / participant, for interval rates.
    const prev = new Map<string, TransportSummary>();
    const prevStreams = new Map<string, RtpStreamSummary[]>();
    // Per video: its stream and painted-frame count at the previous poll.
    const prevVideo = new Map<
        string,
        { stream: RtpStreamSummary | null; elementFrames: number | null }
    >();

    function videosOf(
        c: CallDebugConnection,
        streams: RtpStreamSummary[],
    ): VideoView[] {
        return c.videos.map((v) => {
            const key = `${c.key}|v|${v.identity ?? "me"}|${v.source}`;
            const direction = v.identity === null ? "send" : "receive";
            const stream =
                streams
                    .filter(
                        (s) =>
                            s.kind === "video" &&
                            s.direction === direction &&
                            s.source === v.source &&
                            (direction === "send" || s.identity === v.identity),
                    )
                    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0] ?? null;
            const before = prevVideo.get(key);
            const { status, tone } = diagnoseVideo(
                v,
                stream,
                before?.stream?.id === stream?.id
                    ? (before?.stream ?? null)
                    : null,
                before?.elementFrames ?? null,
            );
            prevVideo.set(key, { stream, elementFrames: v.elementFrames });
            const dt =
                stream && before?.stream ? stream.at - before.stream.at : 0;
            const perSec = (now: number | null, then: number | null) =>
                dt > 0 && now !== null && then !== null && now >= then
                    ? ((now - then) * 1000) / dt
                    : null;
            return {
                key,
                track: v,
                stream,
                status,
                tone,
                framesPerSec: perSec(
                    stream?.frames ?? null,
                    before?.stream?.frames ?? null,
                ),
                receivedPerSec: perSec(
                    stream?.framesReceived ?? null,
                    before?.stream?.framesReceived ?? null,
                ),
            };
        });
    }

    /** Desktop only: ask main how each leg is routed right now. UDP never
     *  goes through a proxy, so only TCP media paths are asked about. */
    async function routesOf(
        c: CallDebugConnection,
        pub: TransportSummary | null,
        sub: TransportSummary | null,
    ): Promise<RouteView | null> {
        const route = window.desktop?.proxy?.route;
        if (!route) return null;
        const media = async (s: TransportSummary | null) => {
            if (!s?.remoteAddress) return null;
            if (s.path === "udp" || s.path === "relay-udp")
                return "DIRECT (UDP)";
            const addr = s.remoteAddress.includes("]")
                ? s.remoteAddress
                : s.remoteAddress.split(":").length > 2
                  ? `[${s.remoteAddress.replace(/:(\d+)$/, "]:$1")}`
                  : s.remoteAddress;
            return route(`https://${addr}/`).catch(() => null);
        };
        const [signalling, sending, receiving] = await Promise.all([
            c.sfuUrl ? route(c.sfuUrl).catch(() => null) : null,
            media(pub),
            media(sub),
        ]);
        return { signalling, sending, receiving };
    }

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
        connections = await Promise.all(
            raw.map(async (c) => {
                const publisher = fold(`${c.key}|pub`, c.publisher, at);
                const subscriber = fold(`${c.key}|sub`, c.subscriber, at);
                const streams = streamsOf(c, at);
                return {
                    raw: c,
                    publisher,
                    subscriber,
                    participants: c.participants.map((p) => ({
                        identity: p.identity,
                        name: displayName(p.userId),
                        quality: p.quality,
                        audio: fold(`${c.key}|p|${p.identity}`, p.audio, at),
                    })),
                    streams,
                    videos: videosOf(c, streams),
                    routes: await routesOf(c, publisher, subscriber),
                };
            }),
        );
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

    function videoStatusLabel(status: VideoStatus): string {
        switch (status) {
            case "checking":
                return t("callStats.videoChecking");
            case "sending":
                return t("callStats.videoSending");
            case "notSending":
                return t("callStats.videoNotSending");
            case "captureEnded":
                return t("callStats.videoCaptureEnded");
            case "captureStalled":
                return t("callStats.videoCaptureStalled");
            case "playing":
                return t("callStats.videoPlaying");
            case "notSubscribed":
                return t("callStats.videoNotSubscribed");
            case "hiddenByYou":
                return t("callStats.videoHiddenByYou");
            case "turnedOff":
                return t("callStats.videoTurnedOff");
            case "pausedByServer":
                return t("callStats.videoPausedByServer");
            case "noPackets":
                return t("callStats.videoNoPackets");
            case "cantDecrypt":
                return t("callStats.videoCantDecrypt");
            case "cantDecode":
                return t("callStats.videoCantDecode");
            case "notShown":
                return t("callStats.videoNotShown");
            case "notPainting":
                return t("callStats.videoNotPainting");
        }
    }

    function videoTitle(v: VideoView): string {
        const who = v.track.identity
            ? displayName(
                  v.track.identity.slice(0, v.track.identity.lastIndexOf(":")),
              )
            : t("callStats.you");
        return `${who} · ${sourceLabel(v.track.source)}`;
    }

    const fpsLabel = (v: number | null) =>
        v === null ? "-" : `${Math.round(v)} fps`;

    function routeLabel(r: string | null): string {
        if (!r) return "-";
        if (r.startsWith("DIRECT")) return t("callStats.routeDirect");
        return t("callStats.routeProxy", {
            proxy: r.split(";")[0].trim(),
        });
    }
    function routeTone(r: string | null): StatTone {
        return r && !r.startsWith("DIRECT") ? "warn" : "ok";
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
                videos: c.videos.map((v) => ({
                    ...v.track,
                    status: v.status,
                    framesPerSec: v.framesPerSec,
                    receivedPerSec: v.receivedPerSec,
                })),
                routes: c.routes,
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

{#snippet video(v: VideoView)}
    {@const tr = v.track}
    {@const s = v.stream}
    <div class="min-w-0 rounded bg-discord-backgroundSecondary px-3 py-2">
        <h4 class="font-medium text-discord-textPrimary mb-1">
            {videoTitle(v)}
        </h4>
        <p class="text-xs mb-1 {TONE_CLASS[v.tone]}">
            {videoStatusLabel(v.status)}
        </p>
        <dl class="text-xs">
            {#if tr.identity === null && tr.captureWidth && tr.captureHeight}
                {@render row(
                    t("callStats.capture"),
                    `${tr.captureWidth}×${tr.captureHeight}${tr.captureFps ? ` @ ${Math.round(tr.captureFps)} fps` : ""}${tr.displaySurface ? ` · ${tr.displaySurface}` : ""}`,
                )}
            {/if}
            {#if s}
                {@render row(t("callStats.codec"), codecLabel(s.codec))}
                {#if s.width && s.height}
                    {@render row(
                        t("callStats.resolution"),
                        `${s.width}×${s.height}`,
                    )}
                {/if}
                {#if tr.identity !== null}
                    {@render row(
                        t("callStats.framesArrivedDecoded"),
                        `${fpsLabel(v.receivedPerSec)} / ${fpsLabel(v.framesPerSec)}`,
                        v.status === "cantDecode" || v.status === "cantDecrypt"
                            ? "bad"
                            : "ok",
                    )}
                {:else}
                    {@render row(
                        t("callStats.framesEncoded"),
                        fpsLabel(v.framesPerSec),
                        v.status === "captureStalled" ? "bad" : "ok",
                    )}
                {/if}
                {#if s.implementation}
                    {@render row(
                        s.direction === "send"
                            ? t("callStats.encoder")
                            : t("callStats.decoder"),
                        implLabel(s),
                    )}
                {/if}
            {/if}
            {#if tr.identity !== null}
                {@render row(
                    t("callStats.onScreen"),
                    tr.elements === 0
                        ? t("callStats.onScreenNo")
                        : tr.elementWidth
                          ? `${tr.elementWidth}×${tr.elementHeight}`
                          : t("callStats.onScreenNoPicture"),
                )}
            {/if}
            {#if tr.decryptErrors > 0}
                {@render row(
                    t("callStats.decryptErrors"),
                    String(tr.decryptErrors),
                    "bad",
                )}
            {/if}
            {#if tr.trackMuted}
                {@render row(
                    t("callStats.trackState"),
                    t("callStats.trackNoFrames"),
                    "warn",
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
                        {#if c.routes}
                            <div>
                                <h4
                                    class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted mb-1"
                                >
                                    {t("callStats.proxyRoute")}
                                </h4>
                                <dl>
                                    {@render row(
                                        t("callStats.routeSignalling"),
                                        routeLabel(c.routes.signalling),
                                        routeTone(c.routes.signalling),
                                    )}
                                    {@render row(
                                        t("callStats.routeSending"),
                                        routeLabel(c.routes.sending),
                                        routeTone(c.routes.sending),
                                    )}
                                    {@render row(
                                        t("callStats.routeReceiving"),
                                        routeLabel(c.routes.receiving),
                                        routeTone(c.routes.receiving),
                                    )}
                                </dl>
                            </div>
                        {/if}
                        {#if c.videos.length > 0}
                            <div>
                                <h4
                                    class="text-xs font-semibold uppercase tracking-wide text-discord-textMuted mb-1"
                                >
                                    {t("callStats.video")}
                                </h4>
                                <div class="grid gap-2 sm:grid-cols-2">
                                    {#each c.videos as v (v.key)}
                                        {@render video(v)}
                                    {/each}
                                </div>
                            </div>
                        {/if}
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
