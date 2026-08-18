<script lang="ts">
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import { EventType } from "matrix-js-sdk";
    import {
        getClient,
        getRawUrlPreview,
        getRoomUnreadInfo,
    } from "$lib/matrix/client";
    import { getMessages } from "$lib/stores/messages.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { tick } from "svelte";

    interface Props {
        room: Room;
    }

    let { room }: Props = $props();

    let refreshTick = $state(0);

    function refresh() {
        refreshTick++;
    }

    // Visibility is toggled by the global Ctrl+Shift+D shortcut (+page.svelte).
    $effect(() => {
        if (interfaceState.debugOpen) refresh();
    });

    const syncState = $derived.by(() => {
        refreshTick;
        return getClient()?.getSyncState() ?? "N/A";
    });

    const allTimelineEvents = $derived.by(() => {
        refreshTick;
        return room.getLiveTimeline().getEvents();
    });

    const pendingEvents = $derived.by(() => {
        refreshTick;
        try {
            return room.getPendingEvents();
        } catch {
            return [];
        }
    });

    const filteredMessages = $derived.by(() => {
        refreshTick;
        return getMessages(room.roomId);
    });

    function statusLabel(status: string | null | undefined): string {
        if (!status) return "confirmed";
        return String(status);
    }

    function eventSummary(e: MatrixEvent) {
        const type = e.getType();
        const sender = e.getSender() ?? "?";
        const id = e.getId() ?? "?";
        const ts = e.getTs();
        const isRedacted = e.isRedacted();
        const status = statusLabel((e as any).status);
        const content = e.getContent();
        const relType = content?.["m.relates_to"]?.rel_type ?? null;
        return { type, sender, id, ts, isRedacted, status, content, relType };
    }

    function formatTs(ts: number): string {
        if (!ts) return "-";
        return new Date(ts).toLocaleTimeString();
    }

    function msgPreview(content: Record<string, unknown>): string {
        const body = content?.body as string | undefined;
        if (!body) return JSON.stringify(content).slice(0, 80);
        return body.slice(0, 60) + (body.length > 60 ? "…" : "");
    }

    const NOTIFICATION_EVENT_TYPES = [
        "m.room.message",
        "m.room.encrypted",
        "m.sticker",
    ];

    const pushRulesDebug = $derived.by(() => {
        refreshTick;
        const mx = getClient();
        if (!mx) return null;
        const rules = mx
            .getAccountData(EventType.PushRules)
            ?.getContent<{ global: Record<string, any[]> }>();
        return rules?.global ?? null;
    });

    const receiptsDebug = $derived.by(() => {
        refreshTick;
        const events = room.getLiveTimeline().getEvents();
        // Collect all events that have at least one receipt
        return events
            .map((e) => ({ event: e, receipts: room.getReceiptsForEvent(e) }))
            .filter(({ receipts }) => receipts.length > 0);
    });

    const unreadDebug = $derived.by(() => {
        refreshTick;
        const mx = getClient();
        const userId = mx?.getUserId() ?? null;
        const unreadInfo = getRoomUnreadInfo(room);
        const readUpToId = userId ? room.getEventReadUpTo(userId) : null;
        const events = room.getLiveTimeline().getEvents();
        const lastEvent = events[events.length - 1];
        const readIdx = readUpToId
            ? events.findLastIndex((e) => e.getId() === readUpToId)
            : -2;
        const notifEventsAfterRead =
            readIdx >= 0
                ? events
                      .slice(readIdx + 1)
                      .filter(
                          (e) =>
                              NOTIFICATION_EVENT_TYPES.includes(e.getType()) &&
                              !e.isRedacted() &&
                              e.getRelation()?.rel_type !== "m.replace",
                      )
                : [];
        return {
            unreadInfo,
            readUpToId,
            readIdx,
            lastEvent,
            userId,
            totalEvents: events.length,
            notifEventsAfterRead,
        };
    });

    let previewUrl = $state("");
    let previewResult = $state<Record<string, unknown> | null>(null);
    let previewLoading = $state(false);

    async function fetchPreview() {
        if (!previewUrl.trim()) return;
        previewLoading = true;
        previewResult = null;
        previewResult = await getRawUrlPreview(previewUrl.trim());
        previewLoading = false;
    }

    let copyDone = $state(false);
    function copyReport() {
        const lines: string[] = [];
        lines.push(`=== DEBUG REPORT ===`);
        lines.push(`Room: ${room.roomId}`);
        lines.push(`Sync state: ${syncState}`);
        lines.push(`\n--- TIMELINE (${allTimelineEvents.length} events) ---`);
        for (const e of allTimelineEvents) {
            const s = eventSummary(e);
            lines.push(
                `[${formatTs(s.ts)}] ${s.type} | ${s.sender} | status=${s.status} | redacted=${s.isRedacted} | relType=${s.relType ?? "-"} | id=${s.id}`,
            );
            lines.push(`  body: ${msgPreview(s.content)}`);
        }
        lines.push(`\n--- PENDING EVENTS (${pendingEvents.length}) ---`);
        for (const e of pendingEvents) {
            const s = eventSummary(e);
            lines.push(
                `[${formatTs(s.ts)}] ${s.type} | ${s.sender} | status=${s.status} | id=${s.id}`,
            );
            lines.push(`  body: ${msgPreview(s.content)}`);
        }
        lines.push(`\n--- STORE MESSAGES (${filteredMessages.length}) ---`);
        for (const e of filteredMessages) {
            const s = eventSummary(e);
            lines.push(
                `[${formatTs(s.ts)}] ${s.type} | ${s.sender} | status=${s.status} | id=${s.id}`,
            );
            lines.push(`  body: ${msgPreview(s.content)}`);
        }
        navigator.clipboard.writeText(lines.join("\n"));
        copyDone = true;
        setTimeout(() => (copyDone = false), 2000);
    }
</script>

{#if interfaceState.debugOpen}
    <div class="fixed inset-0 z-[9999] flex items-stretch pointer-events-none">
        <!-- Click-away overlay -->
        <div
            class="absolute inset-0 bg-black/40 pointer-events-auto"
            role="presentation"
            onclick={() => (interfaceState.debugOpen = false)}
        ></div>

        <!-- Panel -->
        <div
            class="relative ml-auto w-[600px] max-w-[90vw] bg-[#1a1a2e] text-[#e0e0e0] flex flex-col shadow-2xl pointer-events-auto overflow-hidden"
        >
            <!-- Header -->
            <div
                class="flex items-center justify-between px-3 py-2 bg-[#0d0d1a] border-b border-[#333] flex-shrink-0"
            >
                <span class="font-mono text-xs font-bold text-yellow-400"
                    >DEBUG PANEL</span
                >
                <div class="flex items-center gap-2">
                    <span class="font-mono text-xs text-gray-400"
                        >Sync: <span class="text-green-400">{syncState}</span
                        ></span
                    >
                    <button
                        onclick={refresh}
                        class="text-xs px-2 py-0.5 rounded bg-[#2a2a4a] hover:bg-[#3a3a5a] font-mono"
                        >↻ refresh</button
                    >
                    <button
                        onclick={copyReport}
                        class="text-xs px-2 py-0.5 rounded bg-[#2a4a2a] hover:bg-[#3a5a3a] font-mono"
                    >
                        {copyDone ? "✓ copied" : "⧉ copy"}
                    </button>
                    <button
                        onclick={() => (interfaceState.debugOpen = false)}
                        class="text-xs px-2 py-0.5 rounded bg-[#4a2a2a] hover:bg-[#5a3a3a] font-mono"
                        >✕</button
                    >
                </div>
            </div>

            <div class="flex-1 overflow-y-auto font-mono text-xs">
                <!-- Unread state -->
                <section>
                    <div
                        class="sticky top-0 px-3 py-1 bg-[#1a1a0d] border-b border-[#333] text-yellow-300 font-bold"
                    >
                        UNREAD STATE
                    </div>
                    <div class="px-3 py-2 flex flex-col gap-1">
                        <div>
                            <span class="text-gray-500">unread: </span>
                            <span
                                class:text-red-400={unreadDebug.unreadInfo
                                    .unread}
                                class:text-green-400={!unreadDebug.unreadInfo
                                    .unread}
                            >
                                {unreadDebug.unreadInfo.unread}
                            </span>
                            <span class="text-gray-500 ml-3">highlight: </span>
                            <span
                                class:text-red-400={unreadDebug.unreadInfo
                                    .highlight}
                                class:text-green-400={!unreadDebug.unreadInfo
                                    .highlight}
                            >
                                {unreadDebug.unreadInfo.highlight}
                            </span>
                        </div>
                        <div>
                            <span class="text-gray-500">userId: </span>
                            <span class="text-purple-300"
                                >{unreadDebug.userId ?? "none"}</span
                            >
                        </div>
                        <div>
                            <span class="text-gray-500">readUpToId: </span>
                            <span class="text-blue-300 break-all"
                                >{unreadDebug.readUpToId ?? "none"}</span
                            >
                        </div>
                        <div>
                            <span class="text-gray-500"
                                >readIdx in timeline:
                            </span>
                            <span
                                class:text-red-400={unreadDebug.readIdx === -1}
                                class:text-green-400={unreadDebug.readIdx >= 0}
                            >
                                {unreadDebug.readIdx === -2
                                    ? "no receipt"
                                    : unreadDebug.readIdx === -1
                                      ? "-1 (not in window!)"
                                      : unreadDebug.readIdx}
                            </span>
                            <span class="text-gray-500">
                                / {unreadDebug.totalEvents} events</span
                            >
                        </div>
                        <div>
                            <span class="text-gray-500"
                                >last event sender:
                            </span>
                            <span class="text-purple-300"
                                >{unreadDebug.lastEvent?.getSender() ??
                                    "none"}</span
                            >
                            <span class="text-gray-500 ml-2">(me: </span>
                            <span class="text-purple-300"
                                >{unreadDebug.userId}</span
                            >
                            <span class="text-gray-500">)</span>
                        </div>
                        <div>
                            <span class="text-gray-500"
                                >notification events after read marker:
                            </span>
                            <span
                                class:text-red-400={unreadDebug
                                    .notifEventsAfterRead.length > 0}
                                class:text-green-400={unreadDebug
                                    .notifEventsAfterRead.length === 0}
                            >
                                {unreadDebug.notifEventsAfterRead.length}
                            </span>
                        </div>
                        {#each unreadDebug.notifEventsAfterRead as e}
                            <div class="pl-4 text-[11px] text-orange-300">
                                [{formatTs(e.getTs())}] {e.getType()} from {e
                                    .getSender()
                                    ?.split(":")[0]} - {msgPreview(
                                    e.getContent(),
                                )}
                            </div>
                            <div
                                class="pl-4 text-[10px] text-gray-600 break-all"
                            >
                                {e.getId()}
                            </div>
                        {/each}
                    </div>
                </section>

                <!-- Push rules -->
                <section>
                    <div
                        class="sticky top-0 px-3 py-1 bg-[#0d1a0d] border-b border-[#333] text-green-300 font-bold"
                    >
                        PUSH RULES
                    </div>
                    {#if pushRulesDebug}
                        {#each Object.entries(pushRulesDebug) as [kind, rules]}
                            {#if rules.length > 0}
                                <div
                                    class="px-3 pt-2 pb-1 text-[11px] text-gray-500 uppercase tracking-wide"
                                >
                                    {kind}
                                </div>
                                {#each rules as rule}
                                    <div
                                        class="px-3 py-1 border-b border-[#1a1a1a] text-[11px]"
                                    >
                                        <div
                                            class="flex items-center gap-2 flex-wrap"
                                        >
                                            <span
                                                class:text-green-400={rule.enabled}
                                                class:text-red-400={!rule.enabled}
                                            >
                                                {rule.enabled ? "●" : "○"}
                                            </span>
                                            <span
                                                class="text-yellow-200 font-medium"
                                                >{rule.rule_id}</span
                                            >
                                            {#if rule.default}<span
                                                    class="text-gray-600"
                                                    >(default)</span
                                                >{/if}
                                        </div>
                                        <div class="pl-4 text-gray-400">
                                            actions: {JSON.stringify(
                                                rule.actions,
                                            )}
                                        </div>
                                        {#if rule.conditions}
                                            <div class="pl-4 text-gray-600">
                                                conditions: {JSON.stringify(
                                                    rule.conditions,
                                                )}
                                            </div>
                                        {/if}
                                    </div>
                                {/each}
                            {/if}
                        {/each}
                    {:else}
                        <div class="px-3 py-2 text-gray-600 italic">
                            no push rules found
                        </div>
                    {/if}
                </section>

                <!-- Read receipts -->
                <section>
                    <div
                        class="sticky top-0 px-3 py-1 bg-[#0d1a1a] border-b border-[#333] text-cyan-300 font-bold"
                    >
                        READ RECEIPTS ({receiptsDebug.length} events with receipts)
                    </div>
                    {#each receiptsDebug as { event, receipts }}
                        <div class="px-3 py-1 border-b border-[#1a1a1a]">
                            <div class="text-gray-400 text-[11px] truncate">
                                <span class="text-yellow-300"
                                    >{formatTs(event.getTs())}</span
                                >
                                <span class="text-blue-300 ml-2"
                                    >{event.getType()}</span
                                >
                                <span class="text-gray-600 ml-2 break-all"
                                    >{event.getId()}</span
                                >
                            </div>
                            {#each receipts as r}
                                <div class="pl-4 text-[11px] flex gap-2">
                                    <span class="text-purple-300"
                                        >{r.userId}</span
                                    >
                                    <span class="text-gray-500">{r.type}</span>
                                    {#if r.data?.ts}
                                        <span class="text-gray-600"
                                            >{formatTs(r.data.ts)}</span
                                        >
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/each}
                    {#if receiptsDebug.length === 0}
                        <div class="px-3 py-2 text-gray-600 italic">
                            no receipts
                        </div>
                    {/if}
                </section>

                <!-- URL Preview Inspector -->
                <section>
                    <div
                        class="sticky top-0 px-3 py-1 bg-[#1a0d1a] border-b border-[#333] text-pink-400 font-bold"
                    >
                        URL PREVIEW INSPECTOR
                    </div>
                    <div class="px-3 py-2 flex gap-2">
                        <input
                            bind:value={previewUrl}
                            onkeydown={(e) =>
                                e.key === "Enter" && fetchPreview()}
                            placeholder="https://..."
                            class="flex-1 bg-[#0d0d1a] border border-[#333] rounded px-2 py-1 text-[#e0e0e0] outline-none focus:border-pink-400 text-xs"
                        />
                        <button
                            onclick={fetchPreview}
                            disabled={previewLoading}
                            class="px-2 py-1 rounded bg-[#2a1a2a] hover:bg-[#3a2a3a] disabled:opacity-50 text-xs"
                        >
                            {previewLoading ? "…" : "fetch"}
                        </button>
                    </div>
                    {#if previewResult !== null}
                        <pre
                            class="px-3 pb-3 text-[11px] text-green-300 whitespace-pre-wrap break-all">{JSON.stringify(
                                previewResult,
                                null,
                                2,
                            )}</pre>
                    {/if}
                </section>

                <!-- Store messages -->
                <section>
                    <div
                        class="sticky top-0 px-3 py-1 bg-[#0d1a0d] border-b border-[#333] text-green-400 font-bold"
                    >
                        STORE MESSAGES ({filteredMessages.length}) - what the UI
                        renders
                    </div>
                    {#each filteredMessages as e, i}
                        {@const s = eventSummary(e)}
                        <div
                            class="px-3 py-1 border-b border-[#222] hover:bg-[#1f1f3a]"
                        >
                            <div class="flex gap-2 items-baseline">
                                <span class="text-gray-500">{i}</span>
                                <span class="text-yellow-300"
                                    >{formatTs(s.ts)}</span
                                >
                                <span class="text-blue-300">{s.type}</span>
                                <span class="text-purple-300"
                                    >{s.sender.split(":")[0]}</span
                                >
                                <span
                                    class="px-1 rounded text-[10px]"
                                    class:bg-green-900={s.status ===
                                        "confirmed"}
                                    class:bg-yellow-900={s.status !==
                                        "confirmed"}
                                >
                                    {s.status}
                                </span>
                                {#if s.isRedacted}<span class="text-red-400"
                                        >REDACTED</span
                                    >{/if}
                                {#if s.relType}<span class="text-orange-400"
                                        >rel={s.relType}</span
                                    >{/if}
                            </div>
                            <div class="text-gray-400 pl-4 truncate">
                                {msgPreview(s.content)}
                            </div>
                            <div
                                class="text-gray-600 pl-4 text-[10px] truncate"
                            >
                                {s.id}
                            </div>
                        </div>
                    {/each}
                    {#if filteredMessages.length === 0}
                        <div class="px-3 py-2 text-gray-600 italic">empty</div>
                    {/if}
                </section>

                <!-- Pending events -->
                <section>
                    <div
                        class="sticky top-0 px-3 py-1 bg-[#1a0d0d] border-b border-[#333] text-red-400 font-bold"
                    >
                        PENDING EVENTS ({pendingEvents.length})
                    </div>
                    {#each pendingEvents as e, i}
                        {@const s = eventSummary(e)}
                        <div
                            class="px-3 py-1 border-b border-[#222] hover:bg-[#1f1f3a]"
                        >
                            <div class="flex gap-2 items-baseline flex-wrap">
                                <span class="text-gray-500">{i}</span>
                                <span class="text-yellow-300"
                                    >{formatTs(s.ts)}</span
                                >
                                <span class="text-blue-300">{s.type}</span>
                                <span class="text-purple-300"
                                    >{s.sender.split(":")[0]}</span
                                >
                                <span
                                    class="px-1 rounded text-[10px] bg-yellow-900"
                                    >{s.status}</span
                                >
                                {#if s.relType}<span class="text-orange-400"
                                        >rel={s.relType}</span
                                    >{/if}
                            </div>
                            <div class="text-gray-400 pl-4 truncate">
                                {msgPreview(s.content)}
                            </div>
                            <div
                                class="text-gray-600 pl-4 text-[10px] truncate"
                            >
                                {s.id}
                            </div>
                        </div>
                    {/each}
                    {#if pendingEvents.length === 0}
                        <div class="px-3 py-2 text-gray-600 italic">empty</div>
                    {/if}
                </section>

                <!-- Full raw timeline -->
                <section>
                    <div
                        class="sticky top-0 px-3 py-1 bg-[#0d0d1a] border-b border-[#333] text-blue-400 font-bold"
                    >
                        RAW TIMELINE ({allTimelineEvents.length} events)
                    </div>
                    {#each allTimelineEvents as e, i}
                        {@const s = eventSummary(e)}
                        <div
                            class="px-3 py-1 border-b border-[#1a1a1a] hover:bg-[#1f1f3a]"
                        >
                            <div class="flex gap-2 items-baseline flex-wrap">
                                <span class="text-gray-500">{i}</span>
                                <span class="text-yellow-300"
                                    >{formatTs(s.ts)}</span
                                >
                                <span
                                    class:text-blue-300={s.type ===
                                        "m.room.message"}
                                    class:text-gray-500={s.type !==
                                        "m.room.message"}
                                >
                                    {s.type}
                                </span>
                                <span class="text-purple-300"
                                    >{s.sender.split(":")[0]}</span
                                >
                                {#if s.status !== "confirmed"}<span
                                        class="px-1 rounded text-[10px] bg-yellow-900"
                                        >{s.status}</span
                                    >{/if}
                                {#if s.isRedacted}<span class="text-red-400"
                                        >REDACTED</span
                                    >{/if}
                                {#if s.relType}<span class="text-orange-400"
                                        >rel={s.relType}</span
                                    >{/if}
                            </div>
                            {#if s.type === "m.room.message" || s.type === "m.sticker"}
                                <div class="text-gray-400 pl-4 truncate">
                                    {msgPreview(s.content)}
                                </div>
                            {/if}
                            <div
                                class="text-gray-600 pl-4 text-[10px] truncate"
                            >
                                {s.id}
                            </div>
                        </div>
                    {/each}
                </section>
            </div>
        </div>
    </div>
{/if}
