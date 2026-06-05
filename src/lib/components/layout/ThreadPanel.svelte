<script lang="ts">
    import { tick } from "svelte";
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import MessageItem from "$lib/components/messages/MessageItem.svelte";
    import {
        getThreadMessages,
        getThreadSummary,
        sendThreadReply,
        onThreadEvent,
        onLocalEchoUpdated,
        getMemberName,
        getMemberAvatar,
        findEventById,
    } from "$lib/matrix/client";
    import { auth } from "$lib/stores/auth.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { format } from "date-fns";

    interface Props {
        room: Room;
        rootEventId: string;
        onClose: () => void;
    }

    let { room, rootEventId, onClose }: Props = $props();

    let scrollEl: HTMLDivElement | undefined = $state();
    let text = $state("");
    let isSending = $state(false);
    let textareaEl: HTMLTextAreaElement | undefined = $state();
    let threadTick = $state(0);

    function bump() {
        threadTick++;
    }

    // Re-read thread messages whenever tick changes
    const messages = $derived.by(() => {
        threadTick;
        return getThreadMessages(room, rootEventId);
    });

    const rootEvent = $derived(findEventById(room, rootEventId));
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
        return raw;
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

    async function send() {
        const trimmed = text.trim();
        if (!trimmed || isSending) return;
        isSending = true;
        try {
            await sendThreadReply(room.roomId, rootEventId, trimmed);
            text = "";
            if (textareaEl) textareaEl.style.height = "auto";
        } catch (err) {
            console.error("Failed to send thread reply:", err);
        } finally {
            isSending = false;
            textareaEl?.focus();
        }
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    function onInput() {
        if (!textareaEl) return;
        textareaEl.style.height = "auto";
        textareaEl.style.height = Math.min(textareaEl.scrollHeight, 160) + "px";
    }

    function formatTime(ts: number): string {
        return format(new Date(ts), "h:mm a");
    }
</script>

<div
    class="w-80 flex-shrink-0 flex flex-col border-l border-discord-divider bg-discord-background overflow-hidden"
>
    <!-- Header -->
    <div
        class="h-12 px-4 flex items-center justify-between border-b border-discord-divider flex-shrink-0"
    >
        <span class="font-semibold text-discord-textPrimary text-sm"
            >Thread</span
        >
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
                    >{formatTime(rootTs)}</span
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
        {#each messages as event, i (event.getId())}
            <MessageItem
                {event}
                {room}
                showHeader={shouldShowHeader(messages, i)}
                onReply={() => {}}
            />
        {/each}
    </div>

    <!-- Reply input -->
    <div class="px-3 pb-4 pt-2 flex-shrink-0">
        <div
            class="flex items-end gap-2 bg-discord-backgroundSecondary rounded-lg px-3 py-2 border border-transparent focus-within:border-discord-accent/30 transition-colors"
        >
            <textarea
                bind:this={textareaEl}
                bind:value={text}
                onkeydown={onKeydown}
                oninput={onInput}
                placeholder="Reply in thread…"
                rows="1"
                class="flex-1 bg-transparent text-discord-textPrimary placeholder-discord-textMuted resize-none outline-none text-sm leading-relaxed max-h-40 overflow-y-auto"
            ></textarea>
            <button
                onclick={send}
                disabled={!text.trim() || isSending}
                class="flex-shrink-0 p-1 rounded text-discord-textMuted hover:text-discord-textPrimary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Send reply"
            >
                {#if isSending}
                    <div
                        class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
                    ></div>
                {:else}
                    <svg
                        class="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                {/if}
            </button>
        </div>
        <p class="text-xs text-discord-textMuted mt-1 px-1">
            <kbd class="font-mono">Enter</kbd> to send &middot;
            <kbd class="font-mono">Shift+Enter</kbd> for new line
        </p>
    </div>
</div>
