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
    import { mobileState } from "$lib/stores/mobile.svelte";
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

    let showSettings = $state(false);
    let spaceSettingsRoom = $state<Room | null>(null);
    let roomSettingsRoom = $state<Room | null>(null);

    // Animated drawer drag (mobile)
    const DRAWER_WIDTH = 312; // 72px SpaceSidebar + 240px RoomList
    let drawerTranslate = $state(-DRAWER_WIDTH);
    let isDragging = $state(false);
    let dragStartX = 0;
    let dragBaseTranslate = 0;

    // Keep translate in sync when state changes programmatically (hamburger, etc.)
    $effect(() => {
        if (!isDragging) {
            drawerTranslate = mobileState.leftOpen ? 0 : -DRAWER_WIDTH;
        }
    });

    const backdropOpacity = $derived(
        mobileState.isMobile
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
            const openingGesture = dx > 0 && !mobileState.leftOpen;
            const closingGesture = dx < 0 && mobileState.leftOpen;
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
        mobileState.leftOpen = startedOpen ? progress >= 0.85 : progress > 0.15;
        drawerTranslate = mobileState.leftOpen ? 0 : -DRAWER_WIDTH;
    }

    function cleanupDocListeners() {
        document.removeEventListener("touchmove", drawerDragMove);
        document.removeEventListener("touchend", drawerDragEnd);
        document.removeEventListener("touchcancel", drawerDragEnd);
    }

    function drawerDragStart(e: TouchEvent) {
        if (
            !mobileState.isMobile ||
            isDragging ||
            dragPending ||
            mobileState.rightOpen ||
            mobileState.lightboxOpen ||
            mobileState.settingsOpen
        )
            return;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
        dragBaseTranslate = mobileState.leftOpen ? 0 : -DRAWER_WIDTH;
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
        mobileState.isMobile = mq.matches;
        mobileState.isTouchscreen = hq.matches || pq.matches;
        const onMqChange = (e: MediaQueryListEvent) => {
            mobileState.isMobile = e.matches;
            if (!e.matches) mobileState.leftOpen = false;
        };
        const onPqHqChange = () => {
            mobileState.isTouchscreen = hq.matches || pq.matches;
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
        return () => {
            unsubRooms();
            unsubTimeline();
            unsubReceipts();
            unsubFavourites();
            unsubAccountData();
            mq.removeEventListener("change", onMqChange);
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

        {#if !mobileState.isMobile}
            <!-- Desktop: permanent sidebars -->
            <SpaceSidebar
                onHomeClick={() => setActiveSpace(null)}
                onSettingsClick={() => (showSettings = !showSettings)}
            />
            <RoomList
                onLogout={handleLogout}
                onOpenSpaceSettings={(r) => (spaceSettingsRoom = r)}
                onOpenRoomSettings={(r) => (roomSettingsRoom = r)}
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
                    if (!isDragging) mobileState.leftOpen = false;
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
                        mobileState.leftOpen = false;
                    }}
                    onSettingsClick={() => {
                        showSettings = !showSettings;
                        mobileState.leftOpen = false;
                    }}
                />
                <RoomList
                    onLogout={handleLogout}
                    onOpenSpaceSettings={(r) => (spaceSettingsRoom = r)}
                    onOpenRoomSettings={(r) => (roomSettingsRoom = r)}
                />
            </div>
        {/if}

        <main class="flex flex-1 min-w-0 overflow-hidden bg-discord-background">
            {#if roomsState.showInbox}
                <InboxPanel />
            {:else if activeRoom}
                <MessageArea
                    room={activeRoom}
                    isMobile={mobileState.isMobile}
                    onMenuOpen={() => (mobileState.leftOpen = true)}
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
                    {#if mobileState.isMobile}
                        <button
                            onclick={() => (mobileState.leftOpen = true)}
                            class="mt-6 px-5 py-2.5 bg-discord-accent hover:bg-discord-accentHover text-white rounded-lg text-sm font-semibold transition-colors"
                            >Open Room List</button
                        >
                    {/if}
                </div>
            {/if}
        </main>

        <!-- Settings overlay -->
        {#if showSettings}
            <AppSettings
                onClose={() => (showSettings = false)}
                onLogout={handleLogout}
            />
        {/if}
    </div>
{/if}

{#if spaceSettingsRoom}
    <RoomSettings
        room={spaceSettingsRoom}
        onClose={() => (spaceSettingsRoom = null)}
        onUpdate={() => {
            if (roomsState.activeSpaceId)
                roomsState.roomsInSpace = getRoomsInSpace(
                    roomsState.activeSpaceId,
                );
        }}
    />
{/if}

{#if roomSettingsRoom}
    <RoomSettings
        room={roomSettingsRoom}
        onClose={() => (roomSettingsRoom = null)}
    />
{/if}
