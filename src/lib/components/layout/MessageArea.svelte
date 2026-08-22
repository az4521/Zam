<script lang="ts">
    import { tick, untrack, onMount } from "svelte";
    import type { Room, MatrixEvent, TimelineWindow } from "matrix-js-sdk";
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
        onEventDecrypted,
        onDecryptedTimelineEvent,
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
        createContextWindow,
        getContextWindowEvents,
        paginateContextWindow,
        contextWindowCanPaginate,
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
        getRoomThreads,
        isVideoRoom,
        loadRoomMembersIfNeeded,
        type ReadReceiptInfo,
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
        openModal,
        closeModal,
        showCallView,
        type SidebarId,
    } from "$lib/stores/interface.svelte";
    import { getLoudNotificationCount } from "$lib/stores/notifications.svelte";
    import { ignoredUsersState } from "$lib/stores/ignoredUsers.svelte";
    import { shouldHideMessage } from "$lib/utils/ignoredUsers";
    import PinnedMessagesPanel from "$lib/components/layout/PinnedMessagesPanel.svelte";
    import NotificationsPanel from "$lib/components/layout/NotificationsPanel.svelte";
    import ThreadPanel from "$lib/components/layout/ThreadPanel.svelte";
    import MessageSearchPanel from "$lib/components/layout/MessageSearchPanel.svelte";
    import ThreadsListPanel from "$lib/components/layout/ThreadsListPanel.svelte";
    import RoomMediaPanel from "$lib/components/layout/RoomMediaPanel.svelte";
    import { searchState } from "$lib/stores/search.svelte";
    import UserProfileCard from "$lib/components/ui/UserProfileCard.svelte";
    import {
        getPinnedEventIds,
        findEventById,
        isHighlightEvent,
        preloadRoomEmoji,
    } from "$lib/matrix/client";
    import {
        shouldShowHeader,
        dateSeparatorLabel,
        unreadDividerBefore,
        isNearBottom,
    } from "$lib/utils/timelineDisplay";
    import { daySeparator } from "$lib/utils/timeFormat";
    import { renderPlainTextWithTwemoji } from "$lib/utils/twemojiText";
    import { canSendReceipt } from "$lib/utils/receiptGate";
    import { createBackfillGate } from "$lib/utils/backfillGate";
    import { rollupRoomThreadUnread } from "$lib/utils/threadUnread";
    import { isOffCanvasClosed } from "$lib/utils/drawerInert";
    import { preventDefault } from "svelte/legacy";
    import { isPollStartEventType } from "$lib/utils/pollContent";
    import ActiveCallBanner from "$lib/components/layout/ActiveCallBanner.svelte";
    import LiveLocationBanner from "$lib/components/layout/LiveLocationBanner.svelte";
    import {
        Phone,
        Volume2,
        Lock,
        Users,
        Hash,
        Image,
        MoreHorizontal,
    } from "lucide-svelte";
    import RoomHeaderOverflowMenu from "$lib/components/layout/RoomHeaderOverflowMenu.svelte";
    import type { RoomHeaderMenuKey } from "$lib/utils/roomHeaderMenu";
    import { isRoomEncrypted } from "$lib/matrix/crypto";
    import { voiceCallState, joinCall } from "$lib/stores/voiceCall.svelte";
    import { dedupeParticipants } from "$lib/utils/voiceCall";
    import { scrollBehavior } from "$lib/utils/motionPreference";
    import {
        ANNOUNCE_DEBOUNCE_MS,
        EMPTY_ANNOUNCER,
        drainAnnouncement,
        recordArrival,
        shouldAnnounceDecrypted,
    } from "$lib/utils/liveAnnouncer";

    // Shared empty list for the avatars-off path — one allocation instead of a
    // fresh [] per message. Taking this branch also means receiptTick is never
    // read, so receipts stop invalidating the timeline entirely.
    const NO_RECEIPTS: ReadReceiptInfo[] = [];

    interface Props {
        room: Room;
        isMobile?: boolean;
        onMenuOpen?: () => void;
    }

    let { room, isMobile = false, onMenuOpen }: Props = $props();

    // Let the room's own content (timeline, avatars) claim connections first,
    // then warm its custom emoji in the background.
    const EMOJI_PRELOAD_DEFER_MS = 1200;

    let scrollEl: HTMLDivElement | undefined = $state();
    let bottomAnchorEl: HTMLDivElement | undefined = $state();
    let topSentinelEl: HTMLDivElement | undefined = $state();
    let messageInputEl: ReturnType<typeof MessageInput> | undefined = $state();
    // Measured composer height (padding included) so the floating "Jump to
    // present" / "Searching…" pills always clear the input, however tall it
    // grows with multi-line drafts, replies or the attachment drawer.
    let composerHeight = $state(0);
    // True while the composer is showing a mention/emoji/slash suggestion list.
    // The "jump to present" pill is hidden under it (Discord-style: the list
    // takes that space — you're not jumping back mid-mention).
    let composerAutocompleteOpen = $state(false);
    let isAtBottom = $state(true);
    let loadingOlder = $state(false);
    // Shared by backfillFromTop and recoverScrollback. Not a plain boolean: a
    // request that arrives while it's held must be remembered and re-run, or a
    // room opened during another room's pagination renders empty forever (the
    // sentinel observer won't re-fire without an intersection transition).
    const backfillGate = createBackfillGate();
    let replyToEvent = $state<MatrixEvent | null>(null);
    let editRequestedEventId = $state<string | null>(null);
    let threadRootId = $state<string | null>(null);
    // Desktop: thread replaces the timeline instead of docking as a side
    // panel. Sticky for the session so an expanded reader stays expanded
    // across threads; reset on room switch. Mobile always renders fullscreen.
    let threadFullscreen = $state(false);

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
        threadFullscreen = false;
        revealedBlockedIds = {};
    });

    // Bridged/quiet senders whose m.room.member event wasn't lazy-loaded render
    // as their raw MXID (no display name, no avatar) until the member arrives.
    // Fetch the full roster on room open so every sender resolves, then bump
    // roomsTick so already-rendered rows re-derive their name/avatar — the
    // getMember reads don't re-run on their own when the member mutates in
    // place. Idempotent (loadMembersIfNeeded caches); the bump is untracked so
    // it can't re-enter this effect.
    $effect(() => {
        const r = room;
        void r.roomId;
        loadRoomMembersIfNeeded(r)
            .then(() => untrack(() => roomsState.roomsTick++))
            .catch(() => {});
    });

    // Warm this room's custom emoji in the background on open so the picker and
    // inline :shortcode: images render instantly instead of trickling in over
    // uncached (and, for remote packs, federated ~1s-each) media fetches.
    // Deferred so the room's own content loads first; fire-and-forget and
    // session-deduped inside preloadRoomEmoji. Space id/list read untracked so
    // only a room change re-arms it.
    $effect(() => {
        const r = room;
        void r.roomId;
        const spaceId = untrack(() => roomsState.activeSpaceId);
        const spaces = untrack(() => roomsState.spaces);
        const timer = setTimeout(
            () => preloadRoomEmoji(r, spaceId, spaces),
            EMOJI_PRELOAD_DEFER_MS,
        );
        return () => clearTimeout(timer);
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
    const showThreadsPanel = $derived(interfaceState.sidebar === "threads");
    const showMediaPanel = $derived(interfaceState.sidebar === "media");
    const showRightPanel = $derived(
        showPinnedPanel ||
            showNotificationsPanel ||
            showSearchPanel ||
            showThreadsPanel ||
            showMediaPanel,
    );

    // Room-level thread unread rollup for the threads-toggle badge. Keyed off
    // unreadTick so it refreshes on sync/receipts (live Room mutates in place).
    const threadRollup = $derived.by(() => {
        void roomsState.unreadTick;
        return rollupRoomThreadUnread(
            getRoomThreads(room).map((t) => ({
                total: t.unreadTotal,
                highlight: t.unreadHighlight,
            })),
        );
    });

    function toggleSidebar(id: SidebarId) {
        if (interfaceState.sidebar === id) closeSidebar();
        else openSidebar(id, () => {});
    }
    const pinnedCount = $derived.by(() => {
        void roomsState.roomsTick;
        return getPinnedEventIds(room).length;
    });

    // Mobile only: threads / pinned / notifications / members move off the
    // header into a "⋯" sheet so the room name and topic get width at 412px.
    // It uses the shared modal slot, so Escape and Android's back button
    // dismiss it through AppShell.dismissTopmost like every other popup.
    const overflowOpen = $derived(
        interfaceState.modal === "room-header-overflow",
    );

    // On desktop each of the four buttons colours itself accent while its own
    // panel is open. The "⋯" trigger stands in for all four, so it has to carry
    // that signal too — otherwise opening the member list on mobile leaves the
    // header with no indication that any panel is open.
    const overflowActive = $derived(
        overflowOpen ||
            showThreadsPanel ||
            showPinnedPanel ||
            showNotificationsPanel ||
            showMemberList,
    );

    function toggleOverflowMenu() {
        if (interfaceState.modal === "room-header-overflow") closeModal();
        else openModal("room-header-overflow", () => {});
    }

    function chooseOverflowItem(key: RoomHeaderMenuKey) {
        toggleSidebar(key);
    }

    // The sheet only renders while `isMobile && overflowOpen`, but the slot it
    // registers in is global. Widening past the 767px breakpoint (devtools,
    // an Electron window, a tablet rotating) or unmounting this component
    // (call view, inbox, no active room) makes the sheet disappear WITHOUT
    // touching interfaceState.modal, stranding the slot on an invisible modal:
    // AppShell.dismissTopmost() then swallows the next Escape/back that should
    // have closed a sidebar, type-to-focus stays disabled, and mobile keeps a
    // matrixBackGuard history entry pushed. Release it on both paths.
    //
    // Id-guarded rather than an unconditional closeModal() so it is idempotent
    // and can never dismiss a modal some other component now owns.
    function releaseOverflowSlot() {
        if (interfaceState.modal === "room-header-overflow") closeModal();
    }

    // Tracks `isMobile` and nothing else — the interfaceState read AND write
    // both live inside untrack(), so this effect can never take its own store
    // write as a dependency and re-trigger itself (effect_update_depth_exceeded).
    $effect(() => {
        if (isMobile) return;
        untrack(releaseOverflowSlot);
    });

    // Unmount half, mirroring Lightbox's teardown.
    onMount(() => releaseOverflowSlot);

    // Any loud (red) notification anywhere → badge the mobile hamburger.
    const hasAnyLoud = $derived(getLoudNotificationCount() > 0);

    let jumpingToEventId = $state<string | null>(null);

    async function scrollToMessage(eventId: string) {
        let el = document.querySelector(`[data-event-id="${eventId}"]`);
        if (!el) {
            jumpingToEventId = eventId;
            try {
                const win = await createContextWindow(room, eventId);
                if (win) {
                    contextWindow = win;
                    contextMessages = getContextWindowEvents(win);
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
                target.scrollIntoView({
                    behavior: scrollBehavior(),
                    block: "center",
                }),
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
            await joinRoom(
                tombstone.replacementRoomId,
                tombstone.senderServer ? [tombstone.senderServer] : undefined,
            );
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

    // Right-hand drawer: it parks at +MEMBER_WIDTH when closed and opens at 0.
    // It stays mounted while closed, so without this a hardware keyboard tabs
    // into invisible controls (audit A11Y-02). Same notion as the box-shadow
    // gate in the markup (`memberTranslate >= MEMBER_WIDTH`).
    const memberDrawerClosed = $derived(
        isOffCanvasClosed(memberTranslate, MEMBER_WIDTH),
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

    // Right-hand drawer: parks at +PINNED_WIDTH when closed, opens at 0. Same
    // notion as the box-shadow gate in the markup
    // (`pinnedTranslate >= PINNED_WIDTH`).
    const rightPanelClosed = $derived(
        isOffCanvasClosed(pinnedTranslate, PINNED_WIDTH),
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
    // Tick dependency: a Room mutates in place, so a plain $derived over it
    // would not re-run once the create event is seeded late.
    const isVideoRoomView = $derived(
        (void roomsState.roomsTick, isVideoRoom(room)),
    );
    // Jump-to-message ("context") view. Jumping to a far-back message loads a
    // paginating TimelineWindow around it instead of the live timeline, so the
    // user can scroll freely both ways from that point (unlike the old static
    // 50-event snapshot). `contextMessages` is the rendered snapshot, refreshed
    // from the window after each pagination; scrolling to the live edge hands
    // back to the live timeline (see rejoinLive / maybeLoadNewer).
    let contextWindow = $state<TimelineWindow | null>(null);
    let contextMessages = $state<MatrixEvent[] | null>(null);
    let loadingNewer = $state(false);
    const messages = $derived(contextMessages ?? getMessages(roomId));
    const isContextView = $derived(contextMessages !== null);

    // The event ID the user has read up to — used to show "New messages" divider on load
    let unreadMarkerEventId = $state<string | null>(null);

    // Clear reply and context view when switching rooms
    $effect(() => {
        room.roomId; // track room changes
        replyToEvent = null;
        contextWindow = null;
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
                markAsReadIfDisplayable();
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
            if (isAtBottom) markAsReadIfDisplayable();
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
                    markAsReadIfDisplayable();
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
                    markAsReadIfDisplayable();
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
        // Same gate as backfillFromTop, so the top-sentinel observer can't
        // interleave — and so a fill request swallowed during this recovery is
        // re-run once we're done instead of being lost.
        if (!backfillGate.tryEnter()) return;
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
            if (backfillGate.exit()) void backfillFromTop();
        }
    }

    // Screen-reader announcer for arriving messages (A11Y-06). $state.raw: the
    // reducer replaces the value wholesale and signals "nothing to say" by
    // returning the identical object — a deep proxy would break that identity
    // check and restart the debounce timer forever.
    let announcerState = $state.raw(EMPTY_ANNOUNCER);
    let announcement = $state("");
    let announceTimer: ReturnType<typeof setTimeout> | undefined;

    // Queue one live arrival for the polite region below the timeline. Called
    // from SDK subscription callbacks, NOT from an `$effect`: an effect that
    // both read and wrote this state would re-enter itself.
    function queueArrivalAnnouncement(event: MatrixEvent) {
        const arrivedBody = event.getContent()?.body;
        const next = recordArrival(announcerState, {
            eventId: event.getId() ?? "",
            sender: event.sender?.name ?? event.getSender() ?? "Someone",
            isOwn: event.getSender() === auth.userId,
            // showAllEvents lets non-message events through, where `body` may
            // be missing or not a string.
            body: typeof arrivedBody === "string" ? arrivedBody : "",
        });
        // Identity check, not equality: an unchanged state means the message
        // was dropped (own echo, duplicate), so the in-flight burst timer must
        // keep running untouched.
        if (next === announcerState) return;
        announcerState = next;
        clearTimeout(announceTimer);
        announceTimer = setTimeout(() => {
            const drained = drainAnnouncement(announcerState);
            announcerState = drained.state;
            // A live region only speaks when its text CHANGES, so two
            // identical summaries in a row ("2 new messages from Alice"
            // twice) would leave the second silent. Toggle a ZERO WIDTH SPACE
            // (U+200B) rather than a normal space: the browser's a11y layer
            // normalises whitespace before comparing the region's text, so a
            // trailing space may not register as a change at all. U+200B
            // survives that normalisation and is not spoken.
            announcement =
                drained.text && drained.text === announcement
                    ? `${drained.text}\u200b`
                    : drained.text;
        }, ANNOUNCE_DEBOUNCE_MS);
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
                    queueArrivalAnnouncement(event);
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
        // An encrypted message reaches the timeline as `m.room.encrypted`, a
        // type onTimelineEvent filters out, so the announcer above never sees
        // it — and new DMs default to encrypted, so that is most traffic.
        // onDecryptedTimelineEvent replays the SAME liveness signal the
        // plaintext path gates on (the SDK's `data.liveEvent`, recorded when
        // the ciphertext hit the timeline, backfill already excluded there),
        // plus a sync-completion flag. So a scrollback or key-backup decrypt
        // of history cannot reach the announcer. The reducer dedupes by event
        // id, so an event both paths see is still announced once.
        const unsubDecryptedAnnounce = onDecryptedTimelineEvent(
            (event, eventRoom, meta) => {
                if (eventRoom.roomId !== currentRoomId || isContextView) return;
                if (!shouldAnnounceDecrypted(meta)) return;
                queueArrivalAnnouncement(event);
            },
        );
        return () => {
            unsub();
            unsubDecryptedAnnounce();
            // Room switch or unmount: drop the pending burst rather than
            // announcing the previous room's messages in this one.
            clearTimeout(announceTimer);
            announcerState = EMPTY_ANNOUNCER;
            announcement = "";
        };
    });

    // Incoming encrypted messages reach the live timeline as `m.room.encrypted`
    // and are filtered out of the live-append path (onTimelineEvent) until they
    // decrypt. Re-read the timeline when an event in this room finishes
    // decrypting so new encrypted messages appear live instead of only after a
    // manual reload. getTimelineMessages includes the now-decrypted message and
    // still excludes decrypted reactions, so the re-read stays correct.
    $effect(() => {
        const currentRoomId = roomId;
        const currentRoom = room;
        const unsub = onEventDecrypted(
            (_event: MatrixEvent, eventRoom: Room) => {
                if (eventRoom.roomId !== currentRoomId || isContextView) return;
                setMessages(currentRoomId, getTimelineMessages(currentRoom));
                if (isAtBottom) {
                    tick().then(() => scrollToBottom(false));
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
        if (!last) return;
        sendReadReceipt(last).catch(() => {});
        bumpUnreadTick();
        unreadMarkerEventId = null;
    }

    // A read receipt tells other clients the user has *seen* an event, so only
    // send one when the app could actually display it: the window focused AND
    // the tab visible. Every markAsRead() call site funnels through this gate
    // (see canSendReceipt) so receipts never fire while the app is hidden or
    // in the background. While gated out, local unread state deliberately
    // persists — it clears when the user next focuses (onWindowFocusRegained).
    function markAsReadIfDisplayable() {
        if (
            canSendReceipt({
                hasFocus: document.hasFocus(),
                visible: document.visibilityState === "visible",
            })
        ) {
            markAsRead();
        }
    }

    // When the app regains focus/visibility, clear unread the moment the user
    // actually looks — preserving today's perceived behavior now that receipts
    // wait for focus. This runs the existing "at bottom → mark read" path once.
    // markAsRead() synchronously fires app-level listeners, so this MUST stay a
    // plain DOM listener (registered in onMount below); calling it inside a
    // tracked $effect would trip effect_update_depth_exceeded and freeze the
    // component. visibilitychange fires both ways — the canSendReceipt gate
    // inside markAsReadIfDisplayable makes the hidden transition a no-op.
    function onWindowFocusRegained() {
        // In context view "at bottom" is the bottom of the jumped-to window, not
        // the live tail — don't send a receipt for the latest event then.
        if (isAtBottom && !isContextView) markAsReadIfDisplayable();
    }

    onMount(() => {
        window.addEventListener("focus", onWindowFocusRegained);
        document.addEventListener("visibilitychange", onWindowFocusRegained);
        return () => {
            window.removeEventListener("focus", onWindowFocusRegained);
            document.removeEventListener(
                "visibilitychange",
                onWindowFocusRegained,
            );
        };
    });

    function scrollToBottom(instant: boolean) {
        if (!scrollEl) return;
        scrollEl.scrollTo({
            top: scrollEl.scrollHeight,
            behavior: scrollBehavior(instant ? "instant" : "smooth"),
        });
        markAsReadIfDisplayable();
    }

    // Supplemental scroll anchor. When content grows LATE while the user is
    // reading history — a link-preview card fetching in, an image decoding — the
    // message they are looking at would jump. Native `overflow-anchor` is meant
    // to absorb this but is unreliable across programmatic scrolls and dynamic
    // subtrees (confirmed: preview cards still shove the timeline). So we pin the
    // first visible message ourselves. It is deliberately gated to fire ONLY
    // while calmly reading history (see anchoringActive) so it never fights
    // bottom-sticking, backfill's own scroll preservation, or a jump animation.
    let anchorEl: HTMLElement | null = null;
    let anchorOffset = 0;

    function anchoringActive(): boolean {
        return (
            !!scrollEl &&
            !isAtBottom &&
            !loadingOlder &&
            intervalId === undefined &&
            jumpingToEventId === null
        );
    }

    // The reading line: pin the message the user is actually looking at — a point
    // partway down the viewport — not the top-most visible one. Growth ABOVE the
    // line is absorbed by pushing already-read content up; growth BELOW it pushes
    // down into the unread region. Either way the message being read stays put, so
    // a late preview/image just moves the jump off into the periphery. Center reads
    // best; ~0.35 is the fallback candidate if it feels low (feel call — tune live).
    const READING_LINE_FRACTION = 0.5;

    // Record the message crossing the reading line and its offset from the
    // viewport top.
    function captureScrollAnchor() {
        if (!anchoringActive()) {
            anchorEl = null;
            return;
        }
        const cTop = scrollEl!.getBoundingClientRect().top;
        const line = scrollEl!.clientHeight * READING_LINE_FRACTION;
        // Fallback for short/gappy content where nothing spans the line: the first
        // message reaching into the viewport, i.e. the old top-visible target.
        let fallbackEl: HTMLElement | null = null;
        let fallbackOffset = 0;
        for (const el of scrollEl!.querySelectorAll<HTMLElement>(
            "[data-event-id]",
        )) {
            const r = el.getBoundingClientRect();
            const top = r.top - cTop;
            const bottom = r.bottom - cTop;
            if (fallbackEl === null && bottom > 8) {
                fallbackEl = el;
                fallbackOffset = top;
            }
            if (top <= line && bottom >= line) {
                anchorEl = el;
                anchorOffset = top;
                return;
            }
        }
        anchorEl = fallbackEl;
        if (fallbackEl) anchorOffset = fallbackOffset;
    }

    // If the anchored message moved (content above/within it changed size),
    // cancel the move so the reading position stays put. Sub-pixel drift is left
    // to the browser; we only undo real jumps.
    function restoreScrollAnchor() {
        if (!anchoringActive() || !anchorEl || !anchorEl.isConnected) return;
        const cTop = scrollEl!.getBoundingClientRect().top;
        const delta =
            anchorEl.getBoundingClientRect().top - cTop - anchorOffset;
        if (delta > 2 || delta < -2) scrollEl!.scrollTop += delta;
    }

    function onScroll() {
        if (!scrollEl) return;
        const { scrollTop, clientHeight, scrollHeight } = scrollEl;
        const wasAtBottom = isAtBottom;
        isAtBottom = isNearBottom(scrollTop, clientHeight, scrollHeight);
        // Track the reading position so a late content change can be undone.
        captureScrollAnchor();

        // Receipts advance the live read marker; in context view the bottom of
        // the window is not the live tail, so don't mark read while browsing it.
        if (!wasAtBottom && isAtBottom && !isContextView)
            markAsReadIfDisplayable();
        // Loading older messages near the top is driven by the IntersectionObserver
        // on topSentinelEl (see below) — more reliable than a scroll-position check.
        // Loading newer messages (and rejoining live) is driven here: while in a
        // jumped-to context view, approaching the bottom pages the window forward.
        if (isContextView) {
            const distanceToBottom = scrollHeight - scrollTop - clientHeight;
            if (distanceToBottom < 600) void maybeLoadNewer();
        }
    }

    async function loadOlderMessages() {
        if (loadingOlder) return;
        // Context view paginates the jumped-to window; the live view paginates
        // the live timeline. Both share the scroll-preservation dance below.
        if (isContextView) {
            if (
                !contextWindow ||
                !contextWindowCanPaginate(contextWindow, false)
            )
                return;
        } else if (!canLoadMore(roomId)) {
            return;
        }
        loadingOlder = true;
        // Scroll preservation across a history prepend. The reference is the
        // oldest rendered message; after prepending we nudge it back to the
        // viewport offset it held just before — a self-correcting form that lands
        // it right whether or not the browser's native scroll anchoring also
        // compensated (Chromium/Firefox do, WebKit doesn't). Do NOT replace this
        // with a "shift by the inserted height" calculation: where native
        // anchoring is active it already added that height, so shifting again
        // double-counts and flings the timeline (bit us 2026-08-18).
        //
        // CRUCIAL: capture the reference AFTER the async load resolves and right
        // BEFORE applying it to the DOM — not before the await. The load takes
        // ~100ms+, during which the user keeps scrolling; capturing up front and
        // pinning to it rewinds that in-flight scroll, which reads as a stutter
        // when history loads mid-scroll. Capturing post-load leaves only a
        // sub-frame gap, so the correction cancels the prepend and nothing else.
        let refId: string | undefined;
        let prevTop: number | undefined;

        try {
            if (isContextView && contextWindow) {
                await paginateContextWindow(contextWindow, false);
                const refEl = scrollEl?.querySelector("[data-event-id]");
                refId = (refEl as HTMLElement | null)?.dataset.eventId;
                prevTop = refEl?.getBoundingClientRect().top;
                contextMessages = getContextWindowEvents(contextWindow);
            } else {
                const hasMore = await loadPreviousMessages(room);
                if (!hasMore) setCanLoadMore(roomId, false);
                const events = getTimelineMessages(room);
                const refEl = scrollEl?.querySelector("[data-event-id]");
                refId = (refEl as HTMLElement | null)?.dataset.eventId;
                prevTop = refEl?.getBoundingClientRect().top;
                setMessages(roomId, events);
            }

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

    // Extend a jumped-to context window towards newer messages as the user
    // scrolls down. Once the window reaches the live edge AND the user is at the
    // bottom, hand back to the live timeline so new messages append and the
    // "Viewing message context" banner clears — the seamless "scroll down to
    // rejoin the present" that jumping to an old message used to lack.
    async function maybeLoadNewer() {
        if (loadingNewer || !isContextView || !contextWindow) return;
        if (contextWindowCanPaginate(contextWindow, true)) {
            loadingNewer = true;
            try {
                await paginateContextWindow(contextWindow, true);
                contextMessages = getContextWindowEvents(contextWindow);
            } finally {
                loadingNewer = false;
            }
        } else if (isAtBottom) {
            rejoinLive();
        }
    }

    // Leave context view and return to the live timeline, scrolled to the
    // present. The window's newest event is the live timeline's newest, so from
    // the bottom this swap is visually seamless.
    function rejoinLive() {
        contextWindow = null;
        contextMessages = null;
        setMessages(roomId, getTimelineMessages(room));
        tick().then(() => scrollToBottom(true));
    }

    // Whether older history can still load: the live timeline's pagination
    // token, or the context window's backwards edge.
    function hasOlderToLoad(): boolean {
        return isContextView
            ? !!contextWindow && contextWindowCanPaginate(contextWindow, false)
            : canLoadMore(roomId);
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
        if (!backfillGate.tryEnter()) return;
        try {
            await tick();
            let guard = 0;
            while (
                hasOlderToLoad() &&
                isTopSentinelNearViewport() &&
                guard++ < 50
            ) {
                await loadOlderMessages();
                await tick();
            }
        } finally {
            // A request arrived while we held the gate (typically this room's
            // own first fill, swallowed by the previous room's loop): serve it.
            if (backfillGate.exit()) void backfillFromTop();
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

    // Keep the reading position pinned when timeline content grows AFTER it
    // rendered: a link-preview card mounting (DOM mutation) or media finishing
    // load (a `load` event, which doesn't bubble → capture phase). The restore
    // runs SYNCHRONOUSLY in the observer callback — a MutationObserver callback
    // is a microtask, so it fires after the growth but BEFORE the browser paints
    // the frame; correcting scrollTop there cancels the jump in the same frame
    // (deferring to requestAnimationFrame would let the shifted frame paint
    // first, so the user still sees it flick). restoreScrollAnchor no-ops unless
    // we're calmly reading history and the anchor actually moved, so this is
    // inert at the bottom, during backfill, and during a jump.
    $effect(() => {
        const root = scrollEl;
        roomId; // re-establish per room
        if (!root) return;
        const onMediaLoad = (e: Event) => {
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "IMG" || t.tagName === "VIDEO"))
                restoreScrollAnchor();
        };
        const mo = new MutationObserver(restoreScrollAnchor);
        mo.observe(root, { childList: true, subtree: true });
        root.addEventListener("load", onMediaLoad, true);
        return () => {
            mo.disconnect();
            root.removeEventListener("load", onMediaLoad, true);
        };
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
            <Hash size={20} class="text-discord-textMuted flex-shrink-0" />
            <!-- 5rem floor below md only: the header's buttons cannot shrink, so
                 without a floor the name and topic each get a proportional share of
                 the deficit at 412px and neither renders even an ellipsis. Above md
                 there is ample width, so drop the floor rather than strand short
                 names (a DM titled "Zam" would sit 50px from the lock icon). -->
            <h2
                class="font-semibold text-discord-textPrimary min-w-[5rem] md:min-w-0 truncate"
                title={roomName}
            >
                {@html renderPlainTextWithTwemoji(roomName)}
            </h2>
            {#if roomEncrypted}
                <span
                    class="flex-shrink-0 text-discord-textMuted"
                    title="Encryption enabled"
                    aria-label="Encryption enabled"
                >
                    <Lock size={16} />
                </span>
            {/if}
            {#if topic}
                <div class="w-px h-5 bg-discord-divider"></div>
                <p
                    class="text-sm text-discord-textMuted truncate flex-auto min-w-0"
                    title={topic}
                >
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
            {#if callCount > 0 || isVideoRoomView}
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
            <!-- Threads, pinned, notifications and the member list are desktop
                 only; on mobile they live in the "⋯" sheet below so the room
                 name and topic are not starved by eight unshrinkable buttons. -->
            {#if !isMobile}
                <!-- Threads list button -->
                <button
                    onclick={() => toggleSidebar("threads")}
                    class="relative p-1.5 rounded transition-colors {showThreadsPanel
                        ? 'text-discord-accent bg-discord-messageHover'
                        : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                    title="Threads"
                    aria-label="Toggle threads list"
                >
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"
                        ><path
                            d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm2 5h12V7H6v2zm0 4h9v-2H6v2z"
                        /></svg
                    >
                    {#if threadRollup.mentions > 0}
                        <span
                            class="absolute -top-1 -right-1 flex-shrink-0 bg-discord-danger text-white text-[10px] leading-none font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center ring-2 ring-discord-backgroundSecondary"
                            title="Unread thread mentions"
                            >{threadRollup.mentions > 99
                                ? "99+"
                                : threadRollup.mentions}</span
                        >
                    {:else if threadRollup.anyUnread}
                        <span
                            class="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-discord-accent ring-2 ring-discord-backgroundSecondary"
                            title="Unread threads"
                        ></span>
                    {/if}
                </button>
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
                <!-- Media and files browser -->
                <button
                    onclick={() => toggleSidebar("media")}
                    class="p-1.5 rounded transition-colors {showMediaPanel
                        ? 'text-discord-accent bg-discord-messageHover'
                        : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                    title="Media and files"
                    aria-label="Media and files"
                >
                    <Image size={20} />
                </button>
                <!-- Toggle member list -->
                <button
                    onclick={() => toggleSidebar("members")}
                    class="p-1.5 rounded transition-colors {showMemberList
                        ? 'text-discord-accent bg-discord-messageHover'
                        : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                    title="Toggle member list"
                >
                    <Users size={20} />
                </button>
            {:else}
                <button
                    onclick={toggleOverflowMenu}
                    class="relative p-1.5 rounded transition-colors flex-shrink-0 {overflowActive
                        ? 'text-discord-accent bg-discord-messageHover'
                        : 'text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover'}"
                    title="More"
                    aria-label="More room options"
                    aria-haspopup="menu"
                    aria-expanded={overflowOpen}
                >
                    <MoreHorizontal size={20} />
                    {#if threadRollup.mentions > 0}
                        <span
                            class="absolute -top-1 -right-1 flex-shrink-0 bg-discord-danger text-white text-[10px] leading-none font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center ring-2 ring-discord-backgroundSecondary"
                            title="Unread thread mentions"
                            >{threadRollup.mentions > 99
                                ? "99+"
                                : threadRollup.mentions}</span
                        >
                    {:else if threadRollup.anyUnread}
                        <span
                            class="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-discord-accent ring-2 ring-discord-backgroundSecondary"
                            title="Unread threads"
                        ></span>
                    {/if}
                </button>
            {/if}
        </div>

        <ActiveCallBanner {room} />
        <LiveLocationBanner {room} />

        <!-- Messages scrollable area. aria-live="off" is load-bearing: role="log"
             implies aria-live="polite", and backfill replaces the whole messages
             array, so an implicit live region would re-announce the entire
             visible history on every scroll-up. Arrivals are announced by the
             dedicated sr-only region after this container instead. -->
        <div
            bind:this={scrollEl}
            onscroll={onScroll}
            onwheel={stopScrollIntoView}
            ontouchstart={stopScrollIntoView}
            role="log"
            aria-label="Message timeline"
            aria-live="off"
            class="overflow-y-auto overflow-x-hidden flex flex-1 flex-col{isAtBottom
                ? ' *:[overflow-anchor:none]'
                : ''}"
        >
            <!-- Pushes a short timeline down so it hugs the composer, like
                 flex-col-reverse used to. -->
            <div class="mt-auto flex-shrink-0"></div>

            <!-- Backfill sentinel at the visual top (= oldest-loaded edge).
                 The IntersectionObserver watches it to load older history —
                 for both the live timeline and a jumped-to context window. -->
            <div
                bind:this={topSentinelEl}
                class="h-px w-full flex-shrink-0"
            ></div>

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
                        Welcome to #{@html renderPlainTextWithTwemoji(
                            roomName,
                        )}!
                    </h3>
                    <p class="text-discord-textMuted">
                        This is the beginning of the #{@html renderPlainTextWithTwemoji(
                            roomName,
                        )} room.
                    </p>
                </div>
            {/if}

            <!-- Message list (chronological: DOM order matches visual order,
                 so selection and copy across messages behave natively) -->
            {#each messages as event, i (event.getId())}
                {@const sepTs = dateSeparatorLabel(messages, i)}
                {@const receipts = settingsState.showReadReceiptAvatars
                    ? (void receiptTick, getReceiptsForEvent(room, event))
                    : NO_RECEIPTS}
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
                        <div class="flex-1 h-px bg-discord-danger/60"></div>
                        <span
                            class="text-xs font-semibold text-discord-danger uppercase tracking-wide"
                            >New Messages</span
                        >
                        <div class="flex-1 h-px bg-discord-danger/60"></div>
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
                        mentionHighlight={isHighlightEvent(event)}
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

        <!-- Polite announcer for arriving messages. A sibling of the timeline,
             never a child: a live region inside role="log" is announced twice.
             Debounced upstream so a burst is one utterance. -->
        <div
            class="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            {announcement}
        </div>

        <!-- Scroll to bottom button. Hidden while a composer suggestion list is
             open so it doesn't fight the autocomplete for the same space. -->
        {#if !isAtBottom && !isContextView && messages.length > 0 && !composerAutocompleteOpen}
            <div
                class="absolute left-0 right-0 flex justify-center z-10 pointer-events-none"
                style="bottom: {composerHeight + 12}px;"
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
                class="absolute left-0 right-0 flex justify-center z-10 pointer-events-none"
                style="bottom: {composerHeight + 12}px;"
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
                        onclick={rejoinLive}
                        class="ml-1 underline hover:no-underline"
                        >Return to live</button
                    >
                </div>
            </div>
        {/if}

        <!-- Message input. Wrapped so its rendered height can be measured and
             the floating pills above can be offset to clear it. -->
        <div bind:clientHeight={composerHeight} class="flex-shrink-0">
            <MessageInput
                bind:this={messageInputEl}
                bind:autocompleteOpen={composerAutocompleteOpen}
                {roomId}
                {roomName}
                {room}
                {replyToEvent}
                {scrollEl}
                onCancelReply={() => {
                    replyToEvent = null;
                }}
                onRequestEditLast={requestEditLastMessage}
                onThreadCreated={openThread}
            />
        </div>
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
            inert={rightPanelClosed}
            aria-hidden={rightPanelClosed ? "true" : undefined}
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
            {:else if showThreadsPanel}
                <ThreadsListPanel
                    {room}
                    onClose={closeSidebar}
                    onOpenThread={openThread}
                />
            {:else if showMediaPanel}
                <RoomMediaPanel {room} onClose={closeSidebar} />
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
    {:else if showThreadsPanel}
        <ThreadsListPanel
            {room}
            onClose={closeSidebar}
            onOpenThread={openThread}
        />
    {:else if showMediaPanel}
        <RoomMediaPanel {room} onClose={closeSidebar} />
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
            inert={memberDrawerClosed}
            aria-hidden={memberDrawerClosed ? "true" : undefined}
        >
            <MemberList {room} />
        </div>
    {:else if showMemberList}
        <MemberList {room} />
    {/if}

    <!-- Thread panel. Mobile: always fullscreen over the timeline (the w-80
         side sheet was unusably cramped). Desktop: side panel by default,
         with an expand toggle that swaps it to fullscreen. -->
    {#if threadRootId}
        {#if isMobile}
            <div class="absolute inset-0 z-40">
                <ThreadPanel
                    {room}
                    rootEventId={threadRootId}
                    onClose={closeThread}
                    fullscreen
                />
            </div>
        {:else if threadFullscreen}
            <div class="absolute inset-0 z-30">
                <ThreadPanel
                    {room}
                    rootEventId={threadRootId}
                    onClose={closeThread}
                    fullscreen
                    onToggleFullscreen={() =>
                        (threadFullscreen = !threadFullscreen)}
                />
            </div>
        {:else}
            <ThreadPanel
                {room}
                rootEventId={threadRootId}
                onClose={closeThread}
                onToggleFullscreen={() =>
                    (threadFullscreen = !threadFullscreen)}
            />
        {/if}
    {/if}
</div>

{#if isMobile && overflowOpen}
    <RoomHeaderOverflowMenu
        activeSidebar={interfaceState.sidebar}
        threadMentions={threadRollup.mentions}
        threadAnyUnread={threadRollup.anyUnread}
        {pinnedCount}
        onChoose={chooseOverflowItem}
        onClose={closeModal}
    />
{/if}
