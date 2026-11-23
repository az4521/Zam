<script lang="ts">
    import { t } from "$lib/i18n";
    import { untrack } from "svelte";
    import type { Room } from "matrix-js-sdk";
    import { interfaceState, openModal } from "$lib/stores/interface.svelte";
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
    import WidgetFrame, {
        templatedWidgetUrl,
    } from "$lib/components/layout/WidgetFrame.svelte";
    import AddWidgetDialog from "$lib/components/layout/AddWidgetDialog.svelte";
    import { ArrowLeft, ExternalLink, Plus, Trash2 } from "lucide-svelte";

    // The room's widgets, in the right-hand panel. The list and the open
    // widget share this panel: the open one is tracked in widgetsState, so
    // Back returns to the list and the frame unmounts when the panel closes.
    interface Props {
        room: Room;
        onClose: () => void;
    }

    let { room, onClose }: Props = $props();

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
    class="{interfaceState.isMobile
        ? ''
        : 'w-[28rem] max-w-[60vw]'} h-full flex flex-col bg-zam-backgroundSecondary border-l border-zam-divider"
>
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
    </div>

    <div class="flex-1 min-h-0 flex flex-col overflow-y-auto">
        {#if activeWidget}
            {#key activeWidget.id}
                <WidgetFrame {room} widget={activeWidget} />
            {/key}
        {:else if widgets.length === 0}
            <p class="text-sm text-zam-textMuted text-center mt-8 px-4">
                {t("widgets.empty")}
            </p>
        {:else}
            <ul class="p-2 space-y-1">
                {#each widgets as w (w.id)}
                    <li>
                        <button
                            type="button"
                            onclick={() => setActiveWidget(room.roomId, w.id)}
                            class="w-full text-start p-2 rounded-lg hover:bg-zam-messageHover transition-colors"
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
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>

{#if adding && interfaceState.modal === "add-widget"}
    <AddWidgetDialog roomId={room.roomId} />
{/if}
