<script lang="ts">
    import { tick, untrack } from "svelte";
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import { auth } from "$lib/stores/auth.svelte";
    import MessageItem from "$lib/components/messages/MessageItem.svelte";
    import MessageInput from "$lib/components/messages/MessageInput.svelte";
    import MemberList from "$lib/components/layout/MemberList.svelte";
    import DebugPanel from "$lib/components/debug/DebugPanel.svelte";
    import {
        getTimelineMessages,
        getLatestTimelineEvent,
        onTimelineEvent,
        onLocalEchoUpdated,
        onSyncPrepared,
        onReactionEvent,
        onEditEvent,
        onRedactionEvent,
        loadPreviousMessages,
        loadMessagesUntilEvent,
        loadContextAroundEvent,
        getRoomDisplayName,
        getRoomTopic,
        sendReadReceipt,
        getTombstone,
        joinRoom,
        getRoom,
        getReadUpToEventId,
        getReceiptsForEvent,
        onReceiptEvent,
    } from "$lib/matrix/client";
    import { setActiveRoom } from "$lib/stores/rooms.svelte";
    import {
        getMessages,
        setMessages,
        appendMessage,
        canLoadMore,
        setCanLoadMore,
        bumpReactionTick,
    } from "$lib/stores/messages.svelte";
    import { bumpUnreadTick, roomsState } from "$lib/stores/rooms.svelte";
    import { mobileState } from "$lib/stores/mobile.svelte";
    import RoomSettings from "$lib/components/layout/RoomSettings.svelte";
    import PinnedMessagesPanel from "$lib/components/layout/PinnedMessagesPanel.svelte";
    import NotificationsPanel from "$lib/components/layout/NotificationsPanel.svelte";
    import {
        getPinnedEventIds,
        findEventById,
        isLoudEvent,
    } from "$lib/matrix/client";
    import { preventDefault } from "svelte/legacy";

    interface Props {
        room: Room;
        isMobile?: boolean;
        onMenuOpen?: () => void;
    }

    let { room, isMobile = false, onMenuOpen }: Props = $props();

    let scrollEl: HTMLDivElement | undefined = $state();
    let bottomAnchorEl: HTMLDivElement | undefined = $state();
    let messageInputEl: ReturnType<typeof MessageInput> | undefined = $state();
    let isAtBottom = $state(true);
    let loadingOlder = $state(false);
    let replyToEvent = $state<MatrixEvent | null>(null);
    let editRequestedEventId = $state<string | null>(null);
    let isDragOver = $state(false);
    let intervalId: number | undefined = $state();
    let dragCounter = 0; // track enter/leave pairs to avoid flicker on child elements

    function onDragEnter(e: DragEvent) {
        if (!e.dataTransfer?.types.includes("Files")) return;
        dragCounter++;
        isDragOver = true;
    }

    function onDragLeave() {
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            isDragOver = false;
        }
    }

    function onDragOver(e: DragEvent) {
        if (!e.dataTransfer?.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        dragCounter = 0;
        isDragOver = false;
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            messageInputEl?.addFiles([...files]);
        }
    }

    async function requestEditLastMessage() {
        const editable = messages.filter(
            (e) =>
                e.getSender() === auth.userId &&
                e.getType() === "m.room.message" &&
                e.getContent()?.msgtype === "m.text" &&
                e.getId(),
        );
        if (editable.length === 0) return;
        editRequestedEventId = editable[editable.length - 1].getId()!;
        await tick();
        editRequestedEventId = null;
    }
    // untrack avoids the "captures initial value" warning - we intentionally want the initial prop value
    let showMemberList = $state(false);
    let showRoomSettings = $state(false);
    let showPinnedPanel = $state(false);
    let showNotificationsPanel = $state(false);
    const showRightPanel = $derived(showPinnedPanel || showNotificationsPanel);
    const pinnedCount = $derived.by(() => {
        void roomsState.roomsTick;
        return getPinnedEventIds(room).length;
    });

    let jumpingToEventId = $state<string | null>(null);

    async function scrollToMessage(eventId: string) {
        let el = document.querySelector(`[data-event-id="${eventId}"]`);
        if (!el) {
            jumpingToEventId = eventId;
            try {
                const ctx = await loadContextAroundEvent(room, eventId);
                if (ctx) {
                    contextMessages = ctx;
                    await tick();
                }
            } finally {
                jumpingToEventId = null;
            }
            el = document.querySelector(`[data-event-id="${eventId}"]`);
            if (!el) return;
        }
        const target = el as HTMLElement;
        intervalId = setInterval(
            () =>
                target.scrollIntoView({ behavior: "smooth", block: "center" }),
            50,
        );
        target.classList.remove("message-highlight");
        void target.offsetWidth;
        target.classList.add("message-highlight");
        setTimeout(() => {
            target.classList.remove("message-highlight");
            clearInterval(intervalId);
        }, 2000);
    }
    let joiningUpgrade = $state(false);

    const tombstone = $derived(getTombstone(room));
    const replacementAlreadyJoined = $derived(
        tombstone
            ? getRoom(tombstone.replacementRoomId)?.getMyMembership() === "join"
            : false,
    );

    async function joinUpgrade() {
        if (!tombstone) return;
        if (replacementAlreadyJoined) {
            setActiveRoom(tombstone.replacementRoomId);
            return;
        }
        joiningUpgrade = true;
        try {
            await joinRoom(tombstone.replacementRoomId);
            setActiveRoom(tombstone.replacementRoomId);
        } catch (e) {
            console.error("Failed to join replacement room", e);
        } finally {
            joiningUpgrade = false;
        }
    }

    // Hide member list when switching to mobile (isMobile is set async in onMount)
    $effect(() => {
        if (isMobile) showMemberList = false;
    });

    // Keep global rightOpen in sync so left drawer can avoid conflicting gestures
    $effect(() => {
        mobileState.rightOpen = isMobile && (showMemberList || showRightPanel);
    });

    // Animated right drawer (mobile member list)
    const MEMBER_WIDTH = 280;
    let memberTranslate = $state(MEMBER_WIDTH);
    let isMemberDragging = $state(false);
    let memberDragPending = false;
    let memberDragStartX = 0;
    let memberDragStartY = 0;
    let memberDragBase = 0;

    $effect(() => {
        if (!isMemberDragging) {
            memberTranslate = showMemberList ? 0 : MEMBER_WIDTH;
        }
    });

    const memberBackdropOpacity = $derived(
        isMobile ? ((MEMBER_WIDTH - memberTranslate) / MEMBER_WIDTH) * 0.5 : 0,
    );

    function memberDragMove(e: TouchEvent) {
        if (!memberDragPending && !isMemberDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - memberDragStartX;
        const dy = touch.clientY - memberDragStartY;

        if (memberDragPending) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (Math.abs(dy) > Math.abs(dx)) {
                memberDragPending = false;
                cleanupMemberListeners();
                return;
            }
            const openingGesture = dx < 0 && !showMemberList;
            const closingGesture = dx > 0 && showMemberList;
            if (!openingGesture && !closingGesture) {
                memberDragPending = false;
                cleanupMemberListeners();
                return;
            }
            memberDragPending = false;
            isMemberDragging = true;
            (document.activeElement as HTMLElement)?.blur();
        }

        if (isMemberDragging) {
            e.preventDefault();
            memberTranslate = Math.max(
                0,
                Math.min(MEMBER_WIDTH, memberDragBase + dx),
            );
        }
    }

    function memberDragEnd() {
        memberDragPending = false;
        cleanupMemberListeners();
        if (!isMemberDragging) return;
        isMemberDragging = false;
        const progress = (MEMBER_WIDTH - memberTranslate) / MEMBER_WIDTH;
        const startedOpen = memberDragBase === 0;
        showMemberList = startedOpen ? progress >= 0.75 : progress > 0.25;
        memberTranslate = showMemberList ? 0 : MEMBER_WIDTH;
    }

    function cleanupMemberListeners() {
        document.removeEventListener("touchmove", memberDragMove);
        document.removeEventListener("touchend", memberDragEnd);
        document.removeEventListener("touchcancel", memberDragEnd);
    }

    function memberDragStart(e: TouchEvent) {
        if (
            !isMobile ||
            isMemberDragging ||
            memberDragPending ||
            mobileState.leftOpen ||
            mobileState.lightboxOpen ||
            mobileState.settingsOpen ||
            showRightPanel
        )
            return;
        memberDragStartX = e.touches[0].clientX;
        memberDragStartY = e.touches[0].clientY;
        memberDragBase = showMemberList ? 0 : MEMBER_WIDTH;
        memberDragPending = true;
        document.addEventListener("touchmove", memberDragMove, {
            passive: false,
        });
        document.addEventListener("touchend", memberDragEnd);
        document.addEventListener("touchcancel", memberDragEnd);
    }

    // Animated right drawer (mobile pinned panel)
    const PINNED_WIDTH = 280;
    let pinnedTranslate = $state(PINNED_WIDTH);
    let isPinnedDragging = $state(false);
    let pinnedDragPending = false;
    let pinnedDragStartX = 0;
    let pinnedDragStartY = 0;
    let pinnedDragBase = 0;

    $effect(() => {
        if (!isPinnedDragging) {
            pinnedTranslate = showRightPanel ? 0 : PINNED_WIDTH;
        }
    });

    const pinnedBackdropOpacity = $derived(
        isMobile ? ((PINNED_WIDTH - pinnedTranslate) / PINNED_WIDTH) * 0.5 : 0,
    );

    function pinnedDragMove(e: TouchEvent) {
        if (!pinnedDragPending && !isPinnedDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - pinnedDragStartX;
        const dy = touch.clientY - pinnedDragStartY;
        if (pinnedDragPending) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (Math.abs(dy) > Math.abs(dx) || dx <= 0) {
                pinnedDragPending = false;
                cleanupPinnedListeners();
                return;
            }
            pinnedDragPending = false;
            isPinnedDragging = true;
            (document.activeElement as HTMLElement)?.blur();
        }
        if (isPinnedDragging) {
            e.preventDefault();
            pinnedTranslate = Math.max(
                0,
                Math.min(PINNED_WIDTH, pinnedDragBase + dx),
            );
        }
    }

    function pinnedDragEnd() {
        pinnedDragPending = false;
        cleanupPinnedListeners();
        if (!isPinnedDragging) return;
        isPinnedDragging = false;
        const progress = (PINNED_WIDTH - pinnedTranslate) / PINNED_WIDTH;
        const stayOpen = progress > 0.75; // close if dragged more than 25% away
        if (!stayOpen) {
            showPinnedPanel = false;
            showNotificationsPanel = false;
        }
        pinnedTranslate = stayOpen ? 0 : PINNED_WIDTH;
    }

    function cleanupPinnedListeners() {
        document.removeEventListener("touchmove", pinnedDragMove);
        document.removeEventListener("touchend", pinnedDragEnd);
        document.removeEventListener("touchcancel", pinnedDragEnd);
    }

    function pinnedDragStart(e: TouchEvent) {
        if (
            !isMobile ||
            !showRightPanel ||
            isPinnedDragging ||
            pinnedDragPending ||
            mobileState.leftOpen ||
            mobileState.lightboxOpen ||
            showMemberList
        )
            return;
        pinnedDragStartX = e.touches[0].clientX;
        pinnedDragStartY = e.touches[0].clientY;
        pinnedDragBase = 0;
        pinnedDragPending = true;
        document.addEventListener("touchmove", pinnedDragMove, {
            passive: false,
        });
        document.addEventListener("touchend", pinnedDragEnd);
        document.addEventListener("touchcancel", pinnedDragEnd);
    }

    const roomId = $derived(room.roomId);
    const roomName = $derived(getRoomDisplayName(room));
    const topic = $derived(getRoomTopic(room));
    let contextMessages = $state<MatrixEvent[] | null>(null);
    const messages = $derived(contextMessages ?? getMessages(roomId));
    const reversedMessages = $derived(messages.toReversed());
    const isContextView = $derived(contextMessages !== null);

    // The event ID the user has read up to — used to show "New messages" divider on load
    let unreadMarkerEventId = $state<string | null>(null);

    // Clear reply and context view when switching rooms
    $effect(() => {
        room.roomId; // track room changes
        replyToEvent = null;
        contextMessages = null;
    });

    // Load messages when room changes — always reload from SDK state (fast, in-memory)
    $effect(() => {
        const id = room.roomId; // track room changes
        let readUpTo: string | null = null;
        untrack(() => {
            const events = getTimelineMessages(room);
            setMessages(id, events);
            // Determine if there are unread messages by checking read marker vs last event
            const marker = getReadUpToEventId(room);
            const lastEventId = events[events.length - 1]?.getId();
            if (marker && marker !== lastEventId) {
                readUpTo = marker;
            }
        });
        unreadMarkerEventId = readUpTo;
        tick().then(() => {
            if (readUpTo) {
                // Scroll so the first unread message is visible near the top
                const markerEl = document.querySelector(
                    `[data-event-id="${readUpTo}"]`,
                );
                if (markerEl && scrollEl) {
                    markerEl.scrollIntoView({ block: "end" });
                } else {
                    scrollToBottom(true);
                }
            } else {
                scrollToBottom(true);
            }
            // If the scroll area isn't tall enough to scroll, onScroll never fires,
            // so markAsRead() is never called. Handle that here.
            if (scrollEl && scrollEl.scrollHeight <= scrollEl.clientHeight) {
                markAsRead();
            }
            autoFillMessages();
        });
    });

    // Reload messages once the initial sync completes (catches messages missed during SYNCING state)
    $effect(() => {
        const currentRoom = room;
        const currentRoomId = roomId;
        const unsub = onSyncPrepared(() => {
            setMessages(currentRoomId, getTimelineMessages(currentRoom));
            autoFillMessages();
            if (isAtBottom) markAsRead();
        });
        return unsub;
    });

    // Subscribe to new live timeline events (incoming and confirmed own messages)
    $effect(() => {
        const currentRoomId = roomId; // capture for closure
        const unsub = onTimelineEvent((event: MatrixEvent, eventRoom: Room) => {
            bumpUnreadTick();
            if (eventRoom.roomId === currentRoomId) {
                appendMessage(currentRoomId, event);
                if (isAtBottom) {
                    tick().then(() => scrollToBottom(false));
                }
            }
        });
        return unsub;
    });

    // Subscribe to local echo updates (own pending messages in Detached ordering mode)
    $effect(() => {
        const currentRoomId = roomId;
        const unsub = onLocalEchoUpdated((eventRoom: Room) => {
            if (eventRoom.roomId === currentRoomId) {
                setMessages(currentRoomId, getTimelineMessages(room));
                if (isAtBottom) {
                    tick().then(() => scrollToBottom(false));
                }
            }
        });
        return unsub;
    });

    // Subscribe to reaction and edit events to trigger re-renders
    $effect(() => {
        const currentRoomId = roomId;
        const unsubReaction = onReactionEvent(
            (_event: MatrixEvent, eventRoom: Room) => {
                if (eventRoom.roomId === currentRoomId) bumpReactionTick();
            },
        );
        const unsubEdit = onEditEvent(
            (_event: MatrixEvent, eventRoom: Room) => {
                if (eventRoom.roomId === currentRoomId) bumpReactionTick();
            },
        );
        return () => {
            unsubReaction();
            unsubEdit();
        };
    });

    // Subscribe directly on the room object for redaction events (client does not re-emit these)
    $effect(() => {
        const currentRoom = room;
        const currentRoomId = roomId;
        const unsub = onRedactionEvent(currentRoom, () => {
            setMessages(currentRoomId, getTimelineMessages(currentRoom));
            bumpReactionTick();
        });
        return unsub;
    });

    let receiptTick = $state(0);
    $effect(() => {
        const currentRoom = room;
        return onReceiptEvent(currentRoom, () => {
            receiptTick++;
        });
    });

    function markAsRead() {
        const currentRoom = room;
        const last = getLatestTimelineEvent(currentRoom);
        sendReadReceipt(last).catch(() => {});
        bumpUnreadTick();
        unreadMarkerEventId = null;
    }

    function scrollToBottom(instant: boolean) {
        if (!scrollEl) return;
        scrollEl.scrollTo({
            top: scrollEl.scrollHeight,
            behavior: instant ? "instant" : "smooth",
        });
        markAsRead();
    }

    function onScroll() {
        if (!scrollEl) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        const wasAtBottom = isAtBottom;
        isAtBottom = scrollTop > -100;

        if (!wasAtBottom && isAtBottom) markAsRead();

        // Load older messages when near the visual top (scrollTop near 0)
        if (scrollTop < -(scrollHeight - clientHeight) + 100 && !loadingOlder) {
            loadOlderMessages();
        }
    }

    async function loadOlderMessages() {
        if (loadingOlder || !canLoadMore(roomId) || isContextView) return;
        loadingOlder = true;
        const prevScrollTop = scrollEl?.scrollTop ?? 0;
        const prevScrollHeight = scrollEl?.scrollHeight ?? 0;

        try {
            const hasMore = await loadPreviousMessages(room);
            if (!hasMore) setCanLoadMore(roomId, false);
            const events = getTimelineMessages(room);
            setMessages(roomId, events);

            // flex-col-reverse: older content appended at DOM end = high scrollTop end
            // Keep current view stable by adding the new height delta to scrollTop
            await tick();
            if (scrollEl) {
                scrollEl.scrollTop =
                    prevScrollTop + (scrollEl.scrollHeight - prevScrollHeight);
            }
        } finally {
            loadingOlder = false;
        }
    }

    // Keep paginating until the content fills the viewport (or no more history)
    async function autoFillMessages() {
        await tick();
        while (
            scrollEl &&
            canLoadMore(roomId) &&
            scrollEl.scrollHeight <= scrollEl.clientHeight
        ) {
            await loadOlderMessages();
            await tick();
        }
    }

    // Group consecutive messages from the same sender (within 5 min)
    function shouldShowHeader(events: MatrixEvent[], index: number): boolean {
        if (index + 1 >= events.length) return true;
        const prev = events[index + 1];
        const curr = events[index];
        if (prev.getSender() !== curr.getSender()) return true;
        const timeDiff = curr.getTs() - prev.getTs();
        return timeDiff > 5 * 60 * 1000;
    }

    // Group messages by date for date separators
    function getDateLabel(ts: number): string | null {
        const d = new Date(ts);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === today.toDateString()) return null;
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
        return d.toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    }

    function showDateSeparator(
        events: MatrixEvent[],
        index: number,
    ): string | null {
        if (index === 0) return getDateLabel(events[0].getTs());
        const prev = new Date(events[index - 1].getTs()).toDateString();
        const curr = new Date(events[index].getTs()).toDateString();
        if (prev !== curr) return getDateLabel(events[index].getTs());
        return null;
    }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="flex flex-1 min-w-0 overflow-hidden relative"
    ondragenter={onDragEnter}
    ondragleave={onDragLeave}
    ondragover={onDragOver}
    ondrop={onDrop}
    ontouchstart={(e) => {
        memberDragStart(e);
        pinnedDragStart(e);
    }}
>
    <!-- Drop overlay -->
    {#if isDragOver}
        <div
            class="absolute inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
            <div
                class="absolute inset-2 rounded-xl border-2 border-dashed border-discord-accent bg-discord-accent/10"
            ></div>
            <div
                class="relative flex flex-col items-center gap-2 text-discord-accent"
            >
                <svg
                    class="w-12 h-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                </svg>
                <p class="text-lg font-semibold">Drop to attach</p>
            </div>
        </div>
    {/if}

    <!-- Main chat area -->
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Room header -->
        <div
            class="h-12 px-4 flex items-center gap-3 border-b border-discord-divider shadow-sm flex-shrink-0"
        >
            {#if isMobile}
                <button
                    onclick={onMenuOpen}
                    class="p-1.5 -ml-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
                    title="Open room list"
                >
                    <svg
                        class="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
                        />
                    </svg>
                </button>
            {/if}
            <span class="text-xl font-bold text-discord-textMuted flex-shrink-0"
                >#</span
            >
            <h2 class="font-semibold text-discord-textPrimary">{roomName}</h2>
            {#if topic}
                <div class="w-px h-5 bg-discord-divider"></div>
                <p class="text-sm text-discord-textMuted truncate flex-1">
                    {topic}
                </p>
            {/if}
            {#if !topic}<div class="flex-1"></div>{/if}
            <!-- Pinned messages button -->
            <button
                onclick={() => {
                    showPinnedPanel = !showPinnedPanel;
                    if (showPinnedPanel) {
                        showMemberList = false;
                        showNotificationsPanel = false;
                    }
                }}
                class="p-1.5 rounded transition-colors {showPinnedPanel
                    ? 'text-discord-accent bg-discord-messageHover'
                    : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                title="Pinned messages{pinnedCount > 0
                    ? ` (${pinnedCount})`
                    : ''}"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"
                    ><path
                        d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"
                    /></svg
                >
            </button>
            <!-- Notifications inbox button -->
            <button
                onclick={() => {
                    showNotificationsPanel = !showNotificationsPanel;
                    if (showNotificationsPanel) {
                        showMemberList = false;
                        showPinnedPanel = false;
                    }
                }}
                class="p-1.5 rounded transition-colors {showNotificationsPanel
                    ? 'text-discord-accent bg-discord-messageHover'
                    : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                title="Notifications inbox"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"
                    ><path
                        d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                    /></svg
                >
            </button>
            <!-- Toggle member list -->
            <button
                onclick={() => {
                    showMemberList = !showMemberList;
                    if (showMemberList) {
                        showPinnedPanel = false;
                        showNotificationsPanel = false;
                    }
                }}
                class="p-1.5 rounded transition-colors {showMemberList
                    ? 'text-discord-accent bg-discord-messageHover'
                    : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                title="Toggle member list"
            >
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path
                        d="M14 6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM1 14.25C1 12.455 2.455 11 4.25 11h7.5C13.545 11 15 12.455 15 14.25v.25a.75.75 0 0 1-.75.75H1.75A.75.75 0 0 1 1 14.5v-.25Zm17.25-5.75a.75.75 0 0 1 .75.75v2h2a.75.75 0 0 1 0 1.5h-2v2a.75.75 0 0 1-1.5 0v-2h-2a.75.75 0 0 1 0-1.5h2v-2a.75.75 0 0 1 .75-.75Z"
                    />
                </svg>
            </button>
        </div>

        <!-- Messages scrollable area -->
        <div
            bind:this={scrollEl}
            onscroll={onScroll}
            class="overflow-y-auto overflow-x-hidden flex flex-1 flex-col-reverse{isAtBottom
                ? ' *:[overflow-anchor:none]'
                : ''}"
        >
            <div
                bind:this={bottomAnchorEl}
                class="{!unreadMarkerEventId && isAtBottom
                    ? '![overflow-anchor:auto] '
                    : ''}h-px"
            ></div>

            <!-- Room upgrade tombstone banner -->
            {#if tombstone}
                <div
                    class="mx-4 mt-2 mb-4 p-3 rounded-lg bg-discord-backgroundTertiary border border-discord-warning flex items-center gap-3"
                >
                    <svg
                        class="w-5 h-5 text-discord-warning flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                            d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
                        /></svg
                    >
                    <div class="flex-1 min-w-0">
                        <p
                            class="text-sm font-semibold text-discord-textPrimary"
                        >
                            This room has been upgraded
                        </p>
                        <p class="text-xs text-discord-textMuted truncate">
                            {tombstone.body}
                        </p>
                    </div>
                    <button
                        onclick={joinUpgrade}
                        disabled={joiningUpgrade}
                        class="flex-shrink-0 px-3 py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                        {replacementAlreadyJoined
                            ? "Go to new room"
                            : joiningUpgrade
                              ? "Joining…"
                              : "Join new room"}
                    </button>
                </div>
            {/if}

            <!-- Message list -->
            {#each reversedMessages as event, i (event.getId())}
                {@const dateLabel = showDateSeparator(reversedMessages, i)}
                {@const receipts =
                    (void receiptTick, getReceiptsForEvent(room, event))}
                {#if dateLabel}
                    <div class="flex items-center gap-4 px-4 my-4">
                        <div class="flex-1 h-px bg-discord-divider"></div>
                        <span
                            class="text-xs font-semibold text-discord-textMuted"
                            >{dateLabel}</span
                        >
                        <div class="flex-1 h-px bg-discord-divider"></div>
                    </div>
                {/if}
                {#if unreadMarkerEventId && reversedMessages[i - 1]?.getId() === unreadMarkerEventId}
                    <div
                        class="flex items-center gap-3 px-4 my-2 ![overflow-anchor:auto]"
                    >
                        <div class="flex-1 h-px bg-red-500/60"></div>
                        <span
                            class="text-xs font-semibold text-red-400 uppercase tracking-wide"
                            >New Messages</span
                        >
                        <div class="flex-1 h-px bg-red-500/60"></div>
                    </div>
                {/if}
                <MessageItem
                    {event}
                    {room}
                    showHeader={shouldShowHeader(reversedMessages, i)}
                    onReply={(e) => {
                        replyToEvent = e;
                    }}
                    jumpToReply={scrollToMessage}
                    editRequested={editRequestedEventId === event.getId()}
                    onEditDone={() => messageInputEl?.focus()}
                    {receipts}
                    loudHighlight={isLoudEvent(event)}
                />
            {/each}

            <!-- Welcome message at the top -->
            {#if reversedMessages.length === 0}
                <div class="px-4 pb-4">
                    <div
                        class="w-16 h-16 rounded-full bg-discord-accent flex items-center justify-center mb-4"
                    >
                        <span class="text-3xl font-bold text-white">#</span>
                    </div>
                    <h3
                        class="text-2xl font-bold text-discord-textPrimary mb-1"
                    >
                        Welcome to #{roomName}!
                    </h3>
                    <p class="text-discord-textMuted">
                        This is the beginning of the #{roomName} room.
                    </p>
                </div>
            {/if}

            <!-- Load more indicator -->
            {#if loadingOlder}
                <div class="flex justify-center py-4">
                    <div
                        class="w-6 h-6 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                    ></div>
                </div>
            {/if}
        </div>

        <!-- Scroll to bottom button -->
        {#if !isAtBottom && !isContextView && reversedMessages.length > 0}
            <div
                class="absolute bottom-24 left-0 right-0 flex justify-center z-10 pointer-events-none"
            >
                <button
                    onpointerdown={(e) => e.preventDefault()}
                    onclick={() => scrollToBottom(false)}
                    class="pointer-events-auto bg-discord-backgroundSecondary hover:bg-discord-messageHover text-discord-textPrimary px-3 py-1.5 rounded-full shadow-lg text-sm font-medium border border-discord-divider transition-colors flex items-center gap-1.5"
                >
                    <svg
                        class="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"
                        />
                    </svg>
                    Jump to present
                </button>
            </div>
        {/if}

        <!-- Searching for unloaded message indicator -->
        {#if jumpingToEventId}
            <div
                class="absolute bottom-24 left-0 right-0 flex justify-center z-10 pointer-events-none"
            >
                <div
                    class="bg-discord-backgroundSecondary text-discord-textMuted px-3 py-1.5 rounded-full shadow-lg text-sm border border-discord-divider flex items-center gap-2"
                >
                    <div
                        class="w-3.5 h-3.5 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                    ></div>
                    Searching for message…
                </div>
            </div>
        {/if}

        <!-- Context view banner -->
        {#if isContextView}
            <div
                class="absolute top-12 left-0 right-0 flex justify-center z-10 pointer-events-none"
            >
                <div
                    class="pointer-events-auto bg-discord-warning/20 text-discord-warning px-3 py-1.5 rounded-full shadow-lg text-sm border border-discord-warning/40 flex items-center gap-2"
                >
                    <svg
                        class="w-3.5 h-3.5 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        ><path
                            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                        /></svg
                    >
                    Viewing message context
                    <button
                        onclick={() => {
                            contextMessages = null;
                            setMessages(roomId, getTimelineMessages(room));
                            tick().then(() => scrollToBottom(true));
                        }}
                        class="ml-1 underline hover:no-underline"
                        >Return to live</button
                    >
                </div>
            </div>
        {/if}

        <!-- Message input -->
        <MessageInput
            bind:this={messageInputEl}
            {roomId}
            {roomName}
            {room}
            {replyToEvent}
            {scrollEl}
            onCancelReply={() => {
                replyToEvent = null;
            }}
            onRequestEditLast={requestEditLastMessage}
        />
    </div>

    <!-- Debug panel (Ctrl+Shift+D to toggle) -->
    <DebugPanel {room} />

    <!-- Right panel (pinned or notifications inbox) -->
    {#if isMobile}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
            class="absolute inset-0 z-30"
            style="background: rgba(0,0,0,{pinnedBackdropOpacity}); pointer-events: {pinnedBackdropOpacity >
            0.01
                ? 'auto'
                : 'none'};"
            onclick={() => {
                if (!isPinnedDragging) {
                    showPinnedPanel = false;
                    showNotificationsPanel = false;
                }
            }}
        ></div>
        <div
            class="absolute inset-y-0 right-0 z-40 h-full"
            style="width: {PINNED_WIDTH}px; transform: translateX({pinnedTranslate}px); {isPinnedDragging
                ? ''
                : 'transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);'} {pinnedTranslate >=
            PINNED_WIDTH
                ? ''
                : 'box-shadow: -25px 0 50px -12px rgba(0,0,0,0.5);'}"
        >
            {#if showNotificationsPanel}
                <NotificationsPanel
                    onClose={() => (showNotificationsPanel = false)}
                    onJumpTo={(_rid, eid) => scrollToMessage(eid)}
                />
            {:else}
                <PinnedMessagesPanel
                    {room}
                    onClose={() => (showPinnedPanel = false)}
                    onJumpTo={scrollToMessage}
                />
            {/if}
        </div>
    {:else if showNotificationsPanel}
        <NotificationsPanel
            onClose={() => (showNotificationsPanel = false)}
            onJumpTo={(_rid, eid) => scrollToMessage(eid)}
        />
    {:else if showPinnedPanel}
        <PinnedMessagesPanel
            {room}
            onClose={() => (showPinnedPanel = false)}
            onJumpTo={scrollToMessage}
        />
    {/if}

    <!-- Member list sidebar (animated overlay on mobile, inline on desktop) -->
    {#if isMobile}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div
            class="absolute inset-0 z-30"
            style="background: rgba(0,0,0,{memberBackdropOpacity}); pointer-events: {memberBackdropOpacity >
            0.01
                ? 'auto'
                : 'none'};"
            onclick={() => {
                if (!isMemberDragging) showMemberList = false;
            }}
        ></div>
        <div
            class="absolute inset-y-0 right-0 z-40 h-full"
            style="width: {MEMBER_WIDTH}px; transform: translateX({memberTranslate}px); {isMemberDragging
                ? ''
                : 'transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);'} {memberTranslate >=
            MEMBER_WIDTH
                ? ''
                : 'box-shadow: -25px 0 50px -12px rgba(0,0,0,0.5);'}"
        >
            <MemberList {room} />
        </div>
    {:else if showMemberList}
        <MemberList {room} />
    {/if}
</div>

{#if showRoomSettings}
    <RoomSettings {room} onClose={() => (showRoomSettings = false)} />
{/if}
