<script lang="ts">
    import { tick, untrack } from "svelte";
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import MessageItem from "$lib/components/messages/MessageItem.svelte";
    import {
        getThreadMessages,
        paginateThreadBack,
        onThreadEvent,
        onLocalEchoUpdated,
        getMemberName,
        getMemberAvatar,
        findEventById,
        markThreadRead,
    } from "$lib/matrix/client";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { timeOnly } from "$lib/utils/timeFormat";
    import { stripBodyFallback } from "$lib/utils/replyFallback";
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
            bump();
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
    const rootSender = $derived(
        rootEvent ? getMemberName(room, rootEvent.getSender() ?? "") : "",
    );
    const rootSenderId = $derived(rootEvent?.getSender() ?? null);
    const rootAvatar = $derived(
        rootEvent ? getMemberAvatar(room, rootEvent.getSender() ?? "") : null,
    );
    const rootBody = $derived.by(() => {
        if (!rootEvent) return "";
        const c = rootEvent.getContent();
        const raw: string = c?.body ?? "";
        // Strip the legacy rich-reply fallback ("> quoted…\n\n") when the root
        // is itself a reply — otherwise the header preview leads with the quote.
        const isReply =
            !!rootEvent.getOriginalContent()?.["m.relates_to"]?.[
                "m.in_reply_to"
            ];
        return isReply ? stripBodyFallback(raw) : raw;
    });
    const rootTs = $derived(rootEvent?.getTs() ?? 0);

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
    });

    // Scroll to bottom when messages change
    $effect(() => {
        messages; // track
        tick().then(() => {
            if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
        });
    });

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
            >Thread</span
        >
        <div class="flex items-center gap-1">
            {#if onToggleFullscreen}
                <button
                    onclick={onToggleFullscreen}
                    class="p-1.5 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                    title={fullscreen ? "Collapse thread" : "Expand thread"}
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
                title="Close thread"
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    />
                </svg>
            </button>
        </div>
    </div>

    <!-- Thread root message -->
    {#if rootEvent}
        <div
            class="px-4 py-3 border-b border-discord-divider flex-shrink-0 bg-discord-backgroundSecondary"
        >
            <div class="flex items-center gap-2 mb-1">
                <Avatar
                    src={rootAvatar}
                    name={rootSender}
                    id={rootSenderId}
                    size={20}
                />
                <span class="text-xs font-semibold text-discord-textPrimary"
                    >{rootSender}</span
                >
                <span class="text-xs text-discord-textMuted"
                    >{timeOnly(rootTs)}</span
                >
            </div>
            <p
                class="text-xs text-discord-textSecondary leading-relaxed line-clamp-3"
            >
                {rootBody}
            </p>
        </div>
    {/if}

    <!-- Replies -->
    <div bind:this={scrollEl} class="flex-1 overflow-y-auto py-2">
        {#if messages.length === 0}
            <p class="text-xs text-discord-textMuted text-center mt-4 px-4">
                No replies yet. Start the thread below.
            </p>
        {/if}
        {#if messages.length > 0 && !noMoreOlder}
            <div class="px-4 pb-2 text-center">
                <button
                    onclick={loadOlder}
                    disabled={loadingOlder}
                    class="text-xs text-discord-textMuted hover:text-discord-textPrimary disabled:opacity-40 transition-colors"
                >
                    {loadingOlder ? "Loading…" : "Load older replies"}
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
                onReply={() => {}}
                jumpToReply={() => {}}
            />
        {/each}
    </div>

    <!-- Reply input -->
    <div class="flex-shrink-0">
        <MessageInput
            roomId={room.roomId}
            roomName={room.name ?? ""}
            {room}
            threadRootId={rootEventId}
            composerKey={composerThreadKey(room.roomId, rootEventId)}
        />
    </div>
</div>
