<script lang="ts">
    import { tick, untrack } from "svelte";
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import MessageItem from "$lib/components/messages/MessageItem.svelte";
    import {
        getThreadMessages,
        sendThreadReply,
        paginateThreadBack,
        onThreadEvent,
        onLocalEchoUpdated,
        getMemberName,
        getMemberAvatar,
        findEventById,
        markThreadRead,
        getRoomMembers,
        getOwnUserId,
        getCustomEmojis,
    } from "$lib/matrix/client";
    import { auth } from "$lib/stores/auth.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { timeOnly } from "$lib/utils/timeFormat";
    import { stripBodyFallback } from "$lib/utils/replyFallback";
    import { buildFormattedBody } from "$lib/utils/messageBody";
    import { roomsState } from "$lib/stores/rooms.svelte";

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
    let text = $state("");
    let isSending = $state(false);
    let textareaEl: HTMLTextAreaElement | undefined = $state();
    let threadTick = $state(0);
    let loadingOlder = $state(false);
    let noMoreOlder = $state(false);

    // Mention autocomplete (textarea-flavoured; mirrors MessageInput)
    let mentionQuery = $state<string | null>(null); // null = popup closed
    let mentionStart = $state(0); // index of "@" in `text`
    let mentionSelectedIdx = $state(0);
    // Map of "@label" → userId for mentions inserted in the current reply
    let pendingMentions = $state(new Map<string, string>());

    function bump() {
        threadTick++;
    }

    async function loadOlder() {
        if (loadingOlder || noMoreOlder) return;
        loadingOlder = true;
        try {
            const more = await paginateThreadBack(room, rootEventId);
            if (!more) noMoreOlder = true;
            bump();
        } catch (err) {
            console.error("Failed to paginate thread:", err);
        } finally {
            loadingOlder = false;
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

    const mentionCandidates = $derived.by(() => {
        if (mentionQuery === null || !room) return [];
        const q = mentionQuery.toLowerCase();
        const ownId = getOwnUserId();
        return getRoomMembers(room)
            .filter((m) => m.userId !== ownId)
            .filter(
                (m) =>
                    m.userId.toLowerCase().includes(q) ||
                    (m.rawDisplayName ?? "").toLowerCase().includes(q),
            )
            .slice(0, 8);
    });

    $effect(() => {
        // Clamp selection when the candidate list changes
        if (mentionSelectedIdx >= mentionCandidates.length)
            mentionSelectedIdx = 0;
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
        untrack(() => markThreadRead(room, rootEventId).catch(() => {}));
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

    function detectMentionQuery() {
        const pos = textareaEl?.selectionStart ?? text.length;
        const before = text.slice(0, pos);
        const m = before.match(/@(\S*)$/);
        if (m) {
            mentionQuery = m[1];
            mentionStart = pos - m[0].length;
        } else {
            mentionQuery = null;
        }
    }

    // The text shown after "@": normally the display name, but if another member
    // shares that display name it's ambiguous, so fall back to the full MXID.
    function mentionLabelFor(member: {
        userId: string;
        rawDisplayName?: string;
    }): string {
        const name = member.rawDisplayName?.trim();
        if (name && room) {
            const sharing = getRoomMembers(room).filter(
                (m) =>
                    (m.rawDisplayName ?? "").trim().toLowerCase() ===
                    name.toLowerCase(),
            );
            if (sharing.length <= 1) return name;
        } else if (name) {
            return name;
        }
        return member.userId.replace(/^@/, "");
    }

    function commitMention(member: {
        userId: string;
        rawDisplayName?: string;
    }) {
        const label = mentionLabelFor(member);
        const after = text.slice(
            mentionStart + 1 + (mentionQuery?.length ?? 0),
        );
        const before = text.slice(0, mentionStart);
        text = before + "@" + label + " " + after.replace(/^\S*/, "");
        pendingMentions = new Map([
            ...pendingMentions,
            ["@" + label, member.userId],
        ]);
        mentionQuery = null;
        tick().then(() => {
            const pos = mentionStart + 1 + label.length + 1;
            textareaEl?.focus();
            textareaEl?.setSelectionRange(pos, pos);
        });
    }

    async function send() {
        const trimmed = text.trim();
        if (!trimmed || isSending) return;
        isSending = true;
        const formatted = buildFormattedBody(trimmed, {
            mentions: pendingMentions,
            customEmojis: getCustomEmojis(room, roomsState.activeSpaceId),
        });
        const mentions =
            formatted.mentionedUserIds.length > 0
                ? { user_ids: formatted.mentionedUserIds }
                : undefined;
        try {
            await sendThreadReply(
                room.roomId,
                rootEventId,
                trimmed,
                mentions,
                formatted.html ?? undefined,
            );
            text = "";
            pendingMentions = new Map();
            mentionQuery = null;
            if (textareaEl) textareaEl.style.height = "auto";
        } catch (err) {
            console.error("Failed to send thread reply:", err);
        } finally {
            isSending = false;
            textareaEl?.focus();
        }
    }

    function onKeydown(e: KeyboardEvent) {
        // Mention popup nav — MUST precede the Enter-to-send branch so
        // Enter/Tab commits the highlighted mention instead of sending.
        if (mentionQuery !== null && mentionCandidates.length > 0) {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                mentionSelectedIdx =
                    (mentionSelectedIdx - 1 + mentionCandidates.length) %
                    mentionCandidates.length;
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                mentionSelectedIdx =
                    (mentionSelectedIdx + 1) % mentionCandidates.length;
                return;
            }
            if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                const member = mentionCandidates[mentionSelectedIdx];
                if (member) commitMention(member);
                return;
            }
            if (e.key === "Escape") {
                mentionQuery = null;
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    }

    function onInput() {
        if (!textareaEl) return;
        textareaEl.style.height = "auto";
        textareaEl.style.height = Math.min(textareaEl.scrollHeight, 160) + "px";
        detectMentionQuery();
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
                onReply={() => {}}
                jumpToReply={() => {}}
            />
        {/each}
    </div>

    <!-- Reply input -->
    <div class="px-3 pb-4 pt-2 flex-shrink-0">
        {#if mentionQuery !== null && mentionCandidates.length > 0}
            <div
                class="mb-1 bg-discord-backgroundSecondary border border-discord-divider rounded-lg overflow-hidden shadow-lg max-h-48 overflow-y-auto"
            >
                {#each mentionCandidates as member, i}
                    <button
                        onpointerdown={(e) => {
                            e.preventDefault();
                            commitMention(member);
                        }}
                        onpointerenter={() => (mentionSelectedIdx = i)}
                        class="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
                        class:bg-discord-messageHover={i === mentionSelectedIdx}
                    >
                        <Avatar
                            src={getMemberAvatar(room, member.userId)}
                            name={member.rawDisplayName || member.userId}
                            id={member.userId}
                            size={24}
                        />
                        <span
                            class="text-sm text-discord-textPrimary font-medium truncate"
                        >
                            {member.rawDisplayName || member.userId}
                        </span>
                        <span class="text-xs text-discord-textMuted truncate">
                            {member.userId}
                        </span>
                    </button>
                {/each}
            </div>
        {/if}
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
