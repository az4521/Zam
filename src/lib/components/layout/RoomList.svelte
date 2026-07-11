<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import {
        getRoomAvatar,
        getRoomDisplayName,
        getHighlightCount,
        getRoomUnreadInfo,
        joinRoom,
        knockRoom,
        cancelKnock,
        leaveRoom,
        acceptInvite,
        rejectInvite,
        getInviteSender,
        getMyPowerLevel,
        getRoomPowerLevels,
        getRoom,
        getSpaces,
        getRoomDisplayName as getSpaceName,
        addRoomToSpace,
        canAddRoomToSpace,
        getRoomNotificationSetting,
        setRoomNotificationSetting,
        getRoomTags,
        toggleRoomTag,
        getOwnAvatarUrl,
        getDMPartnerId,
        type RoomNotificationSetting,
        type SpaceChildInfo,
    } from "$lib/matrix/client";
    import { presenceState, presenceFor } from "$lib/stores/presence.svelte";
    import { settingsState } from "$lib/stores/settings.svelte";
    import {
        presenceDot,
        presenceDotClass,
        presenceLabel,
    } from "$lib/utils/presence";
    import {
        groupRoomsByTag,
        sortRoomsByTag,
        roomTagKind,
    } from "$lib/utils/roomOrdering";
    import { shouldOfferKnock, matrixErrorMessage } from "$lib/utils/knock";
    import {
        roomsState,
        setActiveRoom,
        setActiveSpace,
    } from "$lib/stores/rooms.svelte";
    import { hasLoudInRoom } from "$lib/stores/notifications.svelte";
    import {
        interfaceState,
        openModal,
        closeModal,
    } from "$lib/stores/interface.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import QuickActions from "$lib/components/layout/QuickActions.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";

    interface Props {
        onLogout: () => void;
        onOpenSpaceSettings?: (room: Room) => void;
        onOpenRoomSettings?: (room: Room) => void;
    }

    let { onLogout, onOpenSpaceSettings, onOpenRoomSettings }: Props = $props();
    const ownAvatarSrc = $derived.by(() => {
        roomsState.roomsTick;
        return getOwnAvatarUrl();
    });

    // Presence dot per DM partner, keyed by room id. Unknown presence (server
    // may have it disabled) renders as offline.
    const dmPresence = $derived.by(() => {
        void presenceState.presenceTick;
        void roomsState.roomsTick;
        const map = new Map<string, { dotClass: string; label: string }>();
        for (const room of roomsState.directRooms) {
            const p = presenceFor(getDMPartnerId(room));
            const state = p?.state ?? "offline";
            map.set(room.roomId, {
                dotClass: presenceDotClass(presenceDot(state)),
                label: p?.statusMsg
                    ? `${presenceLabel(state)} — ${p.statusMsg}`
                    : presenceLabel(state),
            });
        }
        return map;
    });

    // Own dot: prefer the server-echoed presence (arrives over sync), fall
    // back to the advertised setting when nothing has come back yet.
    const ownPresence = $derived.by(() => {
        void presenceState.presenceTick;
        const p = auth.userId ? presenceFor(auth.userId) : null;
        const state = p?.state ?? settingsState.ownPresence;
        return {
            dotClass: presenceDotClass(presenceDot(state)),
            label: presenceLabel(state),
        };
    });

    // Rooms currently being joined (show spinner)
    let joiningIds = $state(new Set<string>());
    let inviteActionIds = $state(new Set<string>());

    // Knock-to-join prompt (shown when a join is refused but knocking may work)
    let knockPromptId = $state<string | null>(null);
    let knockReason = $state("");
    let knockError = $state("");

    // Context menu state
    let contextMenu = $state<{
        roomId: string;
        x: number;
        y: number;
        touch: boolean;
    } | null>(null);

    function positionMenu(node: HTMLElement, pos: { x: number; y: number }) {
        node.style.visibility = "hidden";
        node.style.left = "0px";
        node.style.top = "0px";
        requestAnimationFrame(() => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const w = node.offsetWidth;
            const h = node.offsetHeight;
            let left = Math.min(pos.x, vw - w - 4);
            if (left < 4) left = 4;
            let top = pos.y;
            if (top + h > vh - 4) top = pos.y - h;
            if (top < 4) top = 4;
            const maxH = vh - top - 4;
            if (h > maxH) node.style.maxHeight = maxH + "px";
            node.style.left = left + "px";
            node.style.top = top + "px";
            node.style.visibility = "";
        });
    }

    function openContextMenu(e: MouseEvent, roomId: string) {
        e.preventDefault();
        contextMenu = { roomId, x: e.clientX, y: e.clientY, touch: false };
        openModal("room-menu", () => (contextMenu = null));
    }

    let ctxTouchTimer: ReturnType<typeof setTimeout> | null = null;
    let ctxTouchStartX = 0,
        ctxTouchStartY = 0;

    function onRoomTouchStart(e: TouchEvent, roomId: string) {
        const t = e.touches[0];
        ctxTouchStartX = t.clientX;
        ctxTouchStartY = t.clientY;
        ctxTouchTimer = setTimeout(() => {
            ctxTouchTimer = null;
            navigator.vibrate?.(50);
            contextMenu = {
                roomId,
                x: ctxTouchStartX,
                y: ctxTouchStartY,
                touch: true,
            };
            openModal("room-menu", () => (contextMenu = null));
        }, 500);
    }

    function onRoomTouchMove(e: TouchEvent) {
        if (!ctxTouchTimer) return;
        const t = e.touches[0];
        const dx = t.clientX - ctxTouchStartX;
        const dy = t.clientY - ctxTouchStartY;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
            clearTimeout(ctxTouchTimer);
            ctxTouchTimer = null;
        }
    }

    function onRoomTouchEnd() {
        if (ctxTouchTimer) {
            clearTimeout(ctxTouchTimer);
            ctxTouchTimer = null;
        }
    }

    async function handleSetNotification(
        roomId: string,
        setting: RoomNotificationSetting,
    ) {
        closeModal();
        await setRoomNotificationSetting(roomId, setting);
    }

    async function handleAddToSpace(roomId: string, spaceId: string) {
        closeModal();
        await addRoomToSpace(spaceId, roomId);
    }

    // Two-click confirmation for the destructive Leave action.
    let leaveConfirmId = $state<string | null>(null);
    $effect(() => {
        void contextMenu; // reset whenever the menu opens/closes/changes
        leaveConfirmId = null;
    });

    async function handleToggleTag(
        roomId: string,
        kind: "favourite" | "lowPriority",
    ) {
        closeModal();
        try {
            await toggleRoomTag(roomId, kind);
            roomsState.roomsTick++;
        } catch (err) {
            console.error("Failed to update room tag:", err);
        }
    }

    async function handleLeave(roomId: string) {
        closeModal();
        try {
            await leaveRoom(roomId);
            if (roomsState.activeRoomId === roomId)
                roomsState.activeRoomId = null;
            roomsState.orphanRooms = roomsState.orphanRooms.filter(
                (r) => r.roomId !== roomId,
            );
            roomsState.directRooms = roomsState.directRooms.filter(
                (r) => r.roomId !== roomId,
            );
            roomsState.roomsInSpace = roomsState.roomsInSpace.filter(
                (r) => r.roomId !== roomId,
            );
            roomsState.spaces = roomsState.spaces.filter(
                (r) => r.roomId !== roomId,
            );
            roomsState.spaceHierarchy = roomsState.spaceHierarchy.map((r) =>
                r.roomId === roomId ? { ...r, isJoined: false } : r,
            );
        } catch (err) {
            console.error("Failed to leave room:", err);
        }
    }

    const title = $derived(
        roomsState.activeSpaceId === null
            ? "Home"
            : roomsState.spaces.find(
                  (s) => s.roomId === roomsState.activeSpaceId,
              )?.name || "Space",
    );

    const visibleRooms = $derived(
        roomsState.activeSpaceId === null
            ? roomsState.orphanRooms
            : roomsState.roomsInSpace,
    );

    // Tags mutate in place on the live Room objects, so depend on roomsTick.
    const roomGroups = $derived.by(() => {
        void roomsState.roomsTick;
        return groupRoomsByTag(visibleRooms, (r) => getRoomTags(r.roomId));
    });

    const sortedDirectRooms = $derived.by(() => {
        void roomsState.roomsTick;
        return sortRoomsByTag(roomsState.directRooms, (r) =>
            getRoomTags(r.roomId),
        );
    });

    const unjoinedRooms = $derived(
        roomsState.activeSpaceId !== null
            ? roomsState.spaceHierarchy.filter((r) => !r.isJoined && !r.isSpace)
            : [],
    );

    const childSpaces = $derived(
        roomsState.activeSpaceId !== null
            ? roomsState.spaceHierarchy.filter((r) => r.isSpace)
            : [],
    );

    const showDMs = $derived(
        roomsState.activeSpaceId === null && roomsState.directRooms.length > 0,
    );

    async function handleJoin(room: SpaceChildInfo) {
        const roomId = room.roomId;
        joiningIds = new Set(joiningIds).add(roomId);
        try {
            await joinRoom(roomId, room.via);
            // Mark as joined in hierarchy so the UI updates immediately
            roomsState.spaceHierarchy = roomsState.spaceHierarchy.map((r) =>
                r.roomId === roomId ? { ...r, isJoined: true } : r,
            );
            // Navigate into the room
            setActiveRoom(roomId);
        } catch (err) {
            console.error("Failed to join room:", err);
            if (shouldOfferKnock(err, room.joinRule)) {
                knockPromptId = roomId;
                knockReason = "";
                knockError = "";
            }
        } finally {
            const next = new Set(joiningIds);
            next.delete(roomId);
            joiningIds = next;
        }
    }

    async function handleKnock(room: SpaceChildInfo) {
        const roomId = room.roomId;
        joiningIds = new Set(joiningIds).add(roomId);
        knockError = "";
        try {
            await knockRoom(roomId, knockReason, room.via);
            knockPromptId = null;
            // Mark as requested in hierarchy so the UI updates immediately
            roomsState.spaceHierarchy = roomsState.spaceHierarchy.map((r) =>
                r.roomId === roomId ? { ...r, isKnocked: true } : r,
            );
        } catch (err) {
            console.error("Failed to knock on room:", err);
            knockError = matrixErrorMessage(
                err,
                "Could not send the join request",
            );
        } finally {
            const next = new Set(joiningIds);
            next.delete(roomId);
            joiningIds = next;
        }
    }

    async function handleCancelKnock(roomId: string) {
        joiningIds = new Set(joiningIds).add(roomId);
        try {
            await cancelKnock(roomId);
            roomsState.spaceHierarchy = roomsState.spaceHierarchy.map((r) =>
                r.roomId === roomId ? { ...r, isKnocked: false } : r,
            );
        } catch (err) {
            console.error("Failed to cancel join request:", err);
        } finally {
            const next = new Set(joiningIds);
            next.delete(roomId);
            joiningIds = next;
        }
    }

    async function handleAccept(roomId: string) {
        inviteActionIds = new Set(inviteActionIds).add(roomId);
        try {
            await acceptInvite(roomId);
            setActiveRoom(roomId);
        } catch (err) {
            console.error("Failed to accept invite:", err);
        } finally {
            const next = new Set(inviteActionIds);
            next.delete(roomId);
            inviteActionIds = next;
        }
    }

    async function handleReject(roomId: string) {
        inviteActionIds = new Set(inviteActionIds).add(roomId);
        try {
            await rejectInvite(roomId);
        } catch (err) {
            console.error("Failed to reject invite:", err);
        } finally {
            const next = new Set(inviteActionIds);
            next.delete(roomId);
            inviteActionIds = next;
        }
    }

    const activeSpaceRoom = $derived(
        roomsState.activeSpaceId ? getRoom(roomsState.activeSpaceId) : null,
    );

    const canAccessSpaceSettings = $derived.by(() => {
        // Power levels arrive over sync mutating the same Room object, so
        // re-run on the tick or this stays false after a fresh page load.
        void roomsState.roomsTick;
        if (!activeSpaceRoom) return false;
        const myPl = getMyPowerLevel(activeSpaceRoom);
        const pl = getRoomPowerLevels(activeSpaceRoom);
        return myPl >= pl.state_default || myPl >= pl.kick || myPl >= pl.ban;
    });

    function roomButton(room: Room) {
        const isActive = roomsState.activeRoomId === room.roomId;
        roomsState.unreadTick; // track read receipt / new message changes
        const { unread, highlight } = getRoomUnreadInfo(room);
        const loud = hasLoudInRoom(room.roomId);
        return { isActive, unread: unread || loud, highlight, loud };
    }
</script>

<div class="w-60 bg-discord-backgroundSecondary flex flex-col flex-shrink-0">
    <!-- Header -->
    <div
        class="h-12 px-4 flex items-center border-b border-discord-divider shadow-sm flex-shrink-0 gap-2"
    >
        <h2 class="font-semibold text-discord-textPrimary truncate flex-1">
            {title}
        </h2>
        {#if roomsState.hierarchyLoading}
            <div
                class="w-3.5 h-3.5 border-2 border-discord-textMuted border-t-transparent rounded-full animate-spin flex-shrink-0"
            ></div>
        {/if}
        <!-- Dropdown trigger -->
        <div class="relative flex-shrink-0">
            <button
                onclick={() =>
                    interfaceState.modal === "room-header-menu"
                        ? closeModal()
                        : openModal("room-header-menu", () => {})}
                class="p-1 rounded text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                title="Actions"
            >
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                </svg>
            </button>
            {#if interfaceState.modal === "room-header-menu"}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="fixed inset-0 z-40" onclick={closeModal}></div>
            {/if}
            <div
                class="absolute right-0 top-full mt-1 z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-44 {interfaceState.modal ===
                'room-header-menu'
                    ? ''
                    : 'hidden'}"
            >
                <QuickActions spaceId={roomsState.activeSpaceId ?? undefined} />
                {#if canAccessSpaceSettings}
                    <div class="w-full h-px bg-discord-divider my-1"></div>
                    <button
                        onclick={() =>
                            activeSpaceRoom &&
                            onOpenSpaceSettings?.(activeSpaceRoom)}
                        class="w-full flex items-center gap-2 pr-2 py-1.5 text-left text-sm text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                        style="padding-left: 0.5rem;"
                    >
                        <svg
                            class="w-4 h-4 flex-shrink-0 opacity-70"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"
                            />
                        </svg>
                        <span class="flex-1 truncate">Space Settings</span>
                    </button>
                {/if}
            </div>
        </div>
    </div>

    <!-- Room list -->
    <div class="flex-1 overflow-y-auto">
        <!-- Inbox button (home view only) -->
        {#if !roomsState.activeSpaceId}
            <button
                onclick={() => {
                    roomsState.showInbox = true;
                    roomsState.activeRoomId = null;
                    // The inbox fills the main area like a room — always close.
                    if (interfaceState.isMobile)
                        interfaceState.leftOpen = false;
                }}
                class="mb-2 w-full flex items-center gap-2 pr-2 py-1.5 transition-colors text-left"
                class:text-discord-textPrimary={roomsState.showInbox}
                class:text-discord-textSecondary={!roomsState.showInbox}
                class:hover:bg-discord-messageHover={!roomsState.showInbox}
                class:hover:text-discord-textPrimary={!roomsState.showInbox}
                style={roomsState.showInbox
                    ? "border-left: 3px solid var(--discord-accent); background: linear-gradient(to right, var(--discord-bg-selected) 85%, var(--discord-bg-secondary)); padding-left: calc(0.5rem - 3px);"
                    : "padding-left: 0.5rem;"}
            >
                <svg
                    class="w-4 h-4 flex-shrink-0 opacity-70"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    ><path
                        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
                    /></svg
                >
                <span class="flex-1 text-sm truncate">Pending Invites</span>
                {#if roomsState.invitedRooms.length + roomsState.knockedRooms.length > 0}
                    <span
                        class="flex-shrink-0 bg-discord-danger text-white text-xs font-bold rounded-full px-1.5 min-w-[1.2rem] text-center"
                    >
                        {roomsState.invitedRooms.length +
                            roomsState.knockedRooms.length}
                    </span>
                {/if}
            </button>
        {/if}

        <!-- Joined rooms / channels -->
        {#snippet channelRow(room: Room)}
            {@const { isActive, unread, highlight, loud } = roomButton(room)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="group/room flex items-center transition-colors"
                class:hover:bg-discord-messageHover={!isActive}
                style={isActive
                    ? "border-left: 3px solid var(--discord-accent); background: linear-gradient(to right, var(--discord-bg-selected) 85%, var(--discord-bg-secondary));"
                    : ""}
                oncontextmenu={(e) => openContextMenu(e, room.roomId)}
                ontouchstart={(e) => onRoomTouchStart(e, room.roomId)}
                ontouchmove={onRoomTouchMove}
                ontouchend={onRoomTouchEnd}
            >
                <button
                    onclick={() => setActiveRoom(room.roomId)}
                    class="flex-1 flex items-center py-1.5 min-w-0 text-left transition-colors"
                    class:text-discord-textPrimary={isActive || unread}
                    class:text-discord-textSecondary={!isActive && !unread}
                    class:hover:text-discord-textPrimary={!isActive}
                    class:font-semibold={unread}
                    style={isActive
                        ? "padding-left: calc(0.5rem - 3px);"
                        : "padding-left: 0.5rem;"}
                >
                    <div
                        class="w-4 flex-shrink-0 flex items-center justify-center mr-1.5"
                    >
                        {#if unread && !isActive}
                            <span
                                class="w-2 h-2 rounded-full {loud || highlight
                                    ? 'bg-discord-danger'
                                    : 'bg-white'} flex-shrink-0"
                            ></span>
                        {:else}
                            <span
                                class="w-5 h-5 opacity-70 font-semibold flex items-center justify-center text-[0.8rem]"
                                >#</span
                            >
                        {/if}
                    </div>
                    <span class="flex-1 text-sm truncate"
                        >{getRoomDisplayName(room)}</span
                    >
                    {#if highlight && !isActive}
                        <span
                            class="flex-shrink-0 bg-discord-danger text-white text-xs font-bold rounded-full px-1.5 min-w-[1.2rem] text-center ml-1"
                        >
                            {highlight > 99 ? "99+" : highlight}
                        </span>
                    {/if}
                </button>
                <!-- svelte-ignore a11y_consider_explicit_label -->
                <button
                    onclick={(e) => {
                        e.stopPropagation();
                        onOpenRoomSettings?.(room);
                    }}
                    class="flex-shrink-0 p-1 mr-1 rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors opacity-0 group-hover/room:opacity-100"
                    title="Room settings"
                >
                    <svg
                        class="w-3.5 h-3.5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.37 1.04.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"
                        />
                    </svg>
                </button>
            </div>
        {/snippet}

        {#if visibleRooms.length > 0}
            <div class="mb-2">

                {#if roomGroups.favourites.length > 0}
                    <p
                        class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                    >
                        Favourites
                    </p>
                    {#each roomGroups.favourites as room (room.roomId)}
                        {@render channelRow(room)}
                    {/each}
                {/if}
                {#if roomGroups.normal.length > 0}
                    <p
                        class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                    >
                        {roomsState.activeSpaceId ? "Channels" : "Rooms"}
                    </p>
                    {#each roomGroups.normal as room (room.roomId)}
                        {@render channelRow(room)}
                    {/each}
                {/if}
                {#if roomGroups.lowPriority.length > 0}
                    <p
                        class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                    >
                        Low Priority
                    </p>
                    {#each roomGroups.lowPriority as room (room.roomId)}
                        {@render channelRow(room)}
                    {/each}
                {/if}
            </div>
        {/if}

        <!-- Unjoined rooms (from space hierarchy) -->
        {#if unjoinedRooms.length > 0 || childSpaces.length > 0}
            <div class="mb-2">
                <p
                    class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    Browse Channels
                </p>
                {#each childSpaces as space (space.roomId)}
                    <button
                        onclick={() => setActiveSpace(space.roomId)}
                        class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-discord-messageHover transition-colors group"
                    >
                        <svg
                            class="w-5 h-5 flex-shrink-0 text-discord-textSecondary opacity-50"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"
                            />
                        </svg>
                        <div class="flex-1 min-w-0">
                            <p
                                class="text-sm text-discord-textSecondary group-hover:text-discord-textPrimary truncate transition-colors"
                            >
                                {space.name}
                            </p>
                            {#if space.numMembers > 0}
                                <p
                                    class="text-xs text-discord-textMuted opacity-70"
                                >
                                    {space.numMembers} members
                                </p>
                            {/if}
                        </div>
                        <svg
                            class="w-3.5 h-3.5 flex-shrink-0 text-discord-textMuted opacity-0 group-hover:opacity-100 transition-opacity"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"
                            />
                        </svg>
                    </button>
                {/each}
                {#each unjoinedRooms as room (room.roomId)}
                    {@const isJoining = joiningIds.has(room.roomId)}
                    <div
                        class="flex items-center gap-2 px-2 py-1.5 rounded group hover:bg-discord-messageHover transition-colors"
                    >
                        <!-- Channel icon -->
                        <span
                            class="w-5 h-5 flex-shrink-0 text-discord-textSecondary opacity-50 font-semibold flex items-center justify-center"
                            >#</span
                        >

                        <!-- Name + member count -->
                        <div class="flex-1 min-w-0">
                            <p
                                class="text-sm text-discord-textSecondary group-hover:text-discord-textPrimary truncate transition-colors"
                            >
                                {room.name}
                            </p>
                            {#if room.numMembers > 0}
                                <p
                                    class="text-xs text-discord-textMuted opacity-70"
                                >
                                    {room.numMembers} members
                                </p>
                            {/if}
                        </div>

                        {#if room.isKnocked}
                            <!-- Pending knock: state chip + cancel on hover -->
                            <span
                                class="flex-shrink-0 text-xs font-semibold text-discord-textMuted group-hover:hidden"
                                >Requested</span
                            >
                            <button
                                onclick={() => handleCancelKnock(room.roomId)}
                                disabled={isJoining}
                                class="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded border border-discord-divider text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-60 disabled:cursor-not-allowed hidden group-hover:block"
                            >
                                Cancel request
                            </button>
                        {:else}
                            <!-- Join button -->
                            <button
                                onclick={() => handleJoin(room)}
                                disabled={isJoining}
                                class="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed opacity-0 group-hover:opacity-100"
                            >
                                {#if isJoining}
                                    <span class="flex items-center gap-1">
                                        <span
                                            class="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin"
                                        ></span>
                                    </span>
                                {:else}
                                    Join
                                {/if}
                            </button>
                        {/if}
                    </div>
                    {#if knockPromptId === room.roomId && !room.isKnocked}
                        <div
                            class="mx-2 mb-1.5 p-2 rounded bg-discord-backgroundTertiary flex flex-col gap-1.5"
                        >
                            <p class="text-xs text-discord-textMuted">
                                You can't join this room directly — request to
                                join instead?
                            </p>
                            <input
                                bind:value={knockReason}
                                placeholder="Reason (optional)"
                                class="w-full px-2 py-1 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-xs"
                            />
                            {#if knockError}
                                <p class="text-xs text-discord-error">
                                    {knockError}
                                </p>
                            {/if}
                            <div class="flex justify-end gap-1.5">
                                <button
                                    onclick={() => (knockPromptId = null)}
                                    class="px-2 py-0.5 text-xs font-medium rounded text-discord-textMuted hover:text-discord-textPrimary transition-colors"
                                    >Not now</button
                                >
                                <button
                                    onclick={() => handleKnock(room)}
                                    disabled={isJoining}
                                    class="px-2 py-0.5 text-xs font-semibold rounded bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-60"
                                    >Request to join</button
                                >
                            </div>
                        </div>
                    {/if}
                {/each}
            </div>
        {/if}

        <!-- Direct messages -->
        {#if showDMs}
            <div class="mb-2">
                <p
                    class="px-2 py-1 text-xs font-semibold text-discord-textMuted uppercase tracking-wide"
                >
                    Direct Messages
                </p>
                {#each sortedDirectRooms as room (room.roomId)}
                    {@const { isActive, unread, highlight, loud } =
                        roomButton(room)}
                    {@const avatarSrc = getRoomAvatar(room)}
                    <button
                        onclick={() => setActiveRoom(room.roomId)}
                        oncontextmenu={(e) => openContextMenu(e, room.roomId)}
                        ontouchstart={(e) => onRoomTouchStart(e, room.roomId)}
                        ontouchmove={onRoomTouchMove}
                        ontouchend={onRoomTouchEnd}
                        class="w-full flex items-center gap-2 pr-2 py-1.5 transition-colors text-left"
                        class:text-discord-textPrimary={isActive || unread}
                        class:text-discord-textSecondary={!isActive && !unread}
                        class:font-semibold={unread}
                        class:hover:bg-discord-messageHover={!isActive}
                        class:hover:text-discord-textPrimary={!isActive}
                        style={isActive
                            ? "border-left: 3px solid var(--discord-accent); background: linear-gradient(to right, var(--discord-bg-selected) 85%, var(--discord-bg-secondary)); padding-left: calc(0.5rem - 3px);"
                            : "padding-left: 0.5rem;"}
                    >
                        <div class="relative flex-shrink-0">
                            <Avatar
                                src={avatarSrc}
                                name={getRoomDisplayName(room)}
                                size={32}
                            />
                            {#if unread && !isActive}
                                <span
                                    class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-backgroundSecondary {loud ||
                                    highlight
                                        ? 'bg-discord-danger'
                                        : 'bg-white'}"
                                ></span>
                            {:else}
                                {@const presence = dmPresence.get(room.roomId)}
                                <span
                                    title={presence?.label}
                                    class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-discord-backgroundSecondary {presence?.dotClass ??
                                        'bg-discord-offline'}"
                                ></span>
                            {/if}
                        </div>
                        <span class="flex-1 text-sm truncate"
                            >{getRoomDisplayName(room)}</span
                        >
                        {#if highlight && !isActive}
                            <span
                                class="flex-shrink-0 bg-discord-danger text-white text-xs font-bold rounded-full px-1.5 min-w-[1.2rem] text-center"
                            >
                                {highlight > 99 ? "99+" : highlight}
                            </span>
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}

        {#if visibleRooms.length === 0 && unjoinedRooms.length === 0 && !roomsState.hierarchyLoading && !showDMs}
            <p class="px-4 py-8 text-sm text-discord-textMuted text-center">
                No rooms yet
            </p>
        {/if}
    </div>

    <!-- User bar -->
    <div
        class="h-14 px-2 flex items-center gap-2 bg-discord-backgroundTertiary flex-shrink-0"
    >
        <div class="relative">
            <Avatar
                src={ownAvatarSrc}
                name={auth.userId || "?"}
                id={auth.userId}
                size={32}
            />
            <div
                title={ownPresence.label}
                class="absolute bottom-0 right-0 w-3 h-3 {ownPresence.dotClass} rounded-full border-2 border-discord-backgroundTertiary"
            ></div>
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-discord-textPrimary truncate">
                {auth.userId?.split(":")[0].replace("@", "") ?? "Unknown"}
            </p>
            <p class="text-xs text-discord-textSecondary truncate">
                {auth.userId ?? ""}
            </p>
        </div>
        <button
            onclick={onLogout}
            class="p-1.5 rounded text-discord-textMuted hover:text-discord-danger hover:bg-discord-messageHover transition-colors"
            title="Logout"
        >
            <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
            </svg>
        </button>
    </div>
</div>

<Portal>
    {#if contextMenu}
        {@const cm = contextMenu}
        {@const currentSetting = getRoomNotificationSetting(cm.roomId)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-50 {cm.touch ? 'bg-black/40' : ''}"
            onclick={closeModal}
        ></div>

        {#snippet menuItems()}
            <p
                class="px-3 py-1 text-xs text-discord-textMuted uppercase font-semibold tracking-wide"
            >
                Notifications
            </p>
            {#each [["default", "Default"], ["all", "All Messages"], ["mentions", "Mentions Only"], ["mute", "Mute"]] as const as [val, label]}
                <button
                    onclick={() => handleSetNotification(cm.roomId, val)}
                    class="w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2"
                    class:text-discord-textPrimary={currentSetting === val}
                    class:text-discord-textSecondary={currentSetting !== val}
                    class:hover:bg-discord-messageHover={true}
                >
                    <span class="w-3 text-center text-xs"
                        >{currentSetting === val ? "●" : ""}</span
                    >
                    {label}
                </button>
            {/each}
            <div class="w-full h-px bg-discord-divider my-1"></div>
            {@const activeTagKind =
                (void roomsState.roomsTick,
                roomTagKind(getRoomTags(cm.roomId)))}
            {#each [["favourite", "Favourite"], ["lowPriority", "Low Priority"]] as const as [kind, label]}
                <button
                    onclick={() => handleToggleTag(cm.roomId, kind)}
                    class="w-full text-left px-3 py-1.5 text-sm transition-colors flex items-center gap-2"
                    class:text-discord-textPrimary={activeTagKind === kind}
                    class:text-discord-textSecondary={activeTagKind !== kind}
                    class:hover:bg-discord-messageHover={true}
                >
                    <span class="w-3 text-center text-xs"
                        >{activeTagKind === kind ? "●" : ""}</span
                    >
                    {label}
                </button>
            {/each}
            {#if getSpaces().filter( (s) => canAddRoomToSpace(s.roomId), ).length > 0}
                {@const eligibleSpaces = getSpaces().filter((s) =>
                    canAddRoomToSpace(s.roomId),
                )}
                <div class="w-full h-px bg-discord-divider my-1"></div>
                <p
                    class="px-3 py-1 text-xs text-discord-textMuted uppercase font-semibold tracking-wide"
                >
                    Add to Space
                </p>
                {#each eligibleSpaces as space}
                    <button
                        onclick={() =>
                            handleAddToSpace(cm.roomId, space.roomId)}
                        class="w-full text-left px-3 py-1.5 text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors truncate"
                        >{getSpaceName(space)}</button
                    >
                {/each}
            {/if}
            <div class="w-full h-px bg-discord-divider my-1"></div>
            {#if leaveConfirmId === cm.roomId}
                <button
                    onclick={() => handleLeave(cm.roomId)}
                    class="w-full text-left px-3 py-1.5 text-sm bg-discord-danger text-white font-medium transition-colors"
                    >Click again to leave</button
                >
            {:else}
                <button
                    onclick={() => (leaveConfirmId = cm.roomId)}
                    class="w-full text-left px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white transition-colors"
                    >Leave Room</button
                >
            {/if}
        {/snippet}

        {#if cm.touch}
            <div
                class="fixed bottom-0 left-0 right-0 z-50 bg-discord-backgroundTertiary border-t border-discord-divider rounded-t-2xl shadow-2xl pb-safe pt-2 max-h-[70vh] overflow-y-auto"
            >
                <div
                    class="w-10 h-1 bg-discord-divider rounded-full mx-auto mb-2"
                ></div>
                {@render menuItems()}
            </div>
        {:else}
            <div
                use:positionMenu={{ x: cm.x, y: cm.y }}
                class="fixed z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-44 max-w-52 overflow-y-auto"
            >
                {@render menuItems()}
            </div>
        {/if}
    {/if}
</Portal>
