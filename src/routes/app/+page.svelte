<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";

    import SpaceSidebar from "$lib/components/layout/SpaceSidebar.svelte";
    import RoomList from "$lib/components/layout/RoomList.svelte";
    import MessageArea from "$lib/components/layout/MessageArea.svelte";
    import RoomSettings from "$lib/components/layout/RoomSettings.svelte";
    import AppSettings from "$lib/components/layout/AppSettings.svelte";
    import InboxPanel from "$lib/components/layout/InboxPanel.svelte";

    import { auth, clearSession } from "$lib/stores/auth.svelte";
    import {
        roomsState,
        setActiveSpace,
        bumpUnreadTick,
    } from "$lib/stores/rooms.svelte";
    import {
        interfaceState,
        openModal,
        closeModal,
        closeSidebar,
        openComposerPicker,
    } from "$lib/stores/interface.svelte";
    import { initFavourites } from "$lib/stores/favourites.svelte";
    import {
        markLoudNotification,
        clearReadNotifications,
    } from "$lib/stores/notifications.svelte";
    import {
        getSpaces,
        getOrphanRooms,
        getDirectRooms,
        getRoomsInSpace,
        getInvitedRooms,
        getSpaceLayout,
        fetchSpaceHierarchy,
        getRoom,
        logout,
        onRoomUpdate,
        onAccountData,
        onTimelineEvent,
        onAnyReceiptEvent,
        getClient,
        getOwnUserId,
    } from "$lib/matrix/client";
    import type { Room } from "matrix-js-sdk";
    import { initPush, unregisterPush } from "$lib/push";

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
        interfaceState.leftOpen = startedOpen ? progress >= 0.85 : progress > 0.15;
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
        dragBaseTranslate = interfaceState.leftOpen ? 0 : -DRAWER_WIDTH;
        dragPending = true;
        document.addEventListener("touchmove", drawerDragMove, {
            passive: false,
        });
        document.addEventListener("touchend", drawerDragEnd);
        document.addEventListener("touchcancel", drawerDragEnd);
    }

    // Redirect if not authenticated
    $effect(() => {
        if (!auth.isAuthenticated) {
            goto("/");
        }
    });

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

    // Keep a history "guard" entry on the stack whenever there's something the
    // back button should intercept (a modal, a sidebar, or the closed drawer).
    function ensureBackGuard() {
        console.log("ensureBackGuard", interfaceState.isMobile, history.state)
        if (!interfaceState.isMobile) return;
        if ((history.state as { matrixBackGuard?: boolean })?.matrixBackGuard)
            return;
        setTimeout(() => {
            history.pushState(
                { matrixBackGuard: true },
                "",
                window.location.href,
            );
            console.log(history.state)
        }, 0)
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
            fetchSpaceHierarchy(spaceId).then((hierarchy) => {
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
        if (roomsState.activeSpaceId) {
            roomsState.roomsInSpace = getRoomsInSpace(roomsState.activeSpaceId);
            scheduleHierarchyRefresh(roomsState.activeSpaceId);
        }
        roomsState.roomsTick++;
    }

    onMount(() => {
        if (!auth.isAuthenticated) {
            goto("/");
            return;
        }

        refreshRooms();
        const client = getClient();
        if (client) initPush(client).catch(console.error);

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

        const pingAudio = new Audio("/sounds/ping.mp3");

        const unsubRooms = onRoomUpdate(() => scheduleRefreshRooms());
        const unsubTimeline = onTimelineEvent((event, room) => {
            bumpUnreadTick();
            if (event.getSender() !== getOwnUserId()) {
                const actions = getClient()?.getPushActionsForEvent(event);
                if (actions?.notify) {
                    const hasSound = (actions.tweaks as any)?.sound;
                    if (hasSound) {
                        const soundEnabled =
                            localStorage.getItem("notifSoundEnabled") !==
                            "false";
                        if (soundEnabled) {
                            pingAudio.currentTime = 0;
                            pingAudio.play().catch(() => {});
                        }
                        const content = event.getContent() as any;
                        const body =
                            typeof content?.body === "string"
                                ? content.body
                                : "";
                        markLoudNotification({
                            roomId: room.roomId,
                            eventId: event.getId()!,
                            ts: event.getTs(),
                            sender: event.getSender() ?? "",
                            body,
                        });
                    }
                }
            }
        });
        const unsubReceipts = onAnyReceiptEvent(() => {
            bumpUnreadTick();
            const userId = getOwnUserId();
            const client = getClient();
            if (!userId || !client) return;
            for (const room of client.getRooms()) {
                clearReadNotifications(room, userId);
            }
        });
        const unsubFavourites = initFavourites();
        const unsubAccountData = onAccountData((type) => {
            if (
                type === "im.client.space_layout" ||
                type === "im.client.space_order"
            )
                refreshRooms();
        });

        // Mobile back button (single popstate listener; see ensureBackGuard).
        let lastBackTs = 0;
        const onPopState = () => {
            if (!interfaceState.isMobile) return;
            const now = Date.now();
            if (now - lastBackTs < 100) return; // dedupe double-fire
            lastBackTs = now;
            if (dismissTopmost()) {
                ensureBackGuard()
            } else if (!interfaceState.leftOpen) {
                interfaceState.leftOpen = true;
                ensureBackGuard()
            } else {
                // Nothing to dismiss & drawer open → real back navigation.
                window.removeEventListener("popstate", onPopState);
                history.back();
            }
        };
        window.addEventListener("popstate", onPopState);
        ensureBackGuard();

        return () => {
            unsubRooms();
            unsubTimeline();
            unsubReceipts();
            unsubFavourites();
            unsubAccountData();
            mq.removeEventListener("change", onMqChange);
            window.removeEventListener("popstate", onPopState);
        };
    });

    // Update rooms list and fetch full hierarchy when selected space changes
    $effect(() => {
        const spaceId = roomsState.activeSpaceId; // only dependency we want
        const rooms = spaceId ? getRoomsInSpace(spaceId) : [];
        roomsState.roomsInSpace = rooms;

        if (spaceId) {
            roomsState.hierarchyLoading = true;
            fetchSpaceHierarchy(spaceId).then((hierarchy) => {
                // Only apply if the space hasn't changed while we were fetching
                if (roomsState.activeSpaceId === spaceId) {
                    roomsState.spaceHierarchy = hierarchy;
                    roomsState.hierarchyLoading = false;
                }
            });
        }
    });

    async function handleLogout() {
        const client = getClient();
        if (client) await unregisterPush(client).catch(() => {});
        try {
            await logout();
        } finally {
            clearSession();
            goto("/");
        }
    }

    // Derive directly from activeRoomId (a stable string) rather than the room arrays,
    // so sync-triggered array refreshes don't invalidate this derived and remount MessageArea.
    const activeRoom = $derived.by(() => {
        void roomsState.roomsTick; // re-derive when rooms refresh (e.g. after joining)
        return roomsState.activeRoomId
            ? getRoom(roomsState.activeRoomId)
            : null;
    });
</script>

<svelte:head>
    <title>Matrix Client</title>
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
                    onHomeClick={() => {
                        setActiveSpace(null);
                        interfaceState.leftOpen = false;
                    }}
                    onSettingsClick={() => {
                        openAppSettings();
                        interfaceState.leftOpen = false;
                    }}
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
                <InboxPanel />
            {:else if activeRoom}
                <MessageArea
                    room={activeRoom}
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
