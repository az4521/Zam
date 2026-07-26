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
    import IncomingCallCard from "$lib/components/layout/IncomingCallCard.svelte";
    import VerificationModal from "$lib/components/layout/VerificationModal.svelte";
    import VerificationRequestCard from "$lib/components/layout/VerificationRequestCard.svelte";
    import ErrorToasts from "$lib/components/ui/ErrorToasts.svelte";

    import { auth, clearSession } from "$lib/stores/auth.svelte";
    import {
        roomsState,
        setActiveSpace,
        navigateToRoom,
        bumpUnreadTick,
        reloadLastLocationFromStorage,
    } from "$lib/stores/rooms.svelte";
    import {
        interfaceState,
        openModal,
        closeModal,
        closeSidebar,
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
    } from "$lib/matrix/client";
    import {
        shouldNotifyDecrypted,
        createBoundedIdSet,
    } from "$lib/utils/notifyDecrypted";
    import { updateFaviconBadge } from "$lib/utils/faviconBadge";
    import { restoreAppWindow } from "$lib/utils/restoreWindow";
    import { previewForEvent } from "$lib/utils/encryptionState";
    import { playPing } from "$lib/audio/soundEffects";
    import { shouldNotifyThreadEvent } from "$lib/utils/threadNotify";
    import type { Room, MatrixEvent } from "matrix-js-sdk";
    import { initPush, unregisterPush } from "$lib/push";
    import { initWebPush, teardownWebPush } from "$lib/webPush";
    import { syncNativeSession, clearNativeSession } from "$lib/nativeSession";
    import { Capacitor } from "@capacitor/core";
    import { App } from "@capacitor/app";

    // Room shown in the RoomSettings modal (covers both room and space settings).
    let settingsRoom = $state<Room | null>(null);

    function openAppSettings() {
        openModal("app-settings", () => {});
    }
    function openRoomSettings(r: Room) {
        settingsRoom = r;
        openModal("room-settings", () => (settingsRoom = null));
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
    // Priority: dismiss open modal → dismiss open sidebar → (back only) open the
    // left drawer → real back. All driven by the interfaceState slots; no
    // component manages its own Escape/back shortcuts.
    function dismissTopmost(): boolean {
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
        try {
            const n = new Notification(getRoomDisplayName(room), {
                body: body ? `${sender}: ${body}` : `${sender} sent a message`,
                icon: "/favicon.png",
                badge: "/favicon_foreground.png",
                tag: event.getId() ?? undefined,
            });
            n.onclick = () => {
                // window.focus() alone cannot un-hide a tray-hidden Electron
                // window; restoreAppWindow() prefers the preload bridge.
                restoreAppWindow();
                navigateToRoom(room.roomId);
            };
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
    function emitNotification(
        event: MatrixEvent,
        room: Room,
        loud: boolean,
        live: boolean = isInitialSyncComplete(),
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

        if (loud) {
            const soundEnabled =
                localStorage.getItem("notifSoundEnabled") !== "false";
            if (live && soundEnabled) {
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
        const notifiedId = event.getId();
        if (notifiedId) notifiedEventIds.add(notifiedId);

        // Any notifying event also pops a desktop notification.
        if (live) showDesktopNotification(event, room, body);
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
        // notifications (off-native this is a no-op).
        if (auth.homeserverUrl && auth.accessToken && auth.userId) {
            syncNativeSession({
                homeserverUrl: auth.homeserverUrl,
                accessToken: auth.accessToken,
                userId: auth.userId,
            }).catch(() => {});
        }

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

            // Thread replies are surfaced by the dedicated onThreadReplyEvent
            // path below (participant/mention-gated). onTimelineEvent forwards
            // them here too when settingsState.showAllEvents is on — skip so we
            // don't double-notify the same reply.
            if (getEventThreadRootId(event)) return;

            const actions = getClient()?.getPushActionsForEvent(event);
            if (!actions?.notify) return;

            const loud = !!(actions.tweaks as any)?.sound;
            emitNotification(event, room, loud);
        });

        // Encrypted messages arrive as m.room.encrypted, which onTimelineEvent
        // filters out — so they only become notifiable once they decrypt. Same
        // gate chain as above, re-run at that point.
        const unsubDecryptedNotify = onDecryptedTimelineEvent(
            (event, room, meta) => {
                bumpUnreadTick();
                const eventId = event.getId();
                // The SDK caches push actions against the ciphertext envelope
                // during sync, so they MUST be recalculated now that the
                // cleartext body and mentions are readable — otherwise a
                // mention never highlights and the room's mute rule is applied
                // to the wrong content.
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
                        threadRootId: getEventThreadRootId(event),
                        pushNotify: !!actions?.notify,
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
                    <h2
                        class="text-2xl font-bold text-discord-textPrimary mb-2"
                    >
                        {roomsState.activeSpaceId === null
                            ? "Select a room"
                            : "Select a channel"}
                    </h2>
                    <p class="text-discord-textMuted max-w-sm">
                        {roomsState.activeSpaceId === null
                            ? "Choose a room or direct message from the sidebar to start chatting."
                            : "Choose a channel from the list on the left to start chatting."}
                    </p>
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

<UpdateBanner />
