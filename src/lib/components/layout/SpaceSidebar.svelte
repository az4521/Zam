<script lang="ts">
    import type { Room } from "matrix-js-sdk";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import RoomDirectory from "$lib/components/layout/RoomDirectory.svelte";
    import {
        getRoomAvatar,
        getRoomDisplayName,
        leaveRoom,
        setSpaceLayout,
        getRoomUnreadInfo,
        getRoomsInSpace,
        getSpaceChildIds,
        getRoom,
        getOrphanRooms,
        getDirectRooms,
        addRoomToSpace,
        canAddRoomToSpace,
        canInviteToRoom,
        getRoomShareLink,
        markRoomAsRead,
        createRoom as createRoomFn,
        getRoomNotificationSetting,
        setRoomNotificationSetting,
        type RoomNotificationSetting,
        type SpaceLayout,
    } from "$lib/matrix/client";
    import {
        roomsState,
        setActiveSpace,
        setActiveRoom,
    } from "$lib/stores/rooms.svelte";
    import { openInviteDialog } from "$lib/stores/inviteDialog.svelte";
    import {
        hasLoudInRoom,
        hasLoudInSpace,
    } from "$lib/stores/notifications.svelte";
    import { openModal, closeModal } from "$lib/stores/interface.svelte";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { mapWithConcurrency } from "$lib/utils/async";

    function getSpaceNotifs(
        spaceId: string,
        visited = new Set<string>(),
    ): { unread: boolean; highlight: boolean; loud: boolean } {
        void roomsState.unreadTick;
        if (visited.has(spaceId))
            return { unread: false, highlight: false, loud: false };
        visited.add(spaceId);
        const loud = hasLoudInSpace(spaceId);
        const rooms = getRoomsInSpace(spaceId);
        let unread = loud;
        let highlight = false;
        for (const r of rooms) {
            const info = getRoomUnreadInfo(r);
            if (info.highlight) {
                highlight = true;
                unread = true;
            } else if (info.unread) unread = true;
        }
        for (const childId of getSpaceChildIds(spaceId)) {
            const child = getRoom(childId);
            if (!child?.isSpaceRoom()) continue;
            const info = getSpaceNotifs(childId, visited);
            if (info.highlight) highlight = true;
            if (info.unread) unread = true;
        }
        return { unread, highlight, loud };
    }

    function getHomeNotifs(): {
        unread: boolean;
        highlight: boolean;
        loud: boolean;
    } {
        void roomsState.unreadTick;
        const rooms = [...getOrphanRooms(), ...getDirectRooms()];
        let unread = false;
        let highlight = false;
        let loud = false;
        for (const r of rooms) {
            if (hasLoudInRoom(r.roomId)) {
                loud = true;
                unread = true;
            }
            const info = getRoomUnreadInfo(r);
            if (info.highlight) {
                highlight = true;
                unread = true;
            } else if (info.unread) unread = true;
        }
        return { unread, highlight, loud };
    }

    interface Props {
        onHomeClick: () => void;
        onSettingsClick: () => void;
        onOpenSpaceSettings?: (room: Room) => void;
    }

    let { onHomeClick, onSettingsClick, onOpenSpaceSettings }: Props = $props();

    type ContextMenu =
        | {
              kind: "space";
              spaceId: string;
              folderId: string | null;
              x: number;
              y: number;
              touch: boolean;
          }
        | {
              kind: "folder";
              folderId: string;
              x: number;
              y: number;
              touch: boolean;
          };

    const FOLDER_COLORS = [
        "#7289da",
        "#3ba55c",
        "#ed4245",
        "#faa61a",
        "#eb459e",
        "#00b0f0",
        "#9475f5",
        "#23a559",
    ];

    let contextMenu = $state<ContextMenu | null>(null);
    let expandedFolders = $state(new Set<string>());
    let colorPicker = $state<{ folderId: string } | null>(null);

    // HSV color picker state
    let cpHue = $state(0); // 0–360
    let cpSat = $state(1); // 0–1
    let cpVal = $state(1); // 0–1
    let svBoxEl = $state<HTMLElement | null>(null);
    let hueSliderEl = $state<HTMLElement | null>(null);

    const cpHex = $derived(hsvToHex(cpHue, cpSat, cpVal));

    function hsvToHex(h: number, s: number, v: number): string {
        const f = (n: number) => {
            const k = (n + h / 60) % 6;
            return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
        };
        const r = Math.round(f(5) * 255);
        const g = Math.round(f(3) * 255);
        const b = Math.round(f(1) * 255);
        return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    }

    function hexToHsv(hex: string): [number, number, number] {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b),
            min = Math.min(r, g, b),
            d = max - min;
        const v = max;
        const s = max === 0 ? 0 : d / max;
        let hh = 0;
        if (d !== 0) {
            if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) * 60;
            else if (max === g) hh = ((b - r) / d + 2) * 60;
            else hh = ((r - g) / d + 4) * 60;
        }
        return [hh, s, v];
    }

    function setHsvFromHex(hex: string) {
        if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
            [cpHue, cpSat, cpVal] = hexToHsv(hex);
        }
    }

    function startSVDrag(e: MouseEvent) {
        e.preventDefault();
        updateSV(e);
        const onMove = (ev: MouseEvent) => updateSV(ev);
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    function updateSV(e: MouseEvent) {
        if (!svBoxEl) return;
        const rect = svBoxEl.getBoundingClientRect();
        cpSat = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        cpVal = Math.max(
            0,
            Math.min(1, 1 - (e.clientY - rect.top) / rect.height),
        );
    }

    function startHueDrag(e: MouseEvent) {
        e.preventDefault();
        updateHue(e);
        const onMove = (ev: MouseEvent) => updateHue(ev);
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    function updateHue(e: MouseEvent) {
        if (!hueSliderEl) return;
        const rect = hueSliderEl.getBoundingClientRect();
        cpHue = Math.max(
            0,
            Math.min(360, ((e.clientY - rect.top) / rect.height) * 360),
        );
    }

    // Drag state
    let dragState = $state<{ id: string; fromFolderId: string | null } | null>(
        null,
    );
    // id = root item id or folder-space id, position = where to drop relative to it
    let dropTarget = $state<{
        id: string;
        position: "before" | "after" | "into";
    } | null>(null);

    type RootItem =
        | { kind: "space"; id: string; space: Room }
        | { kind: "folder"; id: string; spaces: Room[] };

    const rootItems = $derived.by((): RootItem[] => {
        const { order, folders } = roomsState.spaceLayout;
        const spacesInFolders = new Set(
            Object.values(folders).flatMap((f) => f.spaceIds),
        );

        if (!order.length) {
            return roomsState.spaces.map((s) => ({
                kind: "space",
                id: s.roomId,
                space: s,
            }));
        }

        const result: RootItem[] = [];
        for (const id of order) {
            if (folders[id]) {
                const folderSpaces = folders[id].spaceIds
                    .map((sid) =>
                        roomsState.spaces.find((s) => s.roomId === sid),
                    )
                    .filter((s): s is Room => !!s);
                result.push({ kind: "folder", id, spaces: folderSpaces });
            } else {
                const space = roomsState.spaces.find((s) => s.roomId === id);
                if (space) result.push({ kind: "space", id, space });
            }
        }
        for (const space of roomsState.spaces) {
            if (
                !order.includes(space.roomId) &&
                !spacesInFolders.has(space.roomId)
            ) {
                result.push({ kind: "space", id: space.roomId, space });
            }
        }
        return result;
    });

    const spaceFolderMap = $derived.by(() => {
        const map = new Map<string, string>();
        for (const [folderId, folder] of Object.entries(
            roomsState.spaceLayout.folders,
        )) {
            for (const spaceId of folder.spaceIds) {
                map.set(spaceId, folderId);
            }
        }
        return map;
    });

    function getLayout(): SpaceLayout {
        return {
            order: [...roomsState.spaceLayout.order],
            folders: Object.fromEntries(
                Object.entries(roomsState.spaceLayout.folders).map(([k, v]) => [
                    k,
                    { ...v, spaceIds: [...v.spaceIds] },
                ]),
            ),
        };
    }

    function saveLayout(layout: SpaceLayout) {
        // Dissolve any empty folders
        for (const [folderId, folder] of Object.entries(layout.folders)) {
            if (folder.spaceIds.length === 0) {
                layout.order = layout.order.filter((id) => id !== folderId);
                delete layout.folders[folderId];
            }
        }
        roomsState.spaceLayout = layout;
        setSpaceLayout(layout).catch((err) =>
            console.error("[setSpaceLayout] failed:", err),
        );
    }

    function isDraggingSpace(): boolean {
        if (!dragState) return false;
        if (dragState.fromFolderId !== null) return true;
        return !roomsState.spaceLayout.folders[dragState.id];
    }

    function calcPos(
        e: DragEvent,
        zones: "two" | "three",
    ): "before" | "after" | "into" {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const rel = (e.clientY - rect.top) / rect.height;
        if (zones === "three")
            return rel < 0.3 ? "before" : rel > 0.7 ? "after" : "into";
        return rel < 0.5 ? "before" : "after";
    }

    // --- Drag handlers ---

    function onDragStart(
        e: DragEvent,
        id: string,
        fromFolderId: string | null,
    ) {
        dragState = { id, fromFolderId };
        e.dataTransfer!.effectAllowed = "move";
    }

    function onRootItemDragOver(
        e: DragEvent,
        targetId: string,
        targetKind: "space" | "folder",
    ) {
        e.preventDefault();
        e.stopPropagation();
        if (!dragState || dragState.id === targetId) return;

        let position: "before" | "after" | "into";
        if (
            isDraggingSpace() &&
            (targetKind === "space" || targetKind === "folder")
        ) {
            // Space onto space/folder: 3-zone (middle = merge/into)
            position = calcPos(e, "three");
        } else {
            // Folder onto anything: 2-zone (reorder only)
            position = calcPos(e, "two");
        }
        dropTarget = { id: targetId, position };
    }

    function onFolderSpaceDragOver(e: DragEvent, targetId: string) {
        e.preventDefault();
        e.stopPropagation();
        if (!dragState || dragState.id === targetId) return;
        dropTarget = { id: targetId, position: calcPos(e, "two") };
    }

    function onDragEnd() {
        dragState = null;
        dropTarget = null;
    }

    function performDrop() {
        if (!dragState) {
            onDragEnd();
            return;
        }

        if (!dropTarget) {
            // Dropped in empty space — move folder-space to root end
            if (dragState.fromFolderId !== null) {
                const layout = getLayout();
                layout.folders[dragState.fromFolderId].spaceIds =
                    layout.folders[dragState.fromFolderId].spaceIds.filter(
                        (id) => id !== dragState!.id,
                    );
                layout.order.push(dragState.id);
                saveLayout(layout);
            }
            onDragEnd();
            return;
        }

        const { id: fromId, fromFolderId } = dragState;
        const { id: toId, position } = dropTarget;
        if (fromId === toId) {
            onDragEnd();
            return;
        }

        const layout = getLayout();
        const toFolderId = spaceFolderMap.get(toId) ?? null;
        const toIsFolder = !!layout.folders[toId];

        if (fromFolderId !== null) {
            layout.folders[fromFolderId].spaceIds = layout.folders[
                fromFolderId
            ].spaceIds.filter((id) => id !== fromId);
        } else {
            layout.order = layout.order.filter((id) => id !== fromId);
        }

        if (position === "into") {
            if (toIsFolder) {
                if (!layout.folders[toId].spaceIds.includes(fromId))
                    layout.folders[toId].spaceIds.push(fromId);
                expandedFolders = new Set([...expandedFolders, toId]);
            } else {
                const toIndex = layout.order.indexOf(toId);
                layout.order.splice(toIndex, 1);
                const folderId = `folder_${Date.now()}`;
                layout.order.splice(toIndex, 0, folderId);
                layout.folders[folderId] = {
                    name: "",
                    spaceIds: [toId, fromId],
                };
                expandedFolders = new Set([...expandedFolders, folderId]);
            }
        } else if (toFolderId !== null) {
            const folderSpaces = layout.folders[toFolderId].spaceIds.filter(
                (id) => id !== fromId,
            );
            const toIndex = folderSpaces.indexOf(toId);
            folderSpaces.splice(
                position === "before" ? toIndex : toIndex + 1,
                0,
                fromId,
            );
            layout.folders[toFolderId].spaceIds = folderSpaces;
        } else {
            const toIndex = layout.order.indexOf(toId);
            layout.order.splice(
                position === "before" ? toIndex : toIndex + 1,
                0,
                fromId,
            );
        }

        saveLayout(layout);
        onDragEnd();
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        performDrop();
    }

    // --- Context menu ---

    function openSpaceContextMenu(
        e: MouseEvent | { clientX: number; clientY: number },
        spaceId: string,
        folderId: string | null = null,
    ) {
        if (e instanceof MouseEvent) e.preventDefault();
        contextMenu = {
            kind: "space",
            spaceId,
            folderId,
            x: e.clientX,
            y: e.clientY,
            touch: !(e instanceof MouseEvent),
        };
        openModal("space-menu", () => (contextMenu = null));
    }

    function openFolderContextMenu(
        e: MouseEvent | { clientX: number; clientY: number },
        folderId: string,
    ) {
        if (e instanceof MouseEvent) e.preventDefault();
        contextMenu = {
            kind: "folder",
            folderId,
            x: e.clientX,
            y: e.clientY,
            touch: !(e instanceof MouseEvent),
        };
        openModal("space-menu", () => (contextMenu = null));
    }

    // --- Actions ---

    async function handleSetSpaceNotification(
        spaceId: string,
        setting: RoomNotificationSetting,
    ) {
        closeModal();
        // Apply to the space room itself and all its rooms recursively
        const allRoomIds = new Set([spaceId]);
        const collect = (id: string, visited = new Set<string>()) => {
            if (visited.has(id)) return;
            visited.add(id);
            for (const r of getRoomsInSpace(id)) allRoomIds.add(r.roomId);
            for (const childId of getSpaceChildIds(id)) {
                const child = getRoom(childId);
                if (child?.isSpaceRoom()) collect(childId, visited);
            }
        };
        collect(spaceId);
        await mapWithConcurrency([...allRoomIds], 4, (id) =>
            setRoomNotificationSetting(id, setting),
        );
    }

    // Two-click confirmation for the destructive Leave Space action.
    let leaveConfirmId = $state<string | null>(null);
    $effect(() => {
        void contextMenu; // reset whenever the menu opens/closes/changes
        leaveConfirmId = null;
    });

    async function handleLeaveSpace(spaceId: string) {
        closeModal();
        try {
            await leaveRoom(spaceId);
            if (roomsState.activeSpaceId === spaceId) setActiveSpace(null);
        } catch (err) {
            console.error("Failed to leave space:", err);
        }
    }

    // ── Create room / Add room modals ─────────────────────────────────────────

    let createRoomModal = $state<{ spaceId: string } | null>(null);
    let addRoomModal = $state<{ spaceId: string } | null>(null);
    let modalInput1 = $state("");
    let modalInput2 = $state("");
    let modalLoading = $state(false);
    let modalError = $state("");

    function openCreateRoom(spaceId: string) {
        modalInput1 = "";
        modalInput2 = "";
        modalError = "";
        createRoomModal = { spaceId };
        openModal("create-room", () => (createRoomModal = null));
    }

    function openAddRoom(spaceId: string) {
        addRoomModal = { spaceId };
        openModal("add-room", () => (addRoomModal = null));
    }

    function handleOpenSpaceSettings(spaceId: string) {
        const room = getRoom(spaceId);
        closeModal();
        if (room) onOpenSpaceSettings?.(room);
    }
    function handleInviteToSpace(spaceId: string) {
        closeModal();
        openInviteDialog(spaceId);
    }
    async function handleCopySpaceLink(spaceId: string) {
        try {
            await navigator.clipboard.writeText(getRoomShareLink(spaceId));
        } catch {
            /* clipboard denied */
        }
        closeModal();
    }
    async function handleMarkSpaceRead(spaceId: string) {
        closeModal();
        await markRoomAsRead(spaceId);
    }

    let exploreOpen = $state(false);

    function openExplore() {
        exploreOpen = true;
        openModal("room-directory", () => (exploreOpen = false));
    }

    async function submitCreateRoom() {
        if (!createRoomModal) return;
        modalError = "";
        modalLoading = true;
        try {
            const roomId = await createRoomFn(
                modalInput1.trim(),
                modalInput2.trim(),
                createRoomModal.spaceId,
            );
            setActiveRoom(roomId);
            closeModal();
        } catch (e: any) {
            modalError = e?.data?.error ?? e?.message ?? "Something went wrong";
        } finally {
            modalLoading = false;
        }
    }

    async function submitAddRoom(roomId: string) {
        if (!addRoomModal) return;
        await addRoomToSpace(addRoomModal.spaceId, roomId);
        closeModal();
    }

    function getRoomsNotInSpace(spaceId: string) {
        const childIds = new Set(getSpaceChildIds(spaceId));
        return [...getOrphanRooms(), ...getDirectRooms()].filter(
            (r) => !childIds.has(r.roomId) && !r.isSpaceRoom(),
        );
    }

    function handleNewFolder(spaceId: string) {
        closeModal();
        const layout = getLayout();
        for (const fid in layout.folders) {
            layout.folders[fid].spaceIds = layout.folders[fid].spaceIds.filter(
                (id) => id !== spaceId,
            );
        }
        const folderId = `folder_${Date.now()}`;
        const spaceIndex = layout.order.indexOf(spaceId);
        layout.order = layout.order.filter((id) => id !== spaceId);
        layout.order.splice(
            spaceIndex === -1 ? layout.order.length : spaceIndex,
            0,
            folderId,
        );
        layout.folders[folderId] = { name: "", spaceIds: [spaceId] };
        saveLayout(layout);
        expandedFolders = new Set([...expandedFolders, folderId]);
    }

    function handleRemoveFromFolder(spaceId: string, folderId: string) {
        closeModal();
        const layout = getLayout();
        layout.folders[folderId].spaceIds = layout.folders[
            folderId
        ].spaceIds.filter((id) => id !== spaceId);
        const folderIndex = layout.order.indexOf(folderId);
        layout.order.splice(folderIndex + 1, 0, spaceId);
        saveLayout(layout);
    }

    function openColorPicker(folderId: string) {
        const current =
            roomsState.spaceLayout.folders[folderId]?.color ?? FOLDER_COLORS[0];
        setHsvFromHex(current);
        colorPicker = { folderId };
        openModal("color-picker", () => (colorPicker = null));
    }

    function commitColor() {
        if (!colorPicker) return;
        const layout = getLayout();
        if (!layout.folders[colorPicker.folderId]) return;
        layout.folders[colorPicker.folderId].color = cpHex;
        saveLayout(layout);
        closeModal();
    }

    function handleDissolveFolder(folderId: string) {
        closeModal();
        const layout = getLayout();
        const spaceIds = layout.folders[folderId]?.spaceIds ?? [];
        const folderIndex = layout.order.indexOf(folderId);
        layout.order = layout.order.filter((id) => id !== folderId);
        layout.order.splice(folderIndex, 0, ...spaceIds);
        delete layout.folders[folderId];
        saveLayout(layout);
    }

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

    function toggleFolder(folderId: string) {
        const next = new Set(expandedFolders);
        if (next.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        expandedFolders = next;
    }

    // --- Touch drag & long-press ---

    let touchDragActive = $state(false);
    let touchGhostId = $state<string | null>(null);
    let touchGhostX = $state(0);
    let touchGhostY = $state(0);

    let dragTouchTimer: ReturnType<typeof setTimeout> | null = null;
    let ctxTouchTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStartX = 0,
        touchStartY = 0,
        touchHasMoved = false;

    function onItemTouchStart(
        e: TouchEvent,
        id: string,
        fromFolderId: string | null,
        openCtx: (x: number, y: number) => void,
    ) {
        const t = e.touches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
        touchHasMoved = false;

        // 300ms → start drag
        dragTouchTimer = setTimeout(() => {
            dragTouchTimer = null;
            if (touchHasMoved) return;
            touchDragActive = true;
            touchGhostId = id;
            touchGhostX = touchStartX;
            touchGhostY = touchStartY;
            dragState = { id, fromFolderId };
            navigator.vibrate?.(30);
        }, 300);

        // 600ms → context menu (cancels drag if it started)
        ctxTouchTimer = setTimeout(() => {
            ctxTouchTimer = null;
            if (touchHasMoved) return;
            if (touchDragActive) {
                touchDragActive = false;
                touchGhostId = null;
                dragState = null;
                dropTarget = null;
            }
            navigator.vibrate?.(50);
            openCtx(touchStartX, touchStartY);
        }, 600);
    }

    function onItemTouchMove(e: TouchEvent) {
        const t = e.touches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        if (Math.sqrt(dx * dx + dy * dy) > 8) {
            touchHasMoved = true;
            if (ctxTouchTimer) {
                clearTimeout(ctxTouchTimer);
                ctxTouchTimer = null;
            }
            if (dragTouchTimer) {
                clearTimeout(dragTouchTimer);
                dragTouchTimer = null;
            }
        }

        if (!touchDragActive) return;
        e.preventDefault();

        touchGhostX = t.clientX;
        touchGhostY = t.clientY;

        // Find drop target under finger
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const btn = el?.closest("[data-drag-id]") as HTMLElement | null;
        if (btn) {
            const targetId = btn.dataset.dragId!;
            const targetKind = btn.dataset.dragKind as "space" | "folder";
            if (targetId && targetId !== dragState?.id) {
                const rect = btn.getBoundingClientRect();
                const rel = (t.clientY - rect.top) / rect.height;
                let position: "before" | "after" | "into";
                if (
                    isDraggingSpace() &&
                    (targetKind === "space" || targetKind === "folder")
                ) {
                    position =
                        rel < 0.3 ? "before" : rel > 0.7 ? "after" : "into";
                } else {
                    position = rel < 0.5 ? "before" : "after";
                }
                dropTarget = { id: targetId, position };
            }
        } else {
            dropTarget = null;
        }
    }

    function onItemTouchEnd() {
        if (dragTouchTimer) {
            clearTimeout(dragTouchTimer);
            dragTouchTimer = null;
        }
        if (ctxTouchTimer) {
            clearTimeout(ctxTouchTimer);
            ctxTouchTimer = null;
        }
        if (!touchDragActive) return;
        touchDragActive = false;
        touchGhostId = null;
        performDrop();
    }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav
    class="w-[72px] bg-discord-backgroundTertiary flex flex-col items-center py-3 gap-2 overflow-y-auto scrollbar-hide flex-shrink-0"
    ondragover={(e) => e.preventDefault()}
    ondrop={onDrop}
>
    <!-- Home button -->
    <button
        onclick={onHomeClick}
        class="group relative w-12 h-12 flex items-center justify-center transition-all duration-200 flex-shrink-0"
        class:rounded-2xl={roomsState.activeSpaceId !== null}
        class:rounded-xl={roomsState.activeSpaceId === null}
        class:bg-discord-accent={roomsState.activeSpaceId === null}
        class:bg-discord-backgroundSecondary={roomsState.activeSpaceId !== null}
        class:hover:rounded-xl={roomsState.activeSpaceId !== null}
        class:hover:bg-discord-accent={roomsState.activeSpaceId !== null}
        title="Home"
    >
        <svg
            class="w-6 h-6 transition-colors {roomsState.activeSpaceId === null
                ? 'text-white'
                : 'text-discord-textPrimary group-hover:text-white'}"
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
        {#each [getHomeNotifs()] as n}
            {#if roomsState.activeSpaceId === null}
                <div
                    class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-8 bg-discord-textPrimary rounded-r-full"
                ></div>
            {:else if n.unread}
                <div
                    class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 rounded-r-full pointer-events-none {n.loud ||
                    n.highlight
                        ? 'h-4 bg-discord-danger'
                        : 'h-2 bg-discord-textPrimary'}"
                ></div>
            {/if}
        {/each}
    </button>

    <!-- Separator -->
    <div class="w-8 h-px bg-discord-divider my-1 flex-shrink-0"></div>

    <!-- Root items -->
    {#each rootItems as item (item.id)}
        {#if dropTarget?.id === item.id && dropTarget.position === "before"}
            <div
                class="w-10 h-0.5 bg-discord-accent rounded-full flex-shrink-0 -my-0.5 pointer-events-none"
            ></div>
        {/if}

        {#if item.kind === "space"}
            {@const isActive =
                roomsState.activeSpaceId === item.space.roomId ||
                roomsState.spaceDrillParentId === item.space.roomId}
            {@const avatarSrc = getRoomAvatar(item.space)}
            {@const isMergeTarget =
                dropTarget?.id === item.id && dropTarget.position === "into"}
            {@const spaceNotifs = getSpaceNotifs(item.space.roomId)}
            <button
                onclick={() => setActiveSpace(item.space.roomId)}
                oncontextmenu={(e) =>
                    openSpaceContextMenu(e, item.space.roomId)}
                draggable="true"
                ondragstart={(e) => onDragStart(e, item.space.roomId, null)}
                ondragover={(e) => onRootItemDragOver(e, item.id, "space")}
                ondragend={onDragEnd}
                ontouchstart={(e) =>
                    onItemTouchStart(e, item.space.roomId, null, (x, y) =>
                        openSpaceContextMenu(
                            { clientX: x, clientY: y },
                            item.space.roomId,
                        ),
                    )}
                ontouchmove={onItemTouchMove}
                ontouchend={onItemTouchEnd}
                data-drag-id={item.space.roomId}
                data-drag-kind="space"
                class="group relative w-12 h-12 flex items-center justify-center transition-all duration-200 flex-shrink-0"
                class:opacity-40={dragState?.id === item.id}
                class:ring-2={isMergeTarget}
                class:ring-discord-accent={isMergeTarget}
                class:rounded-xl={isMergeTarget}
                title={item.space.name || item.space.roomId}
            >
                <Avatar
                    src={avatarSrc}
                    name={item.space.name || "?"}
                    size={48}
                    rounded="none"
                    class="{isActive
                        ? 'rounded-xl'
                        : isMergeTarget
                          ? 'rounded-xl'
                          : 'rounded-2xl group-hover:rounded-xl'} transition-all duration-200"
                />
                {#if isActive}
                    <div
                        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-8 bg-discord-textPrimary rounded-r-full"
                    ></div>
                {:else if spaceNotifs.unread}
                    <div
                        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 rounded-r-full pointer-events-none {spaceNotifs.loud ||
                        spaceNotifs.highlight
                            ? 'h-4 bg-discord-danger'
                            : 'h-2 bg-discord-textPrimary'}"
                    ></div>
                {:else}
                    <div
                        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-2 bg-discord-textPrimary rounded-r-full opacity-0 group-hover:opacity-100 group-hover:h-5 transition-all duration-200"
                    ></div>
                {/if}
            </button>
        {:else}
            {@const isExpanded = expandedFolders.has(item.id)}
            {@const folderHasActive = item.spaces.some(
                (s) => s.roomId === roomsState.activeSpaceId,
            )}
            {@const folderColor =
                roomsState.spaceLayout.folders[item.id]?.color}
            {@const isIntoTarget =
                dropTarget?.id === item.id && dropTarget.position === "into"}
            {@const folderNotifs = item.spaces.reduce(
                (acc, s) => {
                    const n = getSpaceNotifs(s.roomId);
                    return {
                        unread: acc.unread || n.unread,
                        highlight: acc.highlight || n.highlight,
                        loud: acc.loud || n.loud,
                    };
                },
                { unread: false, highlight: false, loud: false },
            )}
            <div
                class="flex flex-col items-center gap-1 flex-shrink-0"
                class:opacity-40={dragState?.id === item.id}
            >
                <button
                    onclick={() => toggleFolder(item.id)}
                    oncontextmenu={(e) => openFolderContextMenu(e, item.id)}
                    draggable="true"
                    ondragstart={(e) => onDragStart(e, item.id, null)}
                    ondragover={(e) => onRootItemDragOver(e, item.id, "folder")}
                    ondragend={onDragEnd}
                    ontouchstart={(e) =>
                        onItemTouchStart(e, item.id, null, (x, y) =>
                            openFolderContextMenu(
                                { clientX: x, clientY: y },
                                item.id,
                            ),
                        )}
                    ontouchmove={onItemTouchMove}
                    ontouchend={onItemTouchEnd}
                    data-drag-id={item.id}
                    data-drag-kind="folder"
                    class="group relative w-12 h-12 flex items-center justify-center flex-shrink-0"
                    class:ring-2={isIntoTarget}
                    class:ring-discord-accent={isIntoTarget}
                    class:rounded-xl={isIntoTarget}
                >
                    <div
                        class="w-11 h-11 {isExpanded || isIntoTarget
                            ? 'rounded-xl'
                            : 'rounded-2xl'} group-hover:rounded-xl overflow-hidden transition-all duration-200"
                        style="display: grid; grid-template-columns: repeat({Math.min(
                            item.spaces.length,
                            2,
                        )}, 1fr); grid-template-rows: repeat({item.spaces
                            .length > 2
                            ? 2
                            : 1}, 1fr); gap: 2px; padding: 6px; background-color: {folderColor ??
                            'var(--discord-backgroundSecondary)'};"
                    >
                        {#each item.spaces.slice(0, 4) as space}
                            <div class="rounded-sm overflow-hidden">
                                <Avatar
                                    src={getRoomAvatar(space)}
                                    name={space.name || "?"}
                                    size={16}
                                    rounded="none"
                                    class="w-full h-full"
                                />
                            </div>
                        {/each}
                        {#if item.spaces.length === 0}
                            <div
                                style="grid-column: span 2; grid-row: span 2;"
                                class="flex items-center justify-center"
                            >
                                <svg
                                    class="w-4 h-4 text-discord-textMuted"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                                    />
                                </svg>
                            </div>
                        {/if}
                    </div>
                    {#if folderHasActive && !isExpanded}
                        <div
                            class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-8 bg-discord-textPrimary rounded-r-full"
                        ></div>
                    {:else if folderNotifs.unread && !isExpanded}
                        <div
                            class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 rounded-r-full pointer-events-none {folderNotifs.loud ||
                            folderNotifs.highlight
                                ? 'h-4 bg-discord-danger'
                                : 'h-2 bg-discord-textPrimary'}"
                        ></div>
                    {:else if !isExpanded}
                        <div
                            class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-2 bg-discord-textPrimary rounded-r-full opacity-0 group-hover:opacity-100 group-hover:h-5 transition-all duration-200"
                        ></div>
                    {/if}
                </button>

                {#if isExpanded}
                    <div
                        class="flex flex-col items-center gap-1 bg-discord-backgroundSecondary/50 rounded-xl px-1 py-1 w-12"
                    >
                        {#each item.spaces as space (space.roomId)}
                            {#if dropTarget?.id === space.roomId && dropTarget.position === "before"}
                                <div
                                    class="w-8 h-0.5 bg-discord-accent rounded-full pointer-events-none -my-0.5"
                                ></div>
                            {/if}
                            {@const isActive =
                                roomsState.activeSpaceId === space.roomId}
                            {@const isn = getSpaceNotifs(space.roomId)}
                            <button
                                onclick={() => setActiveSpace(space.roomId)}
                                oncontextmenu={(e) =>
                                    openSpaceContextMenu(
                                        e,
                                        space.roomId,
                                        item.id,
                                    )}
                                draggable="true"
                                ondragstart={(e) =>
                                    onDragStart(e, space.roomId, item.id)}
                                ondragover={(e) =>
                                    onFolderSpaceDragOver(e, space.roomId)}
                                ontouchstart={(e) =>
                                    onItemTouchStart(
                                        e,
                                        space.roomId,
                                        item.id,
                                        (x, y) =>
                                            openSpaceContextMenu(
                                                { clientX: x, clientY: y },
                                                space.roomId,
                                                item.id,
                                            ),
                                    )}
                                ontouchmove={onItemTouchMove}
                                ontouchend={onItemTouchEnd}
                                data-drag-id={space.roomId}
                                data-drag-kind="space"
                                ondragend={onDragEnd}
                                class="group relative w-9 h-9 flex items-center justify-center transition-all duration-200 flex-shrink-0"
                                class:opacity-40={dragState?.id ===
                                    space.roomId}
                                title={space.name || space.roomId}
                            >
                                <Avatar
                                    src={getRoomAvatar(space)}
                                    name={space.name || "?"}
                                    size={36}
                                    rounded="none"
                                    class="{isActive
                                        ? 'rounded-lg'
                                        : 'rounded-2xl group-hover:rounded-lg'} transition-all duration-200"
                                />
                                {#if isActive}
                                    <div
                                        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-6 bg-discord-textPrimary rounded-r-full"
                                    ></div>
                                {:else if isn.unread}
                                    <div
                                        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 rounded-r-full pointer-events-none {isn.loud ||
                                        isn.highlight
                                            ? 'h-3 bg-discord-danger'
                                            : 'h-1.5 bg-discord-textPrimary'}"
                                    ></div>
                                {:else}
                                    <div
                                        class="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-1 h-2 bg-discord-textPrimary rounded-r-full opacity-0 group-hover:opacity-100 group-hover:h-4 transition-all duration-200"
                                    ></div>
                                {/if}
                            </button>
                            {#if dropTarget?.id === space.roomId && dropTarget.position === "after"}
                                <div
                                    class="w-8 h-0.5 bg-discord-accent rounded-full pointer-events-none -my-0.5"
                                ></div>
                            {/if}
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}

        {#if dropTarget?.id === item.id && dropTarget.position === "after"}
            <div
                class="w-10 h-0.5 bg-discord-accent rounded-full flex-shrink-0 -my-0.5 pointer-events-none"
            ></div>
        {/if}
    {/each}

    {#if roomsState.spaces.length > 0}
        <div class="w-8 h-px bg-discord-divider my-1 flex-shrink-0"></div>
    {/if}

    <!-- Explore public rooms -->
    <button
        onclick={openExplore}
        class="group w-12 h-12 rounded-2xl flex items-center justify-center bg-discord-backgroundSecondary hover:rounded-xl hover:bg-discord-textPositive transition-all duration-200 flex-shrink-0"
        title="Explore rooms"
    >
        <svg
            class="w-6 h-6 text-discord-textPositive group-hover:text-white transition-colors"
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19zM12 10.9a1.1 1.1 0 100 2.2 1.1 1.1 0 000-2.2z"
            />
        </svg>
    </button>

    <!-- Color picker dialog -->
    {#if colorPicker}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onclick={(e) => {
                if (e.target === e.currentTarget) closeModal();
            }}
        >
            <div
                class="bg-discord-backgroundSecondary rounded-xl shadow-2xl p-4 flex flex-col gap-3"
                style="width: 240px;"
            >
                <p class="text-sm font-semibold text-discord-textPrimary">
                    Folder Color
                </p>

                <!-- SV box + hue slider -->
                <div class="flex gap-2" style="height: 148px;">
                    <!-- Saturation/Value gradient box -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        bind:this={svBoxEl}
                        class="relative flex-1 rounded-lg overflow-hidden cursor-crosshair select-none"
                        style="background: linear-gradient(to right, white, hsl({cpHue}, 100%, 50%));"
                        onmousedown={startSVDrag}
                    >
                        <!-- Black-to-transparent overlay -->
                        <div
                            class="absolute inset-0"
                            style="background: linear-gradient(to bottom, transparent, black);"
                        ></div>
                        <!-- Cursor -->
                        <div
                            class="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
                            style="left: {cpSat * 100}%; top: {(1 - cpVal) *
                                100}%; box-shadow: 0 0 0 1px rgba(0,0,0,0.4);"
                        ></div>
                    </div>

                    <!-- Hue slider -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        bind:this={hueSliderEl}
                        class="relative w-4 rounded-lg overflow-hidden cursor-ns-resize select-none flex-shrink-0"
                        style="background: linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);"
                        onmousedown={startHueDrag}
                    >
                        <!-- Cursor bar -->
                        <div
                            class="absolute left-0 right-0 h-1 -translate-y-1/2 pointer-events-none rounded-sm"
                            style="top: {(cpHue / 360) *
                                100}%; box-shadow: 0 0 0 1.5px white, 0 0 0 2.5px rgba(0,0,0,0.5);"
                        ></div>
                    </div>
                </div>

                <!-- Presets -->
                <div class="flex gap-1.5">
                    {#each FOLDER_COLORS as color}
                        <!-- svelte-ignore a11y_consider_explicit_label -->
                        <button
                            onclick={() => setHsvFromHex(color)}
                            class="flex-1 h-5 rounded transition-all duration-100"
                            style="background-color: {color}; outline: {Math.abs(
                                cpHue - hexToHsv(color)[0],
                            ) < 2 &&
                            Math.abs(cpSat - hexToHsv(color)[1]) < 0.05 &&
                            Math.abs(cpVal - hexToHsv(color)[2]) < 0.05
                                ? '2px solid white'
                                : 'none'};"
                        ></button>
                    {/each}
                </div>

                <!-- Hex input -->
                <div class="flex items-center gap-2">
                    <div
                        class="w-7 h-7 rounded flex-shrink-0"
                        style="background-color: {cpHex};"
                    ></div>
                    <input
                        class="flex-1 bg-discord-backgroundTertiary text-discord-textPrimary text-sm font-mono px-2 py-1.5 rounded outline-none border border-discord-divider focus:border-discord-accent uppercase tracking-wider"
                        value={cpHex}
                        maxlength={7}
                        oninput={(e) =>
                            setHsvFromHex((e.target as HTMLInputElement).value)}
                    />
                </div>

                <!-- Actions -->
                <div class="flex gap-2">
                    <button
                        onclick={commitColor}
                        class="flex-1 py-1.5 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors"
                        >Save</button
                    >
                    <button
                        onclick={closeModal}
                        class="flex-1 py-1.5 rounded text-sm font-semibold bg-discord-backgroundTertiary hover:bg-discord-messageHover text-discord-textPrimary transition-colors"
                        >Cancel</button
                    >
                </div>
            </div>
        </div>
    {/if}

    <!-- Touch drag ghost -->
    {#if touchDragActive && touchGhostId}
        {@const ghostSpace = roomsState.spaces.find(
            (s) => s.roomId === touchGhostId,
        )}
        <div
            class="fixed z-[100] pointer-events-none w-12 h-12 rounded-xl shadow-2xl opacity-90"
            style="left: {touchGhostX - 24}px; top: {touchGhostY -
                24}px; transform: scale(1.15);"
        >
            {#if ghostSpace}
                <Avatar
                    src={getRoomAvatar(ghostSpace)}
                    name={ghostSpace.name || "?"}
                    size={48}
                    rounded="none"
                    class="rounded-xl w-full h-full"
                />
            {:else}
                <div
                    class="w-12 h-12 rounded-xl bg-discord-backgroundSecondary flex items-center justify-center"
                >
                    <svg
                        class="w-6 h-6 text-discord-textMuted"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                        />
                    </svg>
                </div>
            {/if}
        </div>
    {/if}

    <!-- Create room in space modal -->
    {#if createRoomModal}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onclick={closeModal}
        >
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="bg-discord-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => {
                    if (e.key === "Enter") submitCreateRoom();
                }}
            >
                <h2 class="text-lg font-bold text-discord-textPrimary">
                    Create room in space
                </h2>
                <div class="flex flex-col gap-3">
                    <div>
                        <label
                            for="create-room-name"
                            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                            >Room name</label
                        >
                        <input
                            id="create-room-name"
                            bind:value={modalInput1}
                            placeholder="my-room"
                            class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
                        />
                    </div>
                    <div>
                        <label
                            for="create-room-topic"
                            class="block text-xs font-semibold text-discord-textMuted uppercase tracking-wide mb-1.5"
                            >Topic <span class="normal-case font-normal"
                                >(optional)</span
                            ></label
                        >
                        <input
                            id="create-room-topic"
                            bind:value={modalInput2}
                            placeholder="What's this room about?"
                            class="w-full px-3 py-2 bg-discord-backgroundSecondary text-discord-textPrimary placeholder-discord-textMuted rounded border border-discord-divider focus:border-discord-accent focus:outline-none text-sm"
                        />
                    </div>
                </div>
                {#if modalError}<p class="text-sm text-discord-error">
                        {modalError}
                    </p>{/if}
                <div class="flex justify-end gap-2 mt-1">
                    <button
                        onclick={closeModal}
                        disabled={modalLoading}
                        class="px-4 py-2 rounded text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors disabled:opacity-50"
                        >Cancel</button
                    >
                    <button
                        onclick={submitCreateRoom}
                        disabled={modalLoading || !modalInput1.trim()}
                        class="px-4 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {#if modalLoading}<div
                                class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                            ></div>{/if}
                        Create
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Add existing room to space modal -->
    {#if addRoomModal}
        {@const candidates = getRoomsNotInSpace(addRoomModal.spaceId)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onclick={closeModal}
        >
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="bg-discord-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4"
                onclick={(e) => e.stopPropagation()}
            >
                <h2 class="text-lg font-bold text-discord-textPrimary">
                    Add existing room to space
                </h2>
                {#if candidates.length === 0}
                    <p class="text-sm text-discord-textMuted">
                        No rooms available to add.
                    </p>
                {:else}
                    <div class="flex flex-col gap-1 max-h-72 overflow-y-auto">
                        {#each candidates as room}
                            <button
                                onclick={() => submitAddRoom(room.roomId)}
                                class="w-full text-left px-3 py-2 rounded text-sm text-discord-textSecondary hover:bg-discord-messageHover hover:text-discord-textPrimary transition-colors flex items-center gap-2"
                            >
                                <Avatar
                                    src={getRoomAvatar(room)}
                                    name={getRoomDisplayName(room)}
                                    size={24}
                                    rounded="none"
                                    class="rounded flex-shrink-0"
                                />
                                <span class="truncate"
                                    >{getRoomDisplayName(room)}</span
                                >
                            </button>
                        {/each}
                    </div>
                {/if}
                <div class="flex justify-end">
                    <button
                        onclick={closeModal}
                        class="px-4 py-2 rounded text-sm font-medium text-discord-textMuted hover:text-discord-textPrimary hover:bg-discord-messageHover transition-colors"
                        >Cancel</button
                    >
                </div>
            </div>
        </div>
    {/if}

    <!-- Explore rooms modal -->
    {#if exploreOpen}
        <RoomDirectory />
    {/if}

    <!-- Settings button -->
    <button
        onclick={onSettingsClick}
        class="group w-12 h-12 rounded-2xl flex items-center justify-center bg-discord-backgroundSecondary hover:rounded-xl hover:bg-discord-textPositive transition-all duration-200 flex-shrink-0 mt-auto"
        title="Settings"
    >
        <svg
            class="w-6 h-6 text-discord-textSecondary group-hover:text-white transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
        </svg>
    </button>
</nav>

<Portal>
    {#if contextMenu}
        {@const cm = contextMenu}
        <button
            type="button"
            aria-label="Close menu"
            class="fixed inset-0 z-50 {cm.touch ? 'bg-black/40' : ''}"
            onclick={closeModal}
        ></button>
        {#snippet menuContent()}
            {#if cm.kind === "space"}
                <button
                    onclick={() => handleOpenSpaceSettings(cm.spaceId)}
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                    >Space Settings</button
                >
                {#if (void roomsState.roomsTick, canInviteToRoom(cm.spaceId))}
                    <button
                        onclick={() => handleInviteToSpace(cm.spaceId)}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                        >Invite People</button
                    >
                {/if}
                <button
                    onclick={() => handleCopySpaceLink(cm.spaceId)}
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                    >Copy Space Link</button
                >
                <button
                    onclick={() => handleMarkSpaceRead(cm.spaceId)}
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                    >Mark as Read</button
                >
                <div class="w-full h-px bg-discord-divider my-1"></div>
                {@const currentNotif = getRoomNotificationSetting(cm.spaceId)}
                <p
                    class="px-3 py-1 text-xs text-discord-textMuted uppercase font-semibold tracking-wide"
                >
                    Notifications
                </p>
                {#each [["default", "Default"], ["all", "All Messages"], ["mentions", "Mentions Only"], ["mute", "Mute"]] as const as [val, label]}
                    <button
                        onclick={() =>
                            handleSetSpaceNotification(
                                cm.spaceId,
                                val as RoomNotificationSetting,
                            )}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                    >
                        <span class="w-3 text-center text-xs"
                            >{currentNotif === val ? "●" : ""}</span
                        >
                        {label}
                    </button>
                {/each}
                {#if canAddRoomToSpace(cm.spaceId)}
                    <div class="w-full h-px bg-discord-divider my-1"></div>
                    <button
                        onclick={() => openCreateRoom(cm.spaceId)}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                        >Create Room</button
                    >
                    <button
                        onclick={() => openAddRoom(cm.spaceId)}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                        >Add Existing Room</button
                    >
                {/if}
                <div class="w-full h-px bg-discord-divider my-1"></div>
                {#if cm.folderId}
                    <button
                        onclick={() =>
                            handleRemoveFromFolder(cm.spaceId, cm.folderId!)}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                        >Remove from folder</button
                    >
                    <div class="w-full h-px bg-discord-divider my-1"></div>
                {:else}
                    <button
                        onclick={() => handleNewFolder(cm.spaceId)}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                        >New Folder</button
                    >
                    <div class="w-full h-px bg-discord-divider my-1"></div>
                {/if}
                {#if leaveConfirmId === cm.spaceId}
                    <button
                        onclick={() => handleLeaveSpace(cm.spaceId)}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm bg-discord-danger text-white font-medium text-left"
                        >Click again to leave</button
                    >
                {:else}
                    <button
                        onclick={() => (leaveConfirmId = cm.spaceId)}
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white text-left"
                        >Leave Space</button
                    >
                {/if}
            {:else if cm.kind === "folder"}
                <button
                    onclick={() => openColorPicker(cm.folderId)}
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-textPrimary hover:bg-discord-accent hover:text-white text-left"
                    >Set Color</button
                >
                <div class="w-full h-px bg-discord-divider my-1"></div>
                <button
                    onclick={() => handleDissolveFolder(cm.folderId)}
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-discord-danger hover:bg-discord-danger hover:text-white text-left"
                    >Dissolve Folder</button
                >
            {/if}
        {/snippet}
        {#if cm.touch}
            <div
                use:focusTrap={{ onEscape: closeModal }}
                class="fixed bottom-0 left-0 right-0 z-50 bg-discord-backgroundTertiary border-t border-discord-divider rounded-t-2xl shadow-2xl pb-safe pt-2 max-h-[70vh] overflow-y-auto"
            >
                <div
                    class="w-10 h-1 bg-discord-divider rounded-full mx-auto mb-2"
                ></div>
                {@render menuContent()}
            </div>
        {:else}
            <div
                use:positionMenu={{ x: cm.x, y: cm.y }}
                use:focusTrap={{ onEscape: closeModal }}
                class="fixed z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-40 overflow-y-auto"
            >
                {@render menuContent()}
            </div>
        {/if}
    {/if}
</Portal>
