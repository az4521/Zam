<script lang="ts">
    import { t } from "$lib/i18n";
    import { tick, untrack } from "svelte";
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import MessageItem from "$lib/components/messages/MessageItem.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { sedEditLastMessage } from "$lib/matrix/editMessage";
    import {
        getThreadMessages,
        paginateThreadBack,
        onThreadEvent,
        onLocalEchoUpdated,
        findEventById,
        markThreadRead,
    } from "$lib/matrix/client";
    import MessageInput from "$lib/components/messages/MessageInput.svelte";
    import { composerThreadKey } from "$lib/utils/threadContent";
    import { canSendReceipt } from "$lib/utils/receiptGate";

    interface Props {
        room: Room;
        rootEventId: string;
        onClose: () => void;
        /** Fill the container (thread replaces the timeline) instead of the w-80 side panel. */
        fullscreen?: boolean;
        /** Desktop only: show an expand/collapse toggle that flips fullscreen. */
        onToggleFullscreen?: () => void;
    }

    let {
        room,
        rootEventId,
        onClose,
        fullscreen = false,
        onToggleFullscreen,
    }: Props = $props();

    let scrollEl: HTMLDivElement | undefined = $state();
    let threadTick = $state(0);
    let loadingOlder = $state(false);
    let noMoreOlder = $state(false);
    let replyToEvent = $state<MatrixEvent | null>(null);
    let messageInputEl: { focus: () => void } | undefined = $state();
    // Plain (non-reactive) scroll bookkeeping for the auto-scroll effect below.
    let atBottom = true;
    let lastLatestId: string | null = null;

    function bump() {
        threadTick++;
    }

    async function loadOlder() {
        if (loadingOlder || noMoreOlder) return;
        // The panel is reused (no {#key}) when rootEventId changes, so it can
        // change while paginateThreadBack awaits. Capture it and drop a stale
        // result so thread A's "no more replies" verdict / lock is never applied
        // to thread B (F4).
        const rid = rootEventId;
        loadingOlder = true;
        try {
            const more = await paginateThreadBack(room, rootEventId);
            if (rootEventId !== rid) return;
            if (!more) noMoreOlder = true;
            // Keep the reader where they were: older replies land above, so
            // hold the distance from the bottom across the re-render.
            const fromBottom = scrollEl
                ? scrollEl.scrollHeight - scrollEl.scrollTop
                : 0;
            bump();
            await tick();
            if (scrollEl && rootEventId === rid)
                scrollEl.scrollTop = scrollEl.scrollHeight - fromBottom;
        } catch (err) {
            console.error("Failed to paginate thread:", err);
        } finally {
            if (rootEventId === rid) loadingOlder = false;
        }
    }

    // Re-read thread messages whenever tick changes
    const messages = $derived.by(() => {
        threadTick;
        return getThreadMessages(room, rootEventId);
    });

    // threadTick dependency is load-bearing for the "Create thread" flow: the
    // panel opens on a root whose remote echo hasn't landed in the timeline
    // yet, so the first lookup is null — without the tick this derived never
    // re-runs (stable room + id) and the header stays blank forever. The
    // localEchoUpdated subscription bumps the tick when the echo reconciles.
    const rootEvent = $derived.by(() => {
        threadTick;
        return findEventById(room, rootEventId);
    });
    // Subscribe to thread events
    $effect(() => {
        const unsub = onThreadEvent(bump);
        return unsub;
    });

    // Subscribe to local echo updates so pending sends appear immediately
    $effect(() => {
        const unsub = onLocalEchoUpdated((eventRoom: Room) => {
            if (eventRoom.roomId === room.roomId) bump();
        });
        return unsub;
    });

    // Mark the thread read when opened and whenever a new reply lands while it
    // is open. Threaded receipt only (⚑6) — does not touch main-timeline unread.
    // untrack() is load-bearing: sendReadReceipt fires every receipt listener
    // SYNCHRONOUSLY (bumpUnreadTick etc.), so any reactive read inside that
    // cascade would become a dependency of this effect while the cascade's
    // writes retrigger it — an infinite loop (effect_update_depth_exceeded)
    // that froze the whole panel. Track only the open thread + latest reply.
    $effect(() => {
        void rootEventId;
        void messages.length;
        untrack(() => {
            // Only claim the thread "read" when the user could actually see it —
            // window focused AND tab visible — mirroring the main-timeline gate
            // (receiptGate.ts / MessageArea markAsReadIfDisplayable). Without this
            // a threaded receipt fires while the window is hidden/unfocused (S-A2).
            if (
                canSendReceipt({
                    hasFocus: document.hasFocus(),
                    visible: document.visibilityState === "visible",
                })
            ) {
                markThreadRead(room, rootEventId).catch(() => {});
            }
        });
    });

    // Reset pagination flags when the panel retargets to a different thread root.
    // The panel is reused (no {#key}) across a rootEventId change, so without this
    // thread A's noMoreOlder hides "Load older replies" for thread B, and a
    // stranded loadingOlder leaves B's button disabled forever (F4).
    $effect(() => {
        void rootEventId;
        noMoreOlder = false;
        loadingOlder = false;
        replyToEvent = null;
        atBottom = true;
        lastLatestId = null;
    });

    // Follow the newest reply, but only when a new one actually arrives and
    // the reader is already at the bottom (or sent it). `messages` is re-read
    // on every thread/edit/redaction event in ANY room and when older replies
    // load, and none of those may yank someone reading further up.
    $effect(() => {
        const latest = messages[messages.length - 1];
        const latestId = latest?.getId() ?? null;
        if (latestId === lastLatestId) return;
        const first = lastLatestId === null;
        lastLatestId = latestId;
        const mine = !!latest && latest.getSender() === auth.userId;
        if (!first && !atBottom && !mine) return;
        tick().then(() => {
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
        });
    });

    function onScroll() {
        if (!scrollEl) return;
        atBottom =
            scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight <
            80;
    }

    function jumpToReply(eventId: string) {
        const el = scrollEl?.querySelector<HTMLElement>(
            `[data-event-id="${CSS.escape(eventId)}"]`,
        );
        if (!el) return;
        el.scrollIntoView({ block: "center" });
        el.classList.remove("message-highlight");
        void el.offsetWidth;
        el.classList.add("message-highlight");
        setTimeout(() => el.classList.remove("message-highlight"), 2000);
    }

    function shouldShowHeader(events: MatrixEvent[], index: number): boolean {
        if (index === 0) return true;
        const prev = events[index - 1];
        const curr = events[index];
        if (prev.getSender() !== curr.getSender()) return true;
        return curr.getTs() - prev.getTs() > 5 * 60 * 1000;
    }
</script>

<div
    class="{fullscreen
        ? 'w-full'
        : 'w-80 border-l'} h-full flex-shrink-0 flex flex-col border-discord-divider bg-discord-background overflow-hidden"
>
    <!-- Header -->
    <div
        class="h-12 px-4 flex items-center justify-between border-b border-discord-divider flex-shrink-0"
    >
        <span class="font-semibold text-discord-textPrimary text-sm"
            >{t("threadPanel.thread")}</span
        >
        <div class="flex items-center gap-1">
            {#if onToggleFullscreen}
                <button
                    onclick={onToggleFullscreen}
                    class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                    title={fullscreen
                        ? t("threadPanel.collapseThread")
                        : t("threadPanel.expandThread")}
                >
                    {#if fullscreen}
                        <svg
                            class="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M22 3.41 16.71 8.7 20 12h-8V4l3.29 3.29L20.59 2 22 3.41zM3.41 22l5.29-5.29L12 20v-8H4l3.29 3.29L2 20.59 3.41 22z"
                            />
                        </svg>
                    {:else}
                        <svg
                            class="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10L21 11z"
                            />
                        </svg>
                    {/if}
                </button>
            {/if}
            <button
                onclick={onClose}
                class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                title={t("threadPanel.closeThread")}
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
            </button>
        </div>
    </div>

    <!-- Thread root message, rendered like any other message (media,
         formatting, reactions) but capped so a long root can't push the
         replies off screen. -->
    {#if rootEvent}
        <div
            class="py-1 border-b border-discord-divider flex-shrink-0 bg-discord-backgroundSecondary max-h-60 overflow-y-auto"
        >
            <MessageItem
                event={rootEvent}
                {room}
                showHeader={true}
                onReply={(e) => {
                    replyToEvent = e;
                    messageInputEl?.focus();
                }}
                {jumpToReply}
            />
        </div>
    {/if}

    <!-- Replies -->
    <div
        bind:this={scrollEl}
        onscroll={onScroll}
        class="flex-1 overflow-y-auto py-2"
    >
        {#if messages.length === 0}
            <p class="text-xs text-discord-textMuted text-center mt-4 px-4">
                {t("threadPanel.noRepliesYetStartTheThread")}
            </p>
        {/if}
        {#if messages.length > 0 && !noMoreOlder}
            <div class="px-4 pb-2 text-center">
                <button
                    onclick={loadOlder}
                    disabled={loadingOlder}
                    class="text-xs text-discord-textMuted hover:text-discord-textPrimary disabled:opacity-40 transition-colors"
                >
                    {loadingOlder
                        ? t("common.loading")
                        : t("threadPanel.loadOlderReplies")}
                </button>
            </div>
        {/if}
        {#each messages as event, i (event.getId())}
            <MessageItem
                {event}
                {room}
                showHeader={shouldShowHeader(messages, i)}
                timelineEvents={messages}
                timelineIndex={i}
                onReply={(e) => {
                    replyToEvent = e;
                    messageInputEl?.focus();
                }}
                {jumpToReply}
            />
        {/each}
    </div>

    <!-- Reply input -->
    <div class="flex-shrink-0">
        <MessageInput
            bind:this={messageInputEl}
            roomId={room.roomId}
            roomName={room.name ?? ""}
            {room}
            threadRootId={rootEventId}
            {replyToEvent}
            onCancelReply={() => {
                replyToEvent = null;
            }}
            composerKey={composerThreadKey(room.roomId, rootEventId)}
            onSedEdit={(cmd) =>
                sedEditLastMessage(room, messages, auth.userId, cmd)}
        />
    </div>
</div>
