<script lang="ts">
    import { onMount } from "svelte";

    import SpaceSidebar from "$lib/components/layout/SpaceSidebar.svelte";
    import RoomList from "$lib/components/layout/RoomList.svelte";
    import MessageArea from "$lib/components/layout/MessageArea.svelte";
    import CallView from "$lib/components/layout/CallView.svelte";
    import RoomSettings from "$lib/components/layout/RoomSettings.svelte";
    import InviteModal from "$lib/components/layout/InviteModal.svelte";
    import CreatePollDialog from "$lib/components/messages/CreatePollDialog.svelte";
    import ShareLocationDialog from "$lib/components/messages/ShareLocationDialog.svelte";
    import AppSettings from "$lib/components/layout/AppSettings.svelte";
    import InboxPanel from "$lib/components/layout/InboxPanel.svelte";
    import SpaceLandingPanel from "./SpaceLandingPanel.svelte";
    import IncomingCallCard from "$lib/components/layout/IncomingCallCard.svelte";
    import VerificationModal from "$lib/components/layout/VerificationModal.svelte";
    import VerificationRequestCard from "$lib/components/layout/VerificationRequestCard.svelte";
    import ErrorToasts from "$lib/components/ui/ErrorToasts.svelte";
    import ScreenSharePicker from "$lib/components/layout/ScreenSharePicker.svelte";

    import { auth, clearSession } from "$lib/stores/auth.svelte";
    import {
        roomsState,
        setActiveSpace,
        navigateToRoom,
        bumpUnreadTick,
        reloadLastLocationFromStorage,
        resolvePendingSurface,
        resolveLandingSurface,
    } from "$lib/stores/rooms.svelte";
    import {
        interfaceState,
        openModal,
        closeModal,
        closeSidebar,
        closeSubPage,
        openComposerPicker,
    } from "$lib/stores/interface.svelte";
    import { inviteDialogState } from "$lib/stores/inviteDialog.svelte";
    import { pollDialogState } from "$lib/stores/pollDialog.svelte";
    import { locationDialogState } from "$lib/stores/locationDialog.svelte";
    import { initFavourites } from "$lib/stores/favourites.svelte";
    import { initCustomizationSync } from "$lib/stores/customizationSync.svelte";
    import { initIgnoredUsers } from "$lib/stores/ignoredUsers.svelte";
    import { initPresence } from "$lib/stores/presence.svelte";
    import { initLiveLocation } from "$lib/stores/liveLocation.svelte";
    import {
        initVoiceCall,
        leaveCall,
        joinCall,
    } from "$lib/stores/voiceCall.svelte";
    import {
        incomingCallsState,
        initIncomingCalls,
        declineIncomingCall,
        silenceIncomingCall,
    } from "$lib/stores/incomingCalls.svelte";
    import {
        verificationState,
        initVerification,
    } from "$lib/stores/verification.svelte";
    import {
        reloadAccountSettings,
        setActiveSessionGraceMs,
        settingsState,
    } from "$lib/stores/settings.svelte";
    import {
        isDesktopUpdater,
        desktopSetAutoDownload,
    } from "$lib/desktopUpdater";
    import { initUpdateWatch } from "$lib/stores/updateBanner.svelte";
    import UpdateBanner from "$lib/components/layout/UpdateBanner.svelte";
    import {
        markNotification,
        clearReadNotifications,
        reloadNotificationsFromStorage,
        getNotificationCount,
    } from "$lib/stores/notifications.svelte";
    import { updateAccountProfile } from "$lib/stores/accounts.svelte";
    import {
        getSpaces,
        getOrphanRooms,
        getDirectRooms,
        getRoomsInSpace,
        getInvitedRooms,
        getKnockedRooms,
        getSpaceLayout,
        fetchSpaceHierarchy,
        scheduleJoinedRoomsReconcile,
        getRoom,
        getRoomDisplayName,
        getMemberName,
        getDMPartnerId,
        logout,
        onRoomUpdate,
        onAccountData,
        onTimelineEvent,
        onAnyReceiptEvent,
        getClient,
        getOwnUserId,
        isInitialSyncComplete,
        clearServiceWorkerAuth,
        fetchOwnProfile,
        mxcToHttp,
        onThreadReplyEvent,
        onDecryptedTimelineEvent,
        isThreadParticipant,
        getEventThreadRootId,
        getOwnDeviceId,
        publishActiveSession,
        getActiveSessionHeartbeat,
        updateServiceWorkerNotificationPrivacy,
        type ActiveSessionHeartbeat,
    } from "$lib/matrix/client";
    import {
        shouldNotifyDecrypted,
        isAlreadyReadEvent,
        createBoundedIdSet,
    } from "$lib/utils/notifyDecrypted";
    import {
        ACTIVE_SESSION_KEY,
        IDLE_LIMIT_MS,
        MIN_HEARTBEAT_INTERVAL_MS,
        heartbeatIntervalFor,
        isDeviceInUse,
        normalizeGraceMs,
        shouldSuppressForActiveDevice,
        shouldWriteHeartbeat,
    } from "$lib/utils/activeSession";
    import { updateFaviconBadge } from "$lib/utils/faviconBadge";
    import { restoreAppWindow } from "$lib/utils/restoreWindow";
    import { previewForEvent } from "$lib/utils/encryptionState";
    import { notificationBody } from "$lib/utils/notificationPrivacy";
    import { playPing } from "$lib/audio/soundEffects";
    import { shouldNotifyThreadEvent } from "$lib/utils/threadNotify";
    import {
        notificationsToClose,
        appendPostedEventId,
        type PostedNotificationEntry,
    } from "$lib/utils/notificationDismiss";
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import { initPush, unregisterPush } from "$lib/push";
    import { initWebPush, teardownWebPush } from "$lib/webPush";
    import {
        syncNativeSession,
        clearNativeSession,
        syncNativeNotificationPrivacy,
    } from "$lib/nativeSession";
    import { Capacitor } from "@capacitor/core";
    import { App } from "@capacitor/app";

    // Room shown in the RoomSettings modal (covers both room and space settings).
    let settingsRoom = $state<Room | null>(null);

    function openAppSettings() {
        openModal("app-settings", () => {});
    }
    function openRoomSettings(r: Room) {
        // Claim first — a same-id handover runs the outgoing close, which nulls settingsRoom.
        openModal("room-settings", () => (settingsRoom = null));
        settingsRoom = r;
    }

    // Animated drawer drag (mobile)
    const DRAWER_WIDTH = 312; // 72px SpaceSidebar + 240px RoomList
    let drawerTranslate = $state(-DRAWER_WIDTH);
    let isDragging = $state(false);
    let dragStartX = 0;
    let dragBaseTranslate = 0;

    // Keep translate in sync when state changes programmatically (hamburger, etc.)
    $effect(() => {
        if (!isDragging) {
            drawerTranslate = interfaceState.leftOpen ? 0 : -DRAWER_WIDTH;
        }
    });

    const backdropOpacity = $derived(
        interfaceState.isMobile
            ? ((drawerTranslate + DRAWER_WIDTH) / DRAWER_WIDTH) * 0.5
            : 0,
    );

    let dragPending = false; // touch down, direction not yet determined
    let dragStartY = 0;
    let dragTarget: Element | null = null; // element the touch began on

    // True when the touch started inside a horizontally-scrollable element (a
    // wide code block, table, etc.) that can still scroll in the swipe's
    // direction — in which case we let it scroll natively instead of hijacking
    // the gesture to drag the drawer.
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

    function drawerDragMove(e: TouchEvent) {
        if (!dragPending && !isDragging) return;
        const touch = e.touches[0];
        const dx = touch.clientX - dragStartX;
        const dy = touch.clientY - dragStartY;

        if (dragPending) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (Math.abs(dy) > Math.abs(dx)) {
                // Primarily vertical — cancel
                dragPending = false;
                cleanupDocListeners();
                return;
            }
            // Horizontal gesture that began inside a scrollable code block /
            // table — let it scroll natively instead of opening the drawer.
            if (targetCanScrollHoriz(dragTarget, dx)) {
                dragPending = false;
                cleanupDocListeners();
                return;
            }
            const openingGesture = dx > 0 && !interfaceState.leftOpen;
            const closingGesture = dx < 0 && interfaceState.leftOpen;
            if (!openingGesture && !closingGesture) {
                dragPending = false;
                cleanupDocListeners();
                return;
            }
            dragPending = false;
            isDragging = true;
            (document.activeElement as HTMLElement)?.blur();
        }

        if (isDragging) {
            e.preventDefault();
            drawerTranslate = Math.min(
                0,
                Math.max(-DRAWER_WIDTH, dragBaseTranslate + dx),
            );
        }
    }

    function drawerDragEnd() {
        dragPending = false;
        cleanupDocListeners();
        if (!isDragging) return;
        isDragging = false;
        const progress = (drawerTranslate + DRAWER_WIDTH) / DRAWER_WIDTH;
        const startedOpen = dragBaseTranslate === 0;
        interfaceState.leftOpen = startedOpen
            ? progress >= 0.85
            : progress > 0.15;
        drawerTranslate = interfaceState.leftOpen ? 0 : -DRAWER_WIDTH;
    }

    function cleanupDocListeners() {
        document.removeEventListener("touchmove", drawerDragMove);
        document.removeEventListener("touchend", drawerDragEnd);
        document.removeEventListener("touchcancel", drawerDragEnd);
    }

    function drawerDragStart(e: TouchEvent) {
        if (
            !interfaceState.isMobile ||
            isDragging ||
            dragPending ||
            interfaceState.sidebar !== null ||
            interfaceState.lightboxOpen ||
            interfaceState.modal !== null
        )
            return;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragTarget = e.target instanceof Element ? e.target : null;
        dragBaseTranslate = interfaceState.leftOpen ? 0 : -DRAWER_WIDTH;
        dragPending = true;
        document.addEventListener("touchmove", drawerDragMove, {
            passive: false,
        });
        document.addEventListener("touchend", drawerDragEnd);
        document.addEventListener("touchcancel", drawerDragEnd);
    }

    // ── Central Escape-key + mobile back-button handling ───────────────────────
    // Priority: pop a sub-page inside the open modal → dismiss open modal →
    // dismiss open sidebar → (back only) open the left drawer → real back. All
    // driven by the interfaceState slots; no component manages its own
    // Escape/back shortcuts.
    function dismissTopmost(): boolean {
        // A sub-page (mobile settings drill-down) sits INSIDE the modal, so it
        // must pop first — one back press returns to the category list rather
        // than throwing the user out of Settings entirely.
        if (interfaceState.subPageClose) {
            closeSubPage();
            return true;
        }
        if (interfaceState.modal) {
            closeModal();
            return true;
        }
        if (interfaceState.sidebar) {
            closeSidebar();
            return true;
        }
        return false;
    }

    function onWindowKeydown(e: KeyboardEvent) {
        // Escape → dismiss the topmost popup/sidebar.
        if (e.key === "Escape") {
            if (dismissTopmost()) e.preventDefault();
            return;
        }
        // Ctrl+Shift+D → toggle the debug panel.
        if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
            e.preventDefault();
            interfaceState.debugOpen = !interfaceState.debugOpen;
            return;
        }
        // Ctrl+E / Ctrl+S / Ctrl+G → open a composer picker (only when a room
        // with a composer is visible).
        if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
            const k = e.key.toLowerCase();
            const kind =
                k === "e"
                    ? "emoji"
                    : k === "s"
                      ? "sticker"
                      : k === "g"
                        ? "gif"
                        : null;
            if (kind && activeRoom && !roomsState.showInbox) {
                e.preventDefault();
                openComposerPicker(kind);
            }
            return;
        }
        // Type-to-focus: a plain alphanumeric key focuses the composer, unless a
        // modal is open (or, on mobile, a sidebar/drawer). We don't
        // preventDefault, so the keystroke lands in the now-focused input.
        if (
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            /^[a-zA-Z0-9]$/.test(e.key) &&
            !interfaceState.modal &&
            !(
                interfaceState.isMobile &&
                (interfaceState.sidebar !== null || interfaceState.leftOpen)
            ) &&
            interfaceState.focusComposer
        ) {
            const ae = document.activeElement as HTMLElement | null;
            const editable =
                !!ae &&
                (ae.tagName === "INPUT" ||
                    ae.tagName === "TEXTAREA" ||
                    ae.isContentEditable);
            if (!editable) interfaceState.focusComposer();
        }
    }

    // On native (Capacitor) the hardware back button is handled directly via the
    // App plugin's backButton event (see onMount), so the web history guard is
    // only needed in the browser.
    // Keep a history "guard" entry on the stack whenever there's something the
    // back button should intercept (a modal, a sidebar, or the closed drawer).
    function ensureBackGuard() {
        if (Capacitor.isNativePlatform()) return;
        if (!interfaceState.isMobile) return;
        if ((history.state as { matrixBackGuard?: boolean })?.matrixBackGuard)
            return;
        setTimeout(() => {
            history.pushState({ matrixBackGuard: true }, "", location.href);
        }, 0);
    }
    $effect(() => {
        if (
            interfaceState.isMobile &&
            (interfaceState.modal !== null ||
                interfaceState.sidebar !== null ||
                !interfaceState.leftOpen)
        ) {
            ensureBackGuard();
        }
    });

    /** Shared back action: dismiss modal → sidebar → open drawer.
     *  Returns false when nothing was handled (caller decides: navigate / exit). */
    function handleBack(): boolean {
        if (dismissTopmost()) return true;
        if (!interfaceState.leftOpen) {
            interfaceState.leftOpen = true;
            return true;
        }
        return false;
    }

    // ── Active-session heartbeat ──────────────────────────────────────────
    // While this window is focused we publish "this device is in use" to
    // account data; the user's OTHER devices read it and stay quiet for
    // `graceMs`. Deliberately NOT an $effect — this is an SDK write, and SDK
    // writes inside tracked effects have deadlocked this app before.
    let lastHeartbeatWriteTs: number | null = null;

    // When the user last actually did something here. Plain `let`, like the
    // write stamp above: it feeds an SDK write, and making an SDK call's
    // inputs reactive is exactly the pattern that has deadlocked this app.
    // Seeded at mount (opening the app is an interaction) and bumped by the
    // passive input listeners registered there.
    let lastInputTs: number | null = null;

    // The account's newest heartbeat, refreshed from sync. Plain `let`: it is
    // read from notification callbacks, never from a tracked scope, and
    // nothing in the markup renders it.
    let activeSessionHeartbeat: ActiveSessionHeartbeat | null = null;

    function maybeWriteHeartbeat() {
        // publishActiveSession() silently no-ops before login (no client / no
        // device id). Bail here instead, so we don't stamp a write that never
        // happened and then sit out a whole interval.
        if (!getOwnDeviceId()) return;
        const grace = normalizeGraceMs(settingsState.activeSessionGraceMs);
        // Off: nothing to claim, and the blob's own persisted graceMs: 0 is
        // what tells the other devices the feature is off — so a periodic
        // re-PUT buys nothing. Task 6 publishes explicitly when the setting
        // changes, which is what actually propagates a change.
        if (grace <= 0) return;
        if (
            !shouldWriteHeartbeat({
                lastWriteTs: lastHeartbeatWriteTs,
                now: Date.now(),
                // Focus alone is not enough to claim the account: a focused
                // window whose owner walked away (or whose screen locked
                // without blurring, as on macOS and some Windows paths) would
                // keep republishing for hours and silence the phone — which
                // has no inbox to fall back on. Require recent input too.
                hasFocus: isDeviceInUse({
                    hasFocus: document.hasFocus(),
                    lastInputTs,
                    now: Date.now(),
                    idleLimitMs: IDLE_LIMIT_MS,
                }),
                // NOT the bare HEARTBEAT_INTERVAL_MS constant: a 15s grace
                // needs a faster refresh than 30s or the blob expires while
                // the device is still in use and suppression flaps.
                intervalMs: heartbeatIntervalFor(grace),
            })
        )
            return;
        lastHeartbeatWriteTs = Date.now();
        // Fire-and-forget: a failed heartbeat just means other devices keep
        // notifying, which is the safe direction. The `false` return (write
        // skipped) is likewise nothing to act on here — the getOwnDeviceId()
        // guard above already covers it, and Settings is where a skipped write
        // actually needs reporting.
        void publishActiveSession(grace).catch(() => {});
    }

    // roomId → the live OS notification for that room, plus the events it has
    // covered. Message notifications are tagged per ROOM (not per event, as
    // they were), so a room shows one collapsing notification and closing it
    // when the user reads elsewhere is a single lookup. Same shape as
    // `notifiedCalls` below. A plain Map on purpose: it is read from
    // notification callbacks and from an $effect, and making it reactive
    // would turn a close() into a dependency of the effect that triggers it.
    const postedRoomNotifications = new Map<
        string,
        { notification: Notification; eventIds: string[] }
    >();

    /** Snapshot for the pure rule — the Map itself never leaves this file. */
    function postedEntries(): PostedNotificationEntry[] {
        return [...postedRoomNotifications.entries()].map(
            ([roomId, entry]) => ({ roomId, eventIds: entry.eventIds }),
        );
    }

    function closeRoomNotifications(roomIds: readonly string[]) {
        for (const roomId of roomIds) {
            const entry = postedRoomNotifications.get(roomId);
            if (!entry) continue;
            postedRoomNotifications.delete(roomId);
            try {
                entry.notification.close();
            } catch {
                /* already gone — nothing to do */
            }
        }
    }

    // Show an OS desktop notification via the Web Notification API. Works in the
    // browser and in Electron (which maps it to a native notification) with no
    // push service. Suppressed when the user is already viewing that room in a
    // focused window.
    function showDesktopNotification(
        event: MatrixEvent,
        room: Room,
        body: string,
    ) {
        if (
            typeof Notification === "undefined" ||
            Notification.permission !== "granted"
        )
            return;
        if (
            document.hasFocus() &&
            !roomsState.showInbox &&
            roomsState.activeRoomId === room.roomId
        )
            return;
        const sender = getMemberName(room, event.getSender() ?? "");
        const eventId = event.getId();
        try {
            const n = new Notification(getRoomDisplayName(room), {
                body: notificationBody({
                    sender,
                    body,
                    hideBody: settingsState.hideNotificationBody,
                }),
                icon: "/favicon.png",
                badge: "/favicon_foreground.png",
                // Per ROOM, not per event: a room shows one collapsing
                // notification instead of a growing stack, and "close what
                // they've now read" becomes one lookup. `renotify` keeps the
                // OS alerting on each replacement, which is what a per-event
                // tag used to give for free. It is a persistent-notification
                // option, so TypeScript's NotificationOptions omits it —
                // browsers that don't honour it simply replace silently. The
                // cast spells out the one extra key instead of asserting to
                // the bare type, so what we are adding stays visible here
                // rather than looking like an unexplained cast.
                tag: `room:${room.roomId}`,
                renotify: true,
            } as NotificationOptions & { renotify?: boolean });
            n.onclick = () => {
                // window.focus() alone cannot un-hide a tray-hidden Electron
                // window; restoreAppWindow() prefers the preload bridge.
                restoreAppWindow();
                navigateToRoom(room.roomId);
            };
            // The user dismissing it themselves must drop it from the map, or
            // a later close() would target a dead notification forever.
            n.onclose = () => {
                if (
                    postedRoomNotifications.get(room.roomId)?.notification === n
                )
                    postedRoomNotifications.delete(room.roomId);
            };
            const previous = postedRoomNotifications.get(room.roomId);
            postedRoomNotifications.set(room.roomId, {
                notification: n,
                eventIds: eventId
                    ? appendPostedEventId(previous?.eventIds ?? [], eventId)
                    : (previous?.eventIds ?? []),
            });
        } catch {
            /* notifications unsupported / blocked — ignore */
        }
    }

    // Event ids this shell has already put through the notification path.
    // Encrypted messages notify from a second subscription (on decryption), and
    // this is what stops one message notifying twice when both paths see it —
    // e.g. with the showAllEvents debug setting on, where the ciphertext is
    // forwarded to the main path before it decrypts. Bounded so a long session
    // cannot leak.
    const notifiedEventIds = createBoundedIdSet();

    // Shared notification emission for both the main-timeline and thread-reply
    // paths (one rule set, not two). Assumes the caller already applied its
    // own gate (push actions + own-event + participant/mention). `loud` drives
    // the ping + red-dot badge; silent notifications still populate the inbox.
    // `live` drives the sound + desktop popup; it defaults to "the initial sync
    // has finished", and the decrypted path overrides it because decryption of
    // the page-load backlog routinely resolves *after* sync PREPARED.
    //
    // Deferred by one macrotask, because the read check below cannot be
    // answered yet at call time. `RoomEvent.Timeline` is emitted from the
    // SDK's injectRoomEvents(), and a /sync response applies its ephemeral
    // events — the read receipts — only AFTER that, in
    // `room.addEphemeralEvents()` (matrix-js-sdk sync.ts). Asked inside the
    // handler, or on a microtask, `hasUserReadEvent` still answers from the
    // pre-response receipt and says "unread"; asked on the next macrotask, it
    // has the receipt from the very same response. Measured on the live repro:
    // handler false, microtask false, setTimeout(0) true, next sync tick
    // (+14ms) true.
    const pendingNotifyTimers = new Set<number>();

    function emitNotification(
        event: MatrixEvent,
        room: Room,
        loud: boolean,
        live: boolean = isInitialSyncComplete(),
    ) {
        // Recorded up front rather than at emission: this is the dedupe key
        // for an event both the main and the decrypted path can see, and with
        // the emission deferred they would otherwise both pass the check.
        const notifiedId = event.getId();
        if (notifiedId) notifiedEventIds.add(notifiedId);
        const timer = window.setTimeout(() => {
            pendingNotifyTimers.delete(timer);
            // Already-read messages must never notify, however live they look.
            // On reload the client resumes from the persisted `since` token,
            // which lags the newest events, so the server re-delivers messages
            // the user already read as genuinely fresh live events AFTER
            // PREPARED — a ping, a popup and an inbox row each, for things they
            // just finished reading. Liveness cannot tell those apart from new
            // traffic; the read receipt can. Checked here so it covers every
            // producer (plaintext timeline, decrypted, thread reply) instead of
            // once per path. Fails OPEN: an unknown room/user/event, or a
            // throwing lookup, still notifies.
            if (
                isAlreadyReadEvent({
                    eventId: event.getId(),
                    myUserId: getOwnUserId(),
                    hasUserReadEvent: (userId, eventId) =>
                        room.hasUserReadEvent(userId, eventId),
                })
            )
                return;
            emitNotificationNow(event, room, loud, live);
        }, 0);
        pendingNotifyTimers.add(timer);
    }

    function emitNotificationNow(
        event: MatrixEvent,
        room: Room,
        loud: boolean,
        live: boolean,
    ) {
        const content = event.getContent() as any;
        // Extensible events (e.g. polls) carry their text fallback in the
        // MSC1767 key instead of body.
        const rawBody =
            typeof content?.body === "string"
                ? content.body
                : typeof content?.["org.matrix.msc1767.text"] === "string"
                  ? content["org.matrix.msc1767.text"]
                  : "";
        // A still-encrypted (undecryptable) event has no cleartext body →
        // show a generic "🔒 Encrypted message" line instead of an empty one.
        const body = previewForEvent(event.getType(), rawBody);

        // Another device of this account is demonstrably in use right now →
        // stay quiet here. The local setting is checked FIRST and is
        // authoritative: whatever the blob says, a user who turned this off
        // on THIS device must never be silenced by it. The inbox row below
        // is still recorded either way — the message IS unread here, we
        // simply don't interrupt.
        const localGrace = normalizeGraceMs(settingsState.activeSessionGraceMs);
        // ...unless THIS device published its own heartbeat inside the same
        // window. Whoever wrote last owns the blob, so with two devices in use
        // the one you are typing on would otherwise go quiet until its next
        // write — roughly half the time. "The device I'm using never goes
        // quiet" should hold structurally, not by luck of timing.
        const iAmAlsoActive =
            lastHeartbeatWriteTs !== null &&
            Date.now() - lastHeartbeatWriteTs < localGrace;
        const quietForOtherDevice =
            localGrace > 0 &&
            !iAmAlsoActive &&
            shouldSuppressForActiveDevice({
                heartbeat: activeSessionHeartbeat,
                myDeviceId: getOwnDeviceId(),
                now: Date.now(),
            });

        if (loud) {
            const soundEnabled =
                localStorage.getItem("notifSoundEnabled") !== "false";
            if (live && soundEnabled && !quietForOtherDevice) {
                playPing();
            }
        }

        // Record both loud and silent notifications so the inbox panel can show
        // them when the server can't fetch past notifications.
        markNotification({
            roomId: room.roomId,
            eventId: event.getId()!,
            ts: event.getTs(),
            sender: event.getSender() ?? "",
            body,
            loud,
        });

        // Any notifying event also pops a desktop notification.
        if (live && !quietForOtherDevice)
            showDesktopNotification(event, room, body);
    }

    // Incoming DM calls get their own notification and suppression rule: the
    // message rule at showDesktopNotification() is about whether you are
    // reading that room, which is not the question here. The only reason to
    // stay quiet is that the card is already on screen in front of you.
    // roomId → its live OS notification (null when we chose not to post one,
    // e.g. the window was focused), so we can close a stale notification when
    // the call stops ringing.
    const notifiedCalls = new Map<string, Notification | null>();

    function notifyIncomingCall(roomId: string): Notification | undefined {
        if (
            typeof Notification === "undefined" ||
            Notification.permission !== "granted"
        )
            return;
        if (document.hasFocus()) return;
        const room = getRoom(roomId);
        if (!room) return;
        const partnerId = getDMPartnerId(room);
        const name = partnerId ? getMemberName(room, partnerId) : "Someone";
        try {
            const n = new Notification(`${name} is calling`, {
                body: "Incoming call",
                icon: "/favicon.png",
                badge: "/favicon_foreground.png",
                tag: `call:${roomId}`,
            });
            n.onclick = () => {
                restoreAppWindow();
                navigateToRoom(roomId);
            };
            return n;
        } catch {
            /* notifications unsupported / blocked — the card still shows */
            return undefined;
        }
    }

    function acceptIncomingCall(roomId: string) {
        // Silence FIRST. joinCall's mic probe (getUserMedia) can block on a
        // browser permission prompt, and the ring would otherwise sound until a
        // sweep sees our own membership echo back — the whole prompt long.
        silenceIncomingCall(roomId);
        navigateToRoom(roomId);
        void joinCall(roomId);
    }

    $effect(() => {
        const current = new Set(incomingCallsState.ringing);
        for (const roomId of current)
            if (!notifiedCalls.has(roomId)) {
                notifiedCalls.set(roomId, notifyIncomingCall(roomId) ?? null);
            }
        // A room that stopped ringing: close its now-stale OS notification (the
        // caller gave up, or the ring timed out) and forget it so a re-call
        // notifies again.
        for (const roomId of notifiedCalls.keys())
            if (!current.has(roomId)) {
                notifiedCalls.get(roomId)?.close();
                notifiedCalls.delete(roomId);
            }
    });

    // Opening a room is reading it: drop its notification without waiting for
    // the read receipt to round-trip.
    //
    // This is the ONE branch that closes a notification with no read proof, so
    // it has to be at least as strict as the branch that decides not to POST
    // one (see showDesktopNotification) — closing an unread popup hides a
    // message, while failing to close one is merely untidy. Hence the guards:
    //
    //   - activeRoomId is NOT "the room on screen". setActiveSpace() assigns it
    //     from getLastRoom(spaceId), i.e. a value read back out of localStorage,
    //     so merely clicking a space in the sidebar restores that space's
    //     last-opened room id without ever rendering its timeline.
    //   - showInbox renders InboxPanel *instead of* the active room, and
    //     setActiveSpace() does not clear it — so the two can be true at once.
    //   - callViewRoomId renders CallView over the same slot; the messages are
    //     not on screen there either.
    //
    // Both guards mirror the {#if} chain in the markup below. Do not "simplify"
    // them away: without them, a space switch from the Inbox silently dismisses
    // a notification for a room the user never looked at.
    //
    // Deliberately NOT gated on document.hasFocus(): clicking a notification
    // calls navigateToRoom, and this effect can run before focus lands.
    //
    // Safe in a tracked effect — every read is a plain reactive store field,
    // and closeRoomNotifications touches a plain Map and the Notification API,
    // never the SDK.
    $effect(() => {
        const openRoomId = roomsState.activeRoomId;
        if (!openRoomId) return;
        if (roomsState.showInbox) return;
        if (interfaceState.callViewRoomId === openRoomId) return;
        closeRoomNotifications(
            notificationsToClose({
                posted: postedEntries(),
                readEventIds: new Set<string>(),
                openRoomId,
            }),
        );
    });

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    function scheduleRefreshRooms() {
        if (refreshTimer) return;
        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            refreshRooms();
        }, 50);
    }

    let hierarchyRefreshTimer: ReturnType<typeof setTimeout> | null = null;
    function scheduleHierarchyRefresh(spaceId: string) {
        if (hierarchyRefreshTimer) return;
        hierarchyRefreshTimer = setTimeout(() => {
            hierarchyRefreshTimer = null;
            if (roomsState.activeSpaceId !== spaceId) return;
            fetchSpaceHierarchy(
                spaceId,
                roomsState.spaceDrillParentId ?? undefined,
                roomsState.spaceDrillDepth || 1,
            ).then((hierarchy) => {
                if (roomsState.activeSpaceId === spaceId) {
                    roomsState.spaceHierarchy = hierarchy;
                }
            });
        }, 2000);
    }

    function refreshRooms() {
        const layout = getSpaceLayout();
        roomsState.spaceLayout = layout;
        const spaces = getSpaces();
        if (layout.order.length) {
            // Build a flat ordered list of all space IDs (including those inside folders)
            const idIndex = new Map<string, number>();
            let idx = 0;
            for (const id of layout.order) {
                if (layout.folders[id]) {
                    for (const sid of layout.folders[id].spaceIds)
                        idIndex.set(sid, idx++);
                } else {
                    idIndex.set(id, idx++);
                }
            }
            spaces.sort((a, b) => {
                const ai = idIndex.get(a.roomId) ?? Infinity;
                const bi = idIndex.get(b.roomId) ?? Infinity;
                return ai - bi;
            });
        }
        roomsState.spaces = spaces;
        roomsState.orphanRooms = getOrphanRooms();
        roomsState.directRooms = getDirectRooms();
        roomsState.invitedRooms = getInvitedRooms();
        roomsState.knockedRooms = getKnockedRooms();
        if (roomsState.activeSpaceId) {
            roomsState.roomsInSpace = getRoomsInSpace(roomsState.activeSpaceId);
            scheduleHierarchyRefresh(roomsState.activeSpaceId);
        }
        // The room list has just been rebuilt from the SDK, so this is the
        // earliest honest moment to settle a surface choice boot had to defer.
        resolvePendingSurface();
        // Same reasoning as the line above: the room list is real now, so this
        // is the first honest moment to replace an empty or stale main pane.
        // Bumping the tick afterwards lets the new selection render in the
        // same pass.
        resolveLandingSurface();
        roomsState.roomsTick++;
    }

    onMount(() => {
        reloadAccountSettings();

        // Desktop (Electron) auto-updater: tell the main process the persisted
        // auto-update preference at boot, so the ~10s launch update-check
        // honours a previously-set OFF before it fires. No-op off Electron.
        if (isDesktopUpdater())
            desktopSetAutoDownload(settingsState.autoUpdateEnabled);

        // App-wide update watch: mirror the desktop launch-check status into the
        // in-app banner, and run the Android launch check + download here
        // (Android has no background process). No-op on web.
        const unsubUpdateWatch = initUpdateWatch();

        refreshRooms();
        const client = getClient();
        if (client) initPush(client).catch(console.error);
        // PWA / browser web push (no-op on native or when no VAPID key set).
        if (client) initWebPush(client).catch(console.error);

        // Mirror the session natively so the push service can enrich
        // notifications and read the active-session blob (off-native this is a
        // no-op). The device id is passed but NOT part of the guard: without it
        // the native service simply never suppresses, whereas dropping the
        // whole mirror would also break notification enrichment.
        if (auth.homeserverUrl && auth.accessToken && auth.userId) {
            syncNativeSession({
                homeserverUrl: auth.homeserverUrl,
                accessToken: auth.accessToken,
                userId: auth.userId,
                deviceId: auth.deviceId,
            }).catch(() => {});
        }

        // Seed the reader from whatever already synced: the blob usually
        // arrives before this shell mounts, and onAccountData only fires on
        // the NEXT change — without this seed the first minutes of a session
        // would notify loudly for a device that is plainly in use. Also
        // adopts the grace, since the blob carries the account-wide setting.
        activeSessionHeartbeat = getActiveSessionHeartbeat();
        if (activeSessionHeartbeat)
            setActiveSessionGraceMs(
                normalizeGraceMs(activeSessionHeartbeat.graceMs),
            );

        // Publish the heartbeat now (if focused), on every focus gain, and on
        // a cheap fixed tick. The TICK is deliberately shorter than any write
        // interval — maybeWriteHeartbeat() no-ops until the grace-derived
        // interval has actually elapsed, so the effective write rate follows
        // the user's current setting without re-creating the timer.
        // Opening the app is itself an interaction — without this seed the
        // first heartbeat could never be written (isDeviceInUse treats a null
        // stamp as "idle").
        lastInputTs = Date.now();
        // Passive listeners: they only stamp a number, so they must never
        // block scrolling or typing.
        const onUserInput = () => {
            lastInputTs = Date.now();
        };
        const inputEvents = [
            "pointerdown",
            "keydown",
            "wheel",
            "touchstart",
        ] as const;
        for (const type of inputEvents)
            window.addEventListener(type, onUserInput, { passive: true });

        maybeWriteHeartbeat();
        const onWindowFocus = () => maybeWriteHeartbeat();
        window.addEventListener("focus", onWindowFocus);
        const heartbeatTimer = window.setInterval(
            maybeWriteHeartbeat,
            MIN_HEARTBEAT_INTERVAL_MS,
        );

        // Push the device-global notification-privacy flag to the two
        // background notification producers. They run without a page (SW
        // wake-up / FCM service) and keep their own copies, so a boot is the
        // one guaranteed chance to correct a stale one. Deliberately OUTSIDE
        // the session guard above: logout clears the native key and the SW
        // auth, so a logout -> login cycle must re-arm both mirrors.
        syncNativeNotificationPrivacy(settingsState.hideNotificationBody).catch(
            () => {},
        );
        updateServiceWorkerNotificationPrivacy(
            settingsState.hideNotificationBody,
        );

        // Native Android notification taps (MainActivity) call this to deep-link
        // to a room. Pushers posted by MatrixMessagingService open via here.
        (window as any).__matrixOpenRoom = (roomId: string) => {
            if (roomId) navigateToRoom(roomId);
        };

        // Web push notification taps (service worker) deep-link via postMessage.
        const onSwMessage = (e: MessageEvent) => {
            if (e.data?.type === "OPEN_ROOM" && e.data.roomId) {
                navigateToRoom(e.data.roomId);
            }
        };
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("message", onSwMessage);
        }

        const mq = window.matchMedia("(max-width: 767px)");
        const pq = window.matchMedia("(pointer: coarse)");
        const hq = window.matchMedia("(hover: none)");
        interfaceState.isMobile = mq.matches;
        interfaceState.isTouchscreen = hq.matches || pq.matches;
        const onMqChange = (e: MediaQueryListEvent) => {
            interfaceState.isMobile = e.matches;
            if (!e.matches) interfaceState.leftOpen = false;
        };
        const onPqHqChange = () => {
            interfaceState.isTouchscreen = hq.matches || pq.matches;
        };
        mq.addEventListener("change", onMqChange);
        pq.addEventListener("change", onPqHqChange);
        hq.addEventListener("change", onPqHqChange);

        const unsubRooms = onRoomUpdate(() => scheduleRefreshRooms());
        // Room updates that resolved between the first refreshRooms() and
        // this subscription (e.g. state seeding right after PREPARED) would
        // otherwise never re-derive the lists — catch up once.
        scheduleRefreshRooms();
        const unsubTimeline = onTimelineEvent((event, room, isLiveAppend) => {
            bumpUnreadTick();
            // Mid-timeline insertions (out-of-order/threaded events the SDK
            // slots into the middle of the timeline) are forwarded so the view
            // stays complete, but they must not fire sounds/notifications the
            // way a fresh tail message does — skip the alert path for them.
            if (!isLiveAppend) return;
            if (event.getSender() === getOwnUserId()) return;

            // Thread replies are participant/mention-gated elsewhere: plaintext
            // ones by onThreadReplyEvent below, encrypted ones by the decrypted
            // path. Skip them here so we don't double-notify. KNOWN debug-only
            // hole: this reads getOriginalContent, which is the WIRE content
            // while undecrypted, so a ciphertext-only relation slips past — and
            // with showAllEvents on the ciphertext then notifies ungated as
            // "🔒 Encrypted message", its id suppressing the gated one.
            if (getEventThreadRootId(event)) return;

            const actions = getClient()?.getPushActionsForEvent(event);
            if (!actions?.notify) return;

            const loud = !!(actions.tweaks as any)?.sound;
            emitNotification(event, room, loud);
        });

        // Encrypted messages arrive as m.room.encrypted, which onTimelineEvent
        // filters out — so they only become notifiable once they decrypt. Same
        // gate chain as above, re-run at that point. Thread replies come
        // through here too (NOTIF-02): the plaintext thread path below cannot
        // see them, because it gates on the cleartext type.
        const unsubDecryptedNotify = onDecryptedTimelineEvent(
            (event, room, meta) => {
                bumpUnreadTick();
                const eventId = event.getId();
                // The SDK caches push actions against the ciphertext envelope
                // during sync, so they MUST be recalculated now that the
                // cleartext body and mentions are readable — otherwise a
                // mention never highlights and the room's mute rule is applied
                // to the wrong content. This is also what makes the thread
                // policy's `isMentioned` meaningful at all.
                const actions = getClient()?.getPushActionsForEvent(
                    event,
                    true,
                );
                if (
                    !shouldNotifyDecrypted({
                        eventId,
                        alreadyNotified:
                            !!eventId && notifiedEventIds.has(eventId),
                        isLiveAppend: meta.isLiveAppend,
                        isOwnEvent: event.getSender() === getOwnUserId(),
                        // From the wrapper, not getEventThreadRootId: for an
                        // encrypted event the relation may live only in the
                        // wire content, which that helper does not read.
                        threadRootId: meta.threadRootId,
                        pushNotify: !!actions?.notify,
                        isThreadParticipant: meta.threadRootId
                            ? isThreadParticipant(room, meta.threadRootId)
                            : false,
                        isMentioned: !!(actions?.tweaks as any)?.highlight,
                    })
                )
                    return;

                const loud = !!(actions?.tweaks as any)?.sound;
                emitNotification(
                    event,
                    room,
                    loud,
                    !meta.arrivedDuringInitialSync,
                );
            },
        );

        // Thread replies are diverted off the main timeline (onTimelineEvent
        // filters them), so they need their own path into the notification
        // machinery. Gate: notify (push/mute rules) AND participant-or-mentioned
        // — not every reply in the room. Reuses the shared emitNotification.
        const unsubThreadNotify = onThreadReplyEvent(
            (event, room, isLiveAppend) => {
                if (!isLiveAppend) return;
                if (event.getSender() === getOwnUserId()) return;

                // Both this path and the decrypted one can now admit a thread
                // reply, so the shared id set — not a structural accident — is
                // what guarantees exactly one notification per event. A
                // plaintext reply can never have been notified before reaching
                // here, so this only ever fires on an overlap.
                const threadEventId = event.getId();
                if (threadEventId && notifiedEventIds.has(threadEventId))
                    return;

                const actions = getClient()?.getPushActionsForEvent(event);
                const notify = !!actions?.notify;
                const loud = !!(actions?.tweaks as any)?.sound;
                const isMentioned = !!(actions?.tweaks as any)?.highlight;

                const rootId = getEventThreadRootId(event);
                const isParticipant = rootId
                    ? isThreadParticipant(room, rootId)
                    : false;

                if (
                    !shouldNotifyThreadEvent({
                        isOwnEvent: false,
                        notify,
                        isParticipant,
                        isMentioned,
                    })
                )
                    return;

                emitNotification(event, room, loud);
            },
        );
        const unsubReceipts = onAnyReceiptEvent(() => {
            bumpUnreadTick();
            const userId = getOwnUserId();
            const client = getClient();
            if (!userId || !client) return;
            for (const room of client.getRooms()) {
                clearReadNotifications(room, userId);
            }
            // …and take the OS notifications down too. A receipt from ANY of
            // the user's devices lands here, which is the whole point: read it
            // on your phone, the desktop popup goes away.
            const readEventIds = new Set<string>();
            for (const [roomId, entry] of postedRoomNotifications) {
                const room = getRoom(roomId);
                if (!room) continue;
                for (const id of entry.eventIds) {
                    try {
                        if (room.hasUserReadEvent(userId, id))
                            readEventIds.add(id);
                    } catch {
                        /* event unknown to the room → treat as unread */
                    }
                }
            }
            closeRoomNotifications(
                notificationsToClose({
                    posted: postedEntries(),
                    readEventIds,
                }),
            );
        });
        reloadLastLocationFromStorage();
        reloadNotificationsFromStorage();
        // Refresh the registry's cached profile for this account so the
        // account switcher shows a current name/avatar even when this
        // account is later inactive. Fire-and-forget.
        (async () => {
            try {
                const profile = await fetchOwnProfile();
                if (!auth.userId) return;
                updateAccountProfile(auth.userId, {
                    displayName: profile.displayName,
                    avatarUrl: mxcToHttp(profile.avatarMxc, 64, 64),
                });
            } catch {
                // offline boot — cached values stay
            }
        })();
        const unsubFavourites = initFavourites();
        const unsubCustomization = initCustomizationSync();
        const unsubIgnored = initIgnoredUsers();
        const unsubPresence = initPresence();
        const unsubVoice = initVoiceCall();
        const unsubIncoming = initIncomingCalls();
        const unsubLiveLocation = initLiveLocation();
        const unsubVerification = initVerification();
        const unsubAccountData = onAccountData((type) => {
            if (
                type === "im.client.space_layout" ||
                type === "im.client.space_order"
            )
                refreshRooms();
            if (type === ACTIVE_SESSION_KEY) {
                activeSessionHeartbeat = getActiveSessionHeartbeat();
                // The blob is the source of truth for the setting too, so a
                // change made on another device lands here. Only write when
                // the value actually differs: a focused peer republishes the
                // same grace every 30s, and each of those would otherwise be
                // a pointless localStorage write, forever.
                if (activeSessionHeartbeat) {
                    const remoteGrace = normalizeGraceMs(
                        activeSessionHeartbeat.graceMs,
                    );
                    if (remoteGrace !== settingsState.activeSessionGraceMs)
                        setActiveSessionGraceMs(remoteGrace);
                }
            }
        });

        // ── Back button ───────────────────────────────────────────────────
        // Native (Capacitor): the hardware back button fires the App plugin's
        // backButton event. Run the shared dismiss logic; exit the app only
        // when there's nothing left to dismiss.
        // Web: intercept popstate against a pushed history "guard" entry.
        let nativeBackHandle: { remove: () => void } | undefined;
        let onPopState: (() => void) | undefined;

        if (Capacitor.isNativePlatform()) {
            App.addListener("backButton", () => {
                if (handleBack()) return;
                App.exitApp();
            }).then((h) => (nativeBackHandle = h));
        } else {
            let lastBackTs = 0;
            onPopState = () => {
                if (!interfaceState.isMobile) return;
                const now = Date.now();
                if (now - lastBackTs < 100) return; // dedupe double-fire
                lastBackTs = now;
                if (handleBack()) {
                    ensureBackGuard();
                } else {
                    // Nothing to dismiss & drawer open → real back navigation.
                    window.removeEventListener("popstate", onPopState!);
                    history.back();
                }
            };
            window.addEventListener("popstate", onPopState);
            ensureBackGuard();
        }

        return () => {
            // Deferred notifications must not land after teardown/logout.
            for (const t of pendingNotifyTimers) window.clearTimeout(t);
            pendingNotifyTimers.clear();
            unsubRooms();
            unsubTimeline();
            unsubDecryptedNotify();
            unsubThreadNotify();
            unsubReceipts();
            unsubFavourites();
            unsubCustomization();
            unsubIgnored();
            unsubPresence();
            unsubVoice();
            unsubIncoming();
            unsubLiveLocation();
            unsubVerification();
            unsubAccountData();
            unsubUpdateWatch();
            mq.removeEventListener("change", onMqChange);
            pq.removeEventListener("change", onPqHqChange);
            hq.removeEventListener("change", onPqHqChange);
            window.removeEventListener("focus", onWindowFocus);
            for (const type of inputEvents)
                window.removeEventListener(type, onUserInput);
            window.clearInterval(heartbeatTimer);
            nativeBackHandle?.remove();
            if (onPopState) window.removeEventListener("popstate", onPopState);
            delete (window as any).__matrixOpenRoom;
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.removeEventListener(
                    "message",
                    onSwMessage,
                );
            }
        };
    });

    // Update rooms list and fetch full hierarchy when selected space changes
    $effect(() => {
        const spaceId = roomsState.activeSpaceId; // only dependency we want
        const rooms = spaceId ? getRoomsInSpace(spaceId) : [];
        roomsState.roomsInSpace = rooms;

        if (spaceId) {
            roomsState.hierarchyLoading = true;
            // Opening a space is a natural moment to catch a joined child room
            // that incremental sync dropped (heals in place, no reload).
            scheduleJoinedRoomsReconcile();
            fetchSpaceHierarchy(
                spaceId,
                roomsState.spaceDrillParentId ?? undefined,
                roomsState.spaceDrillDepth || 1,
            ).then((hierarchy) => {
                // Only apply if the space hasn't changed while we were fetching
                if (roomsState.activeSpaceId === spaceId) {
                    roomsState.spaceHierarchy = hierarchy;
                    roomsState.hierarchyLoading = false;
                }
            });
        }
    });

    // Re-entrancy guard: handleLogout awaits for up to 4s, and a second run
    // in that window would remove the successor account from the registry.
    let loggingOut = false;

    async function handleLogout() {
        if (loggingOut) return;
        loggingOut = true;
        // A live call must not survive logout.
        leaveCall();
        const client = getClient();
        // Fire the network teardown in the background — don't let a slow/hung
        // request (common on mobile) block the UI from logging out locally.
        if (client) unregisterPush(client).catch(() => {});
        if (client) teardownWebPush(client).catch(() => {});
        clearNativeSession().catch(() => {});
        clearServiceWorkerAuth();
        // Give the server-side token invalidation and the local store wipe a
        // bounded window to finish, then leave via a full reload so no store
        // state survives into the successor account's boot.
        await Promise.race([
            logout(),
            new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);
        // Clear local session and leave.
        clearSession();
        window.location.assign("/");
    }

    // Derive directly from activeRoomId (a stable string) rather than the room arrays,
    // so sync-triggered array refreshes don't invalidate this derived and remount MessageArea.
    const activeRoom = $derived.by(() => {
        void roomsState.roomsTick; // re-derive when rooms refresh (e.g. after joining)
        return roomsState.activeRoomId
            ? getRoom(roomsState.activeRoomId)
            : null;
    });
    const notificationCount = $derived.by(() => {
        return getNotificationCount();
    });

    $effect(() => {
        updateFaviconBadge(notificationCount).catch(() => {});
        return () => {
            updateFaviconBadge(0).catch(() => {});
        };
    });
</script>

<svelte:head>
    <title>{notificationCount > 0 ? `(${notificationCount}) Zam` : "Zam"}</title
    >
</svelte:head>

<svelte:window onkeydown={onWindowKeydown} />

{#if !auth.isAuthenticated}
    <div
        class="flex items-center justify-center bg-discord-backgroundTertiary"
        style="min-height: 100dvh;"
    >
        <div class="flex items-center gap-3 text-discord-textMuted">
            <div
                class="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"
            ></div>
            <span>Redirecting…</span>
        </div>
    </div>
{:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="flex overflow-hidden bg-discord-background"
        style="position: fixed; inset: 0;"
        ontouchstart={drawerDragStart}
    >
        <!-- Sync state banner -->
        {#if auth.syncState !== "PREPARED" && auth.syncState !== "SYNCING"}
            <div
                class="absolute top-0 left-0 right-0 z-50 bg-discord-warning/90 text-discord-backgroundTertiary text-sm font-medium text-center py-1.5"
            >
                {#if auth.syncState === "ERROR"}
                    Connection error — trying to reconnect…
                {:else if auth.syncState === "RECONNECTING"}
                    Reconnecting…
                {:else}
                    Syncing…
                {/if}
            </div>
        {/if}

        {#if !interfaceState.isMobile}
            <!-- Desktop: permanent sidebars -->
            <SpaceSidebar
                onHomeClick={() => setActiveSpace(null)}
                onSettingsClick={openAppSettings}
                onOpenSpaceSettings={openRoomSettings}
            />
            <RoomList
                onLogout={handleLogout}
                onOpenSpaceSettings={openRoomSettings}
                onOpenRoomSettings={openRoomSettings}
            />
        {:else}
            <!-- Mobile: animated drawer + backdrop -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
                class="fixed inset-0 z-30"
                style="background: rgba(0,0,0,{backdropOpacity}); pointer-events: {backdropOpacity >
                0.01
                    ? 'auto'
                    : 'none'};"
                ontouchstart={drawerDragStart}
                onclick={() => {
                    if (!isDragging) interfaceState.leftOpen = false;
                }}
            ></div>
            <div
                class="fixed inset-y-0 left-0 z-40 flex"
                style="transform: translateX({drawerTranslate}px); {isDragging
                    ? ''
                    : 'transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);'} {drawerTranslate <=
                -DRAWER_WIDTH
                    ? ''
                    : 'box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);'}"
            >
                <SpaceSidebar
                    onHomeClick={() => setActiveSpace(null)}
                    onSettingsClick={() => {
                        openAppSettings();
                        interfaceState.leftOpen = false;
                    }}
                    onOpenSpaceSettings={openRoomSettings}
                />
                <RoomList
                    onLogout={handleLogout}
                    onOpenSpaceSettings={openRoomSettings}
                    onOpenRoomSettings={openRoomSettings}
                />
            </div>
        {/if}

        <main class="flex flex-1 min-w-0 overflow-hidden bg-discord-background">
            {#if roomsState.showInbox}
                <InboxPanel
                    isMobile={interfaceState.isMobile}
                    onMenuOpen={() => (interfaceState.leftOpen = true)}
                />
            {:else if activeRoom}
                {#if interfaceState.callViewRoomId === activeRoom.roomId}
                    <CallView
                        room={activeRoom}
                        isMobile={interfaceState.isMobile}
                        onMenuOpen={() => (interfaceState.leftOpen = true)}
                    />
                {:else}
                    <MessageArea
                        room={activeRoom}
                        isMobile={interfaceState.isMobile}
                        onMenuOpen={() => (interfaceState.leftOpen = true)}
                    />
                {/if}
            {:else if roomsState.activeSpaceId !== null}
                <SpaceLandingPanel
                    isMobile={interfaceState.isMobile}
                    onMenuOpen={() => (interfaceState.leftOpen = true)}
                />
            {:else}
                <div
                    class="flex-1 flex flex-col items-center justify-center text-center p-8"
                >
                    <div
                        class="w-24 h-24 rounded-full bg-discord-backgroundSecondary flex items-center justify-center mb-6"
                    >
                        <span class="text-5xl font-bold text-discord-textMuted"
                            >#</span
                        >
                    </div>
                    <!-- Only a spaceless account is genuinely empty. With
                         spaces joined, Home being empty just means every room
                         lives in one — saying "no rooms yet" would be a lie. -->
                    {#if roomsState.spaces.length === 0}
                        <h2
                            class="text-2xl font-bold text-discord-textPrimary mb-2"
                        >
                            No rooms yet
                        </h2>
                        <p class="text-discord-textMuted max-w-sm">
                            Create a room or start a direct message to get
                            going.
                        </p>
                    {:else}
                        <h2
                            class="text-2xl font-bold text-discord-textPrimary mb-2"
                        >
                            Nothing in Home
                        </h2>
                        <p class="text-discord-textMuted max-w-sm">
                            All of your rooms live in spaces — open one to see
                            them. Rooms and direct messages outside a space show
                            up here.
                        </p>
                    {/if}
                    {#if interfaceState.isMobile}
                        <button
                            onclick={() => (interfaceState.leftOpen = true)}
                            class="mt-6 px-5 py-2.5 bg-discord-accent hover:bg-discord-accentHover text-white rounded-lg text-sm font-semibold transition-colors"
                            >Open Room List</button
                        >
                    {/if}
                </div>
            {/if}
        </main>

        <!-- Settings overlay -->
        {#if interfaceState.modal === "app-settings"}
            <AppSettings onClose={closeModal} onLogout={handleLogout} />
        {/if}
    </div>
{/if}

{#if interfaceState.modal === "room-settings" && settingsRoom}
    <RoomSettings
        room={settingsRoom}
        onClose={closeModal}
        onUpdate={() => {
            if (roomsState.activeSpaceId)
                roomsState.roomsInSpace = getRoomsInSpace(
                    roomsState.activeSpaceId,
                );
        }}
    />
{/if}

{#if interfaceState.modal === "invite" && inviteDialogState.roomId}
    <InviteModal roomId={inviteDialogState.roomId} />
{/if}

{#if interfaceState.modal === "create-poll" && pollDialogState.roomId}
    <CreatePollDialog />
{/if}

{#if interfaceState.modal === "share-location" && locationDialogState.roomId}
    <ShareLocationDialog />
{/if}

{#if incomingCallsState.ringing.length > 0 || verificationState.incoming.length > 0}
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {#each incomingCallsState.ringing as roomId (roomId)}
            <IncomingCallCard
                {roomId}
                onAccept={acceptIncomingCall}
                onDecline={declineIncomingCall}
            />
        {/each}
        {#each verificationState.incoming as controller (controller.id)}
            <VerificationRequestCard {controller} />
        {/each}
    </div>
{/if}

<VerificationModal />

<ErrorToasts />
<ScreenSharePicker />

<UpdateBanner />
