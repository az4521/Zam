<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import {
        interfaceState,
        openModal,
        showCallView,
    } from "$lib/stores/interface.svelte";
    import {
        voiceCallState,
        openCallWidget,
        closeCallWidget,
    } from "$lib/stores/voiceCall.svelte";
    import {
        widgetsState,
        bumpWidgetsTick,
        setActiveWidget,
    } from "$lib/stores/widgets.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import { showErrorToast } from "$lib/stores/toasts.svelte";
    import {
        listRoomWidgets,
        onRoomWidgetsChange,
        canManageWidgets,
        removeRoomWidget,
    } from "$lib/matrix/widgetHost";
    import { widgetOrigin, type RoomWidget } from "$lib/utils/widgets";
    import { matrixErrorMessage } from "$lib/utils/knock";
    import WidgetFrame from "$lib/components/layout/WidgetFrame.svelte";
    import { templatedWidgetUrl } from "$lib/stores/widgetBridge";
    import AddWidgetDialog from "$lib/components/layout/AddWidgetDialog.svelte";
    import { auth } from "$lib/stores/auth.svelte";
    import { readScoped, writeScoped } from "$lib/utils/scopedStorage";
    import {
        WIDGETS_PANEL_DEFAULT_W,
        WIDGETS_PANEL_MIN_W,
        clampWidgetsPanelWidth,
        parseStoredWidgetsPanelWidth,
        widgetsPanelMaxWidth,
    } from "$lib/utils/widgetsPanelWidth";
    import {
        ArrowLeft,
        ExternalLink,
        LayoutGrid,
        Plus,
        Trash2,
        X,
    } from "lucide-svelte";

    // The room's widgets, in the right-hand panel. The list and the open
    // widget share this panel: the open one is tracked in widgetsState, so
    // Back returns to the list and the frame unmounts when the panel closes.
    interface Props {
        room: Room;
        onClose: () => void;
    }

    let { room, onClose }: Props = $props();

    // Desktop width. The panel is resized from its left edge and the width is
    // kept per account. On mobile the panel is a full-screen view (MessageArea
    // sizes it), so the width is not used there.
    const WIDTH_KEY = "layout.widgetsPanelWidth";
    let width = $state(
        parseStoredWidgetsPanelWidth(readScoped(WIDTH_KEY, auth.userId)) ??
            WIDGETS_PANEL_DEFAULT_W,
    );
    // The room column this panel sits in (timeline plus panel). Its width caps
    // the panel so the timeline keeps its minimum. The panel's parent is that
    // column, so it is measured there and kept current with a ResizeObserver.
    let rootEl = $state<HTMLDivElement | undefined>();
    let columnWidth = $state(0);
    $effect(() => {
        // Skip `display: contents` wrappers: they have no box, so their
        // width reads 0 and the cap fell back to the whole window.
        let column = rootEl?.parentElement ?? null;
        while (column && getComputedStyle(column).display === "contents")
            column = column.parentElement;
        if (!column || interfaceState.isMobile) return;
        columnWidth = column.clientWidth;
        const measured = column;
        const ro = new ResizeObserver(() => {
            columnWidth = measured.clientWidth;
        });
        ro.observe(column);
        return () => ro.disconnect();
    });
    const columnOrViewport = () => columnWidth || window.innerWidth;
    const maxWidth = $derived(widgetsPanelMaxWidth(columnOrViewport()));
    const shownWidth = $derived(
        clampWidgetsPanelWidth(width, columnOrViewport()),
    );

    function saveWidth() {
        writeScoped(WIDTH_KEY, auth.userId, String(width));
    }

    // True while a drag is in progress. An overlay then covers the widget
    // iframes, which would otherwise take the pointer and end the drag.
    let resizing = $state(false);

    function startResize(e: PointerEvent) {
        if (e.button !== 0) return;
        e.preventDefault();
        const grip = e.currentTarget as HTMLElement;
        // Capture keeps the moves on the grip even when the pointer crosses
        // the iframe, which would otherwise receive them.
        grip.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startW = shownWidth;
        resizing = true;
        const move = (ev: PointerEvent) => {
            // The grip is on the left edge, so dragging left widens the panel.
            width = clampWidgetsPanelWidth(
                startW + startX - ev.clientX,
                columnOrViewport(),
            );
        };
        const up = () => {
            grip.removeEventListener("pointermove", move);
            grip.removeEventListener("pointerup", up);
            grip.removeEventListener("pointercancel", up);
            resizing = false;
            saveWidth();
        };
        grip.addEventListener("pointermove", move);
        grip.addEventListener("pointerup", up);
        grip.addEventListener("pointercancel", up);
    }

    function onResizeKey(e: KeyboardEvent) {
        const step = e.shiftKey ? 96 : 24;
        if (e.key === "ArrowLeft")
            width = clampWidgetsPanelWidth(
                shownWidth + step,
                columnOrViewport(),
            );
        else if (e.key === "ArrowRight")
            width = clampWidgetsPanelWidth(
                shownWidth - step,
                columnOrViewport(),
            );
        else return;
        e.preventDefault();
        saveWidth();
    }

    function resetWidth() {
        width = WIDGETS_PANEL_DEFAULT_W;
        saveWidth();
    }

    // Re-derive when the widget state event changes (bumpWidgetsTick) or the
    // room's power levels do (roomsTick, for the manage actions).
    const widgets = $derived.by(() => {
        void widgetsState.tick;
        return listRoomWidgets(room.roomId);
    });
    const canManage = $derived.by(() => {
        void roomsState.roomsTick;
        return canManageWidgets(room.roomId);
    });

    // The widget open in this room. A selection from another room is ignored.
    const activeWidget = $derived.by((): RoomWidget | null => {
        if (widgetsState.activeRoomId !== room.roomId) return null;
        const id = widgetsState.activeWidgetId;
        if (!id) return null;
        return widgets.find((w) => w.id === id) ?? null;
    });

    // A room with exactly one widget opens it straight away: a list of one is
    // a click the user should not have to make.
    $effect(() => {
        const only = widgets.length === 1 ? widgets[0] : null;
        if (!only) return;
        if (activeWidget?.id === only.id) return;
        untrack(() => setActiveWidget(room.roomId, only.id));
    });

    // Live updates while the panel is open. Leaving the room (or closing the
    // panel) drops the selection, so reopening starts from the list.
    $effect(() => {
        const rid = room.roomId;
        const unsub = onRoomWidgetsChange(rid, bumpWidgetsTick);
        return () => {
            unsub();
            if (widgetsState.activeRoomId === rid) setActiveWidget(null, null);
        };
    });

    let confirmingRemove = $state(false);
    let removing = $state(false);

    // Clearing the confirm step when the selection changes keeps it from
    // carrying over to a different widget.
    $effect(() => {
        void activeWidget?.id;
        untrack(() => (confirmingRemove = false));
    });

    const openUrl = $derived(
        activeWidget ? templatedWidgetUrl(room.roomId, activeWidget) : null,
    );

    // Widgets can also be tiles in this room's call. Only while that call is
    // running here. A widget shown in the call is never mounted twice, so the
    // panel offers to close it there instead of showing a second frame.
    const inThisRoomCall = $derived(voiceCallState.roomId === room.roomId);
    const inCallHere = $derived(
        inThisRoomCall &&
            activeWidget !== null &&
            voiceCallState.callWidgetIds.includes(activeWidget.id),
    );
    function openInCall(id: string) {
        openCallWidget(id);
        showCallView(room.roomId);
    }

    async function removeActive(w: RoomWidget) {
        if (removing) return;
        removing = true;
        try {
            await removeRoomWidget(room.roomId, w);
            setActiveWidget(null, null);
        } catch (err) {
            showErrorToast(matrixErrorMessage(err, t("widgets.removeFailed")));
        } finally {
            removing = false;
            confirmingRemove = false;
        }
    }

    let adding = $state(false);
    function openAddDialog() {
        openModal("add-widget", () => {
            adding = false;
        });
        adding = true;
    }
</script>

<div
    bind:this={rootEl}
    style={interfaceState.isMobile ? undefined : `width: ${shownWidth}px;`}
    class="{interfaceState.isMobile
        ? ''
        : 'relative flex-shrink-0 border-l border-zam-divider'} h-full flex flex-col bg-zam-backgroundSecondary"
>
    {#if !interfaceState.isMobile}
        <!-- Resize grip on the left edge. A focusable separator is the ARIA
             window-splitter pattern, as on the room list. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("widgets.resizePanel")}
            aria-valuenow={shownWidth}
            aria-valuemin={WIDGETS_PANEL_MIN_W}
            aria-valuemax={maxWidth}
            tabindex="0"
            title={t("widgets.resizePanel")}
            class="absolute inset-y-0 -left-1 w-2 z-20 cursor-col-resize touch-none hover:bg-zam-accent/40 focus-visible:bg-zam-accent/40 transition-colors"
            onpointerdown={startResize}
            ondblclick={resetWidth}
            onkeydown={onResizeKey}
        ></div>
    {/if}
    <div
        class="h-12 flex items-center gap-2 px-4 py-3 border-b border-zam-divider flex-shrink-0"
    >
        {#if activeWidget}
            {#if widgets.length > 1}
                <button
                    type="button"
                    onclick={() => setActiveWidget(null, null)}
                    class="p-1 rounded text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover"
                    title={t("widgets.back")}
                    aria-label={t("widgets.back")}
                >
                    <ArrowLeft size={16} />
                </button>
            {/if}
            <h3
                class="text-xs font-semibold text-zam-textPrimary truncate flex-1 min-w-0"
            >
                {activeWidget.name}
            </h3>
            {#if inThisRoomCall && !inCallHere && activeWidget}
                <button
                    type="button"
                    onclick={() => openInCall(activeWidget!.id)}
                    class="p-1 rounded text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover"
                    title={t("callView.openInCall")}
                    aria-label={t("callView.openInCall")}
                >
                    <LayoutGrid size={16} />
                </button>
            {/if}
            {#if openUrl}
                <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-1 rounded text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover"
                    title={t("widgets.openInBrowser")}
                    aria-label={t("widgets.openInBrowser")}
                >
                    <ExternalLink size={16} />
                </a>
            {/if}
            {#if canManage}
                {#if confirmingRemove}
                    <button
                        type="button"
                        disabled={removing}
                        onclick={() => removeActive(activeWidget!)}
                        class="rounded px-2 py-1 text-xs font-medium text-zam-danger hover:underline disabled:opacity-50"
                    >
                        {t("widgets.confirmRemoveButton")}
                    </button>
                    <button
                        type="button"
                        onclick={() => (confirmingRemove = false)}
                        class="rounded px-2 py-1 text-xs font-medium text-zam-textPrimary hover:underline"
                    >
                        {t("common.cancel")}
                    </button>
                {:else}
                    <button
                        type="button"
                        onclick={() => (confirmingRemove = true)}
                        class="p-1 rounded text-zam-textMuted hover:text-zam-danger hover:bg-zam-messageHover"
                        title={t("widgets.remove")}
                        aria-label={t("widgets.remove")}
                    >
                        <Trash2 size={16} />
                    </button>
                {/if}
            {/if}
        {:else}
            <h3
                class="text-xs font-semibold text-zam-textMuted uppercase tracking-wide flex-1"
            >
                {t("widgets.panelTitle")}
            </h3>
            {#if canManage}
                <button
                    type="button"
                    onclick={openAddDialog}
                    class="p-1 rounded text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover"
                    title={t("widgets.add")}
                    aria-label={t("widgets.add")}
                >
                    <Plus size={16} />
                </button>
            {/if}
        {/if}
        {#if interfaceState.isMobile}
            <!-- Full-screen on mobile: the close control is the way out (the
                 Android back button and Escape also close it). -->
            <button
                type="button"
                onclick={onClose}
                class="p-1 rounded text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover flex-shrink-0"
                title={t("widgets.close")}
                aria-label={t("widgets.close")}
            >
                <X size={20} />
            </button>
        {/if}
    </div>

    <div class="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {#if activeWidget}
            {#key activeWidget.id}
                {#if inCallHere}
                    <div
                        class="p-4 flex flex-col items-center gap-3 text-center"
                    >
                        <p class="text-sm text-zam-textMuted">
                            {t("callView.widgetInCall")}
                        </p>
                        <button
                            type="button"
                            onclick={() =>
                                activeWidget &&
                                closeCallWidget(activeWidget.id)}
                            class="rounded px-4 py-2 text-sm font-medium text-zam-accent hover:underline"
                        >
                            {t("callView.showWidgetHere")}
                        </button>
                    </div>
                {:else}
                    <WidgetFrame {room} widget={activeWidget} />
                {/if}
            {/key}
        {:else if widgets.length === 0}
            <p class="text-sm text-zam-textMuted text-center mt-8 px-4">
                {t("widgets.empty")}
            </p>
        {:else}
            <ul class="p-2 space-y-1">
                {#each widgets as w (w.id)}
                    <li class="flex items-center gap-1">
                        <button
                            type="button"
                            onclick={() => setActiveWidget(room.roomId, w.id)}
                            class="flex-1 min-w-0 text-start p-2 rounded-lg hover:bg-zam-messageHover transition-colors"
                        >
                            <span
                                class="block text-sm font-semibold text-zam-textPrimary truncate"
                                >{w.name}</span
                            >
                            <span
                                class="block text-xs text-zam-textMuted truncate"
                                >{widgetOrigin(w.url) ?? w.url}</span
                            >
                        </button>
                        {#if inThisRoomCall && !voiceCallState.callWidgetIds.includes(w.id)}
                            <button
                                type="button"
                                onclick={() => openInCall(w.id)}
                                class="p-2 rounded-lg text-zam-textMuted hover:text-zam-textPrimary hover:bg-zam-messageHover"
                                title={t("callView.openInCall")}
                                aria-label={t("callView.openInCall")}
                            >
                                <LayoutGrid size={16} />
                            </button>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>

{#if resizing}
    <!-- Covers the widget iframes for the length of a width drag. -->
    <div class="fixed inset-0 z-50 cursor-col-resize" aria-hidden="true"></div>
{/if}

{#if adding && interfaceState.modal === "add-widget"}
    <AddWidgetDialog roomId={room.roomId} />
{/if}
