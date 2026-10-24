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
        pathIsTcp,
        rttTone,
        lossTone,
        jitterTone,
        type CallPath,
        type StatTone,
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
    }

    let connections = $state<ConnectionView[] | null>(null);
    // Previous summary per transport / participant, for interval rates.
    const prev = new Map<string, TransportSummary>();

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
                {#if anyTcp}
                    <p
                        role="status"
                        class="rounded px-3 py-2 bg-discord-danger/15 text-discord-textPrimary"
                    >
                        {t("callStats.tcpWarning")}
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
                    </section>
                {/each}
                <p class="text-xs text-discord-textMuted">
                    {t("callStats.legend")}
                </p>
            {/if}
        </div>
    </ModalDialog>
</Portal>
