<script lang="ts">
    import { tick, untrack } from "svelte";
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import { auth } from "$lib/stores/auth.svelte";
    import MessageItem from "$lib/components/messages/MessageItem.svelte";
    import MessageInput from "$lib/components/messages/MessageInput.svelte";
    import MemberList from "$lib/components/layout/MemberList.svelte";
    import DebugPanel from "$lib/components/debug/DebugPanel.svelte";
    import DebugEventItem from "$lib/components/debug/DebugEventItem.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import {
        getTimelineMessages,
        getLatestTimelineEvent,
        onTimelineEvent,
        onLocalEchoUpdated,
        onSyncPrepared,
        onReactionEvent,
        onPollEvent,
        onEditEvent,
        onRedactionEvent,
        onTimelineReset,
        onRoomHealed,
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
        getRoomCallMemberships,
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
    import {
        interfaceState,
        openSidebar,
        closeSidebar,
        showCallView,
    } from "$lib/stores/interface.svelte";
    import { getLoudNotificationCount } from "$lib/stores/notifications.svelte";
    import { ignoredUsersState } from "$lib/stores/ignoredUsers.svelte";
    import { shouldHideMessage } from "$lib/utils/ignoredUsers";
    import PinnedMessagesPanel from "$lib/components/layout/PinnedMessagesPanel.svelte";
    import NotificationsPanel from "$lib/components/layout/NotificationsPanel.svelte";
    import ThreadPanel from "$lib/components/layout/ThreadPanel.svelte";
    import MessageSearchPanel from "$lib/components/layout/MessageSearchPanel.svelte";
    import { searchState } from "$lib/stores/search.svelte";
    import UserProfileCard from "$lib/components/ui/UserProfileCard.svelte";
    import {
        getPinnedEventIds,
        findEventById,
        isLoudEvent,
    } from "$lib/matrix/client";
    import {
        shouldShowHeader,
        dateSeparatorLabel,
        unreadDividerBefore,
        isNearBottom,
    } from "$lib/utils/timelineDisplay";
    import { daySeparator } from "$lib/utils/timeFormat";
    import { preventDefault } from "svelte/legacy";
    import { isPollStartEventType } from "$lib/utils/pollContent";
    import ActiveCallBanner from "$lib/components/layout/ActiveCallBanner.svelte";
    import { Phone, Volume2, Lock } from "lucide-svelte";
    import { isRoomEncrypted } from "$lib/matrix/crypto";
    import { voiceCallState, joinCall } from "$lib/stores/voiceCall.svelte";
    import { dedupeParticipants } from "$lib/utils/voiceCall";

    interface Props {
        room: Room;
        isMobile?: boolean;
        onMenuOpen?: () => void;
    }

    let { room, isMobile = false, onMenuOpen }: Props = $props();

    let scrollEl: HTMLDivElement | undefined = $state();
    let bottomAnchorEl: HTMLDivElement | undefined = $state();
    let topSentinelEl: HTMLDivElement | undefined = $state();
    let messageInputEl: ReturnType<typeof MessageInput> | undefined = $state();
    let isAtBottom = $state(true);
    let loadingOlder = $state(false);
    let backfilling = false;
    let replyToEvent = $state<MatrixEvent | null>(null);
    let editRequestedEventId = $state<string | null>(null);
    let threadRootId = $state<string | null>(null);

    function openThread(rootEventId: string) {
        threadRootId = rootEventId;
        closeSidebar();
    }
    function closeThread() {
        threadRootId = null;
    }
    // Blocked-message placeholders the user chose to reveal, by event id.
    let revealedBlockedIds = $state<Record<string, boolean>>({});

    // Close any open thread and re-collapse blocked messages when switching rooms.
    $effect(() => {
        void room.roomId;
        threadRootId = null;
        revealedBlockedIds = {};
    });
    let isDragOver = $state(false);
    let intervalId: NodeJS.Timeout | undefined = $state();
    let scrollStopTimeout: NodeJS.Timeout | undefined = $state();

    // Stop any in-flight "keep scrolling into view" loop (started by
    // scrollToMessage). Safe to call repeatedly.
    function stopScrollIntoView() {
        if (intervalId !== undefined) {
            clearInterval(intervalId);
            intervalId = undefined;
        }
        if (scrollStopTimeout !== undefined) {
            clearTimeout(scrollStopTimeout);
            scrollStopTimeout = undefined;
        }
    }
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
    // Right-side panels live in the shared interfaceState.sidebar slot, so only
    // one is ever open and the central Escape/back handler can dismiss them.
    const showMemberList = $derived(interfaceState.sidebar === "members");
    const showPinnedPanel = $derived(interfaceState.sidebar === "pinned");
    const showNotificationsPanel = $derived(
        interfaceState.sidebar === "notifications",
    );
    const showSearchPanel = $derived(interfaceState.sidebar === "search");
    const showRightPanel = $derived(
        showPinnedPanel || showNotificationsPanel || showSearchPanel,
    );

    function toggleSidebar(
        id: "members" | "pinned" | "notifications" | "search",
    ) {
        if (interfaceState.sidebar === id) closeSidebar();
        else openSidebar(id, () => {});
    }
    const pinnedCount = $derived.by(() => {
        void roomsState.roomsTick;
        return getPinnedEventIds(room).length;
    });

    // Any loud (red) notification anywhere → badge the mobile hamburger.
    const hasAnyLoud = $derived(getLoudNotificationCount() > 0);

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
        // Cancel any previous scroll loop so we never leak an interval that
        // would keep yanking the scroll position and block the user.
        stopScrollIntoView();
        intervalId = setInterval(
            () =>
                target.scrollIntoView({ behavior: "smooth", block: "center" }),
            50,
        );
        target.classList.remove("message-highlight");
        void target.offsetWidth;
        target.classList.add("message-highlight");
        scrollStopTimeout = setTimeout(() => {
            target.classList.remove("message-highlight");
            stopScrollIntoView();
        }, 2000);
    }

    // Ensure the scroll loop never outlives the component (e.g. room switch).
    $effect(() => stopScrollIntoView);

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

    // Animated right drawer (mobile member list)
    const MEMBER_WIDTH = 280;
    let memberTranslate = $state(MEMBER_WIDTH);
    let isMemberDragging = $state(false);
    let memberDragPending = false;
    let memberDragStartX = 0;
    let memberDragStartY = 0;
    let memberDragBase = 0;

    // Element the touch began on — used to detect swipes that should scroll a
    // wide code block / table natively rather than dragging a drawer open.
    let dragTarget: Element | null = null;

    function targetCanScrollHoriz(el: Element | null, dx: number): boolean {
        let node: Element | null = el;
        while (node && node !== document.body) {
            if (node.scrollWidth > node.clientWidth + 1) {
                const overflowX = getComputedStyle(node).overflowX;
                if (overflowX === "auto" || overflowX === "scroll") {
                    const maxScroll = node.scrollWidth - node.clientWidth;
                    // Swipe right (dx > 0) scrolls content toward the start;
                    // swipe left (dx < 0) scrolls toward the end.
                    if (dx > 0 && node.scrollLeft > 0) return true;
                    if (dx < 0 && node.scrollLeft < maxScroll) return true;
                }
            }
            node = node.parentElement;
        }
        return false;
    }

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
            // Horizontal gesture inside a scrollable code block / table — let it
            // scroll natively instead of opening the member drawer.
            if (targetCanScrollHoriz(dragTarget, dx)) {
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
        const open = startedOpen ? progress >= 0.75 : progress > 0.25;
        if (open) openSidebar("members", () => {});
        else if (interfaceState.sidebar === "members") closeSidebar();
        memberTranslate = open ? 0 : MEMBER_WIDTH;
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
            interfaceState.leftOpen ||
            interfaceState.lightboxOpen ||
            interfaceState.modal !== null ||
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
            // Horizontal gesture inside a scrollable code block / table — let it
            // scroll natively instead of opening the pinned drawer.
            if (targetCanScrollHoriz(dragTarget, dx)) {
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
        if (!stayOpen) closeSidebar();
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
            interfaceState.leftOpen ||
            interfaceState.lightboxOpen ||
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
    // Tick dependency: the Room mutates in place when state arrives late
    // (late-seeded federated joins, renames) — same reference, new name.
    const roomName = $derived(
        (void roomsState.roomsTick, getRoomDisplayName(room)),
    );
    // Re-reads the live Room's state; depends on roomsTick to refresh when the
    // m.room.encryption state event lands (the Room mutates in place).
    const roomEncrypted = $derived(
        (void roomsState.roomsTick, isRoomEncrypted(room)),
    );
    const topic = $derived((void roomsState.roomsTick, getRoomTopic(room)));
    // Header "show call" button gate. Computed here rather than as an {@const}
    // in the markup: the header is a plain <div>, and {@const} may only be an
    // immediate child of a block.
    const callCount = $derived(
        (void voiceCallState.voiceTick,
        dedupeParticipants(getRoomCallMemberships(room)).length),
    );
    let contextMessages = $state<MatrixEvent[] | null>(null);
    const messages = $derived(contextMessages ?? getMessages(roomId));
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
            backfillFromTop();
        });
    });

    // Reload the timeline when the "show all events" debug toggle flips so the
    // list switches between filtered messages and the full raw event stream.
    $effect(() => {
        settingsState.showAllEvents; // track only the toggle
        untrack(() => {
            if (isContextView) return;
            setMessages(roomId, getTimelineMessages(room));
            setCanLoadMore(roomId, true);
        });
    });

    // Whether an event should render as a raw debug row rather than a normal
    // message. Only possible when "show all events" is on (otherwise the
    // timeline only contains renderable messages/stickers).
    function isRawDebugEvent(event: MatrixEvent): boolean {
        if (!settingsState.showAllEvents) return false;
        if (event.isRedacted()) return true;
        const type = event.getType();
        if (
            type !== "m.room.message" &&
            type !== "m.sticker" &&
            !isPollStartEventType(type)
        )
            return true;
        return event.getContent()?.["m.relates_to"]?.rel_type === "m.replace";
    }

    // Reload messages once the initial sync completes (catches messages missed during SYNCING state)
    $effect(() => {
        const currentRoom = room;
        const currentRoomId = roomId;
        const unsub = onSyncPrepared(() => {
            setMessages(currentRoomId, getTimelineMessages(currentRoom));
            backfillFromTop();
            if (isAtBottom) markAsRead();
        });
        return unsub;
    });

    // Reload after a state-less stub room gets seeded and backfilled (rooms
    // joined over federation that sync omits) — the timeline is populated
    // outside any SDK sync event, so the displayed list must be re-read.
    $effect(() => {
        const currentRoom = room;
        const currentRoomId = roomId;
        const unsub = onRoomHealed((healedId) => {
            if (healedId !== currentRoomId || isContextView) return;
            setMessages(currentRoomId, getTimelineMessages(currentRoom));
            setCanLoadMore(currentRoomId, true);
            tick().then(() => {
                if (isAtBottom) {
                    scrollToBottom(true);
                    markAsRead();
                }
                backfillFromTop();
            });
        });
        return unsub;
    });

    // Reload when the live timeline is reset by a gappy/limited sync (reconnect,
    // resuming the PWA from a notification, etc). The SDK discards the old
    // timeline and starts a fresh one after the gap, so we must replace the
    // displayed list — otherwise the post-gap events get appended onto stale
    // ones and the intervening messages appear to never have existed. For a
    // user who had paginated back, that replacement would throw away their
    // scroll-back position, so we then re-paginate until their history returns
    // (see recoverScrollback).
    $effect(() => {
        const currentRoom = room;
        const currentRoomId = roomId;
        const unsub = onTimelineReset(currentRoom, () => {
            if (isContextView) return; // context view uses its own timeline set
            // Capture what the reset is about to discard — the handler runs
            // before setMessages, so `messages` is still the pre-reset list.
            const prevOldestId = isAtBottom ? undefined : messages[0]?.getId();
            const anchor = isAtBottom ? null : captureViewportAnchor();
            setMessages(currentRoomId, getTimelineMessages(currentRoom));
            // The fresh timeline can be paginated back to fill the gap.
            setCanLoadMore(currentRoomId, true);
            tick().then(async () => {
                if (isAtBottom) {
                    scrollToBottom(true);
                    markAsRead();
                } else if (prevOldestId) {
                    await recoverScrollback(
                        currentRoom,
                        currentRoomId,
                        prevOldestId,
                        anchor,
                    );
                }
                backfillFromTop();
            });
        });
        return unsub;
    });

    // The first message row visible in the viewport plus its on-screen offset,
    // so the view can be pinned back to it after the list is rebuilt.
    function captureViewportAnchor(): { eventId: string; top: number } | null {
        if (!scrollEl) return null;
        const rootTop = scrollEl.getBoundingClientRect().top;
        for (const el of scrollEl.querySelectorAll<HTMLElement>(
            "[data-event-id]",
        )) {
            const rect = el.getBoundingClientRect();
            if (rect.bottom > rootTop && el.dataset.eventId) {
                return { eventId: el.dataset.eventId, top: rect.top };
            }
        }
        return null;
    }

    // After a reset replaces the displayed list with the short fresh timeline,
    // paginate backward until the previously-oldest displayed event reappears,
    // then restore the viewport to the captured anchor. Bounded: a gap deeper
    // than RECOVERY_MAX_BATCHES leaves the user at the fresh timeline exactly
    // as before this recovery existed.
    const RECOVERY_MAX_BATCHES = 10;
    async function recoverScrollback(
        currentRoom: Room,
        currentRoomId: string,
        prevOldestId: string,
        anchor: { eventId: string; top: number } | null,
    ) {
        if (backfilling) return;
        backfilling = true; // keep the top-sentinel observer from interleaving
        try {
            for (let i = 0; i < RECOVERY_MAX_BATCHES; i++) {
                if (
                    getTimelineMessages(currentRoom).some(
                        (e) => e.getId() === prevOldestId,
                    )
                )
                    break;
                const hasMore = await loadPreviousMessages(currentRoom);
                if (!hasMore) {
                    setCanLoadMore(currentRoomId, false);
                    break;
                }
            }
            if (roomId !== currentRoomId) return; // room switched mid-recovery
            setMessages(currentRoomId, getTimelineMessages(currentRoom));
            await tick();
            if (!anchor || !scrollEl) return;
            const el = scrollEl.querySelector(
                `[data-event-id="${anchor.eventId}"]`,
            );
            if (el) {
                scrollEl.scrollTop +=
                    el.getBoundingClientRect().top - anchor.top;
            }
        } finally {
            backfilling = false;
        }
    }

    // Subscribe to new live timeline events (incoming and confirmed own messages)
    $effect(() => {
        const currentRoomId = roomId; // capture for closure
        const unsub = onTimelineEvent(
            (event: MatrixEvent, eventRoom: Room, isLiveAppend: boolean) => {
                bumpUnreadTick();
                if (eventRoom.roomId !== currentRoomId || isContextView) return;
                if (isLiveAppend) {
                    // Normal tail append — fast path, the event is the newest.
                    appendMessage(currentRoomId, event);
                    if (isAtBottom) {
                        tick().then(() => scrollToBottom(false));
                    }
                } else {
                    // Mid-timeline insertion (thread reply moved to the main
                    // timeline, out-of-order related event). appendMessage would
                    // place it at the tail in the wrong spot; re-read the whole
                    // timeline so it lands in its correct position.
                    setMessages(currentRoomId, getTimelineMessages(room));
                    if (isAtBottom) {
                        tick().then(() => scrollToBottom(false));
                    }
                }
            },
        );
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

    // Subscribe to reaction, poll-vote, and edit events to trigger re-renders
    $effect(() => {
        const currentRoomId = roomId;
        const unsubReaction = onReactionEvent(
            (_event: MatrixEvent, eventRoom: Room) => {
                if (eventRoom.roomId === currentRoomId) bumpReactionTick();
            },
        );
        const unsubPoll = onPollEvent(
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
            unsubPoll();
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
        const { scrollTop, clientHeight, scrollHeight } = scrollEl;
        const wasAtBottom = isAtBottom;
        isAtBottom = isNearBottom(scrollTop, clientHeight, scrollHeight);

        if (!wasAtBottom && isAtBottom) markAsRead();
        // Loading older messages near the top is driven by the IntersectionObserver
        // on topSentinelEl (see below) — more reliable than a scroll-position check.
    }

    async function loadOlderMessages() {
        if (loadingOlder || !canLoadMore(roomId) || isContextView) return;
        loadingOlder = true;
        // Reference element for scroll preservation: the oldest rendered
        // message. After prepending we cancel however far it actually moved —
        // correct whether or not the browser's native scroll anchoring also
        // compensated (Chromium/Firefox do, WebKit doesn't).
        const refEl = scrollEl?.querySelector("[data-event-id]");
        const refId = (refEl as HTMLElement | null)?.dataset.eventId;
        const prevTop = refEl?.getBoundingClientRect().top;

        try {
            const hasMore = await loadPreviousMessages(room);
            if (!hasMore) setCanLoadMore(roomId, false);
            const events = getTimelineMessages(room);
            setMessages(roomId, events);

            await tick();
            if (scrollEl && refId !== undefined && prevTop !== undefined) {
                const el = scrollEl.querySelector(`[data-event-id="${refId}"]`);
                if (el) {
                    scrollEl.scrollTop +=
                        el.getBoundingClientRect().top - prevTop;
                }
            }
        } finally {
            loadingOlder = false;
        }
    }

    // Returns whether the top sentinel is on/near screen — i.e. the user has
    // scrolled (almost) to the top, OR there aren't enough messages to make the
    // list scrollable so the top is permanently in view. Reads live geometry so
    // it's accurate mid-pagination.
    function isTopSentinelNearViewport(): boolean {
        if (!scrollEl || !topSentinelEl) return false;
        const rootRect = scrollEl.getBoundingClientRect();
        const sentRect = topSentinelEl.getBoundingClientRect();
        // Sentinel sits at the visual top; once enough older content loads above
        // it, its bottom edge moves well above the viewport top.
        return sentRect.bottom > rootRect.top - 400;
    }

    // Keep paginating older history while the top is in view and the server still
    // has more. Covers both "scrolled to the top" and "too few messages to fill
    // the viewport". Driven by the IntersectionObserver and the explicit fill
    // points (room open, sync prepared, timeline reset).
    async function backfillFromTop() {
        if (backfilling || isContextView) return;
        backfilling = true;
        try {
            await tick();
            let guard = 0;
            while (
                canLoadMore(roomId) &&
                !isContextView &&
                isTopSentinelNearViewport() &&
                guard++ < 50
            ) {
                await loadOlderMessages();
                await tick();
            }
        } finally {
            backfilling = false;
        }
    }

    // Reliably trigger backfill when the visual top approaches (rootMargin
    // pre-fetches before the user hits the very top) or stays in view because the
    // list is too short to scroll. Re-created per room.
    $effect(() => {
        const root = scrollEl;
        const sentinel = topSentinelEl;
        roomId; // re-establish the observer when the room changes
        if (!root || !sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) backfillFromTop();
            },
            { root, rootMargin: "400px 0px 0px 0px" },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    });

    // Message grouping, date separators and the unread divider are pure
    // functions over the chronological list — see $lib/utils/timelineDisplay.
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="flex flex-1 min-w-0 overflow-hidden relative"
    ondragenter={onDragEnter}
    ondragleave={onDragLeave}
    ondragover={onDragOver}
    ondrop={onDrop}
    ontouchstart={(e) => {
        dragTarget = e.target instanceof Element ? e.target : null;
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
    <div class="flex-1 flex flex-col min-w-0 overflow-hidden" data-chat-area>
        <!-- Room header -->
        <div
            class="h-12 px-4 flex items-center gap-3 border-b border-discord-divider shadow-sm flex-shrink-0"
        >
            {#if isMobile}
                <button
                    onclick={onMenuOpen}
                    class="relative p-1.5 -ml-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors flex-shrink-0"
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
                    {#if hasAnyLoud}
                        <span
                            class="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-discord-danger border border-discord-background"
                            aria-label="Unread notifications"
                        ></span>
                    {/if}
                </button>
            {/if}
            <span class="text-xl font-bold text-discord-textMuted flex-shrink-0"
                >#</span
            >
            <h2 class="font-semibold text-discord-textPrimary">{roomName}</h2>
            {#if roomEncrypted}
                <span
                    class="flex-shrink-0 text-discord-textMuted"
                    title="Encryption enabled"
                    aria-label="Encryption enabled"
                >
                    <Lock class="w-4 h-4" />
                </span>
            {/if}
            {#if topic}
                <div class="w-px h-5 bg-discord-divider"></div>
                <p class="text-sm text-discord-textMuted truncate flex-1">
                    {topic}
                </p>
            {/if}
            {#if !topic}<div class="flex-1"></div>{/if}
            <!-- Start voice call button -->
            {#if voiceCallState.roomId !== room.roomId}
                {@const joining =
                    voiceCallState.joinPendingRoomId === room.roomId}
                <button
                    onclick={() => joinCall(room.roomId)}
                    disabled={voiceCallState.joinPendingRoomId !== null}
                    class="p-1.5 rounded transition-colors text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover disabled:opacity-50 {joining
                        ? 'animate-pulse'
                        : ''}"
                    title={joining ? "Joining voice call…" : "Start voice call"}
                    aria-label={joining
                        ? "Joining voice call…"
                        : "Start voice call"}
                >
                    <Phone size={20} />
                </button>
            {/if}
            <!-- Flip to the call view (peek without joining) -->
            {#if callCount > 0}
                <button
                    onclick={() => showCallView(room.roomId)}
                    class="p-1.5 rounded transition-colors text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover"
                    title="Show call"
                    aria-label="Show call"
                >
                    <Volume2 size={20} />
                </button>
            {/if}
            <!-- Search messages button -->
            {#if !searchState.unsupported}
                <button
                    onclick={() => toggleSidebar("search")}
                    class="p-1.5 rounded transition-colors {showSearchPanel
                        ? 'text-discord-accent bg-discord-messageHover'
                        : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                    title="Search messages"
                >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"
                        ><path
                            d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
                        /></svg
                    >
                </button>
            {/if}
            <!-- Pinned messages button -->
            <button
                onclick={() => toggleSidebar("pinned")}
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
                onclick={() => toggleSidebar("notifications")}
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
                onclick={() => toggleSidebar("members")}
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

        <ActiveCallBanner {room} />

        <!-- Messages scrollable area -->
        <div
            bind:this={scrollEl}
            onscroll={onScroll}
            onwheel={stopScrollIntoView}
            ontouchstart={stopScrollIntoView}
            class="overflow-y-auto overflow-x-hidden flex flex-1 flex-col{isAtBottom
                ? ' *:[overflow-anchor:none]'
                : ''}"
        >
            <!-- Pushes a short timeline down so it hugs the composer, like
                 flex-col-reverse used to. -->
            <div class="mt-auto flex-shrink-0"></div>

            <!-- Backfill sentinel at the visual top (= oldest-loaded edge).
                 The IntersectionObserver watches it to load older history. -->
            {#if !isContextView}
                <div
                    bind:this={topSentinelEl}
                    class="h-px w-full flex-shrink-0"
                ></div>
            {/if}

            <!-- Load more indicator -->
            {#if loadingOlder}
                <div class="flex justify-center py-4">
                    <div
                        class="w-6 h-6 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"
                    ></div>
                </div>
            {/if}

            <!-- Welcome message at the top -->
            {#if messages.length === 0}
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

            <!-- Message list (chronological: DOM order matches visual order,
                 so selection and copy across messages behave natively) -->
            {#each messages as event, i (event.getId())}
                {@const sepTs = dateSeparatorLabel(messages, i)}
                {@const receipts =
                    (void receiptTick, getReceiptsForEvent(room, event))}
                {#if sepTs !== null}
                    <div class="flex items-center gap-4 px-4 my-4">
                        <div class="flex-1 h-px bg-discord-divider"></div>
                        <span
                            class="text-xs font-semibold text-discord-textMuted"
                            >{daySeparator(sepTs)}</span
                        >
                        <div class="flex-1 h-px bg-discord-divider"></div>
                    </div>
                {/if}
                {#if unreadDividerBefore(messages, i, unreadMarkerEventId)}
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
                {#if isRawDebugEvent(event)}
                    <DebugEventItem {event} />
                {:else if shouldHideMessage(event.getSender(), ignoredUsersState.userIds, auth.userId) && !revealedBlockedIds[event.getId() ?? ""]}
                    <div
                        class="px-4 py-1.5 flex items-center gap-2 text-xs text-discord-textMuted"
                    >
                        <svg
                            class="w-3.5 h-3.5 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            ><path
                                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM4 12c0-4.42 3.58-8 8-8 1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.902 7.902 0 0 1 4 12zm8 8c-1.85 0-3.55-.63-4.9-1.69L18.31 7.1A7.902 7.902 0 0 1 20 12c0 4.42-3.58 8-8 8z"
                            /></svg
                        >
                        <span class="italic">Message from a blocked user</span>
                        <button
                            onclick={() =>
                                (revealedBlockedIds[event.getId() ?? ""] =
                                    true)}
                            class="text-discord-accent hover:underline font-medium"
                            >Show blocked message</button
                        >
                    </div>
                {:else}
                    <MessageItem
                        {event}
                        {room}
                        showHeader={shouldShowHeader(messages, i)}
                        onReply={(e) => {
                            replyToEvent = e;
                        }}
                        jumpToReply={scrollToMessage}
                        onOpenThread={openThread}
                        editRequested={editRequestedEventId === event.getId()}
                        onEditDone={() => messageInputEl?.focus()}
                        {receipts}
                        loudHighlight={isLoudEvent(event)}
                    />
                {/if}
            {/each}

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

            <!-- Bottom anchor: when the user is at the bottom, native scroll
                 anchoring pins the view to it so growing content sticks. -->
            <div
                bind:this={bottomAnchorEl}
                class="{!unreadMarkerEventId && isAtBottom
                    ? '![overflow-anchor:auto] '
                    : ''}h-px flex-shrink-0"
            ></div>
        </div>

        <!-- Scroll to bottom button -->
        {#if !isAtBottom && !isContextView && messages.length > 0}
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

    <!-- User profile card (opened from the member list or a message header) -->
    <UserProfileCard {room} />

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
                if (!isPinnedDragging) closeSidebar();
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
                    onClose={closeSidebar}
                    onJumpTo={(_rid, eid) => scrollToMessage(eid)}
                />
            {:else if showSearchPanel}
                <MessageSearchPanel
                    {room}
                    onClose={closeSidebar}
                    onJumpTo={scrollToMessage}
                />
            {:else}
                <PinnedMessagesPanel
                    {room}
                    onClose={closeSidebar}
                    onJumpTo={scrollToMessage}
                />
            {/if}
        </div>
    {:else if showNotificationsPanel}
        <NotificationsPanel
            onClose={closeSidebar}
            onJumpTo={(_rid, eid) => scrollToMessage(eid)}
        />
    {:else if showSearchPanel}
        <MessageSearchPanel
            {room}
            onClose={closeSidebar}
            onJumpTo={scrollToMessage}
        />
    {:else if showPinnedPanel}
        <PinnedMessagesPanel
            {room}
            onClose={closeSidebar}
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
                if (!isMemberDragging) closeSidebar();
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

    <!-- Thread panel (inline on desktop, overlay on mobile) -->
    {#if threadRootId}
        {#if isMobile}
            <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
            <div
                class="absolute inset-0 z-30 bg-black/50"
                onclick={closeThread}
            ></div>
            <div class="absolute inset-y-0 right-0 z-40 h-full">
                <ThreadPanel
                    {room}
                    rootEventId={threadRootId}
                    onClose={closeThread}
                />
            </div>
        {:else}
            <ThreadPanel
                {room}
                rootEventId={threadRootId}
                onClose={closeThread}
            />
        {/if}
    {/if}
</div>
