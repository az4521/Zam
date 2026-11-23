<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Room } from "matrix-js-sdk";
    import { Check, LayoutGrid } from "lucide-svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import { scale } from "svelte/transition";
    import { motionOK } from "$lib/utils/motionPreference";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { dismissOnOutsidePointer } from "$lib/actions/dismissOnOutsidePointer";
    import { interfaceState } from "$lib/stores/interface.svelte";
    import { roomsState } from "$lib/stores/rooms.svelte";
    import {
        voiceCallState,
        toggleCallWidget,
    } from "$lib/stores/voiceCall.svelte";
    import {
        canManageWidgets,
        listRoomWidgets,
        onRoomWidgetsChange,
    } from "$lib/matrix/widgetHost";
    import { widgetOrigin } from "$lib/utils/widgets";

    // Call-controls button: lists the room's widgets and opens or closes each
    // as a tile in this call. Hidden when the room has no widgets and the user
    // cannot add any.
    interface Props {
        room: Room;
        buttonClass: string;
        idleClass: string;
    }
    let { room, buttonClass, idleClass }: Props = $props();

    let tick = $state(0);
    $effect(() => {
        const rid = room.roomId;
        return onRoomWidgetsChange(rid, () => {
            tick++;
        });
    });

    const widgets = $derived.by(() => {
        void tick;
        void roomsState.roomsTick;
        return listRoomWidgets(room.roomId);
    });
    const canManage = $derived.by(() => {
        void roomsState.roomsTick;
        return canManageWidgets(room.roomId);
    });
    const visible = $derived(widgets.length > 0 || canManage);
    const openIds = $derived(
        new Set(
            voiceCallState.roomId === room.roomId
                ? voiceCallState.callWidgetIds
                : [],
        ),
    );

    let anchor = $state<{ x: number; y: number } | null>(null);
    let closedAt = 0;

    function close(): void {
        anchor = null;
        closedAt = performance.now();
    }

    function toggle(e: MouseEvent): void {
        e.stopPropagation();
        if (anchor) return close();
        // The popover dismisses itself on the pointerdown that precedes this
        // click, so leave it closed rather than reopening it.
        if (performance.now() - closedAt < 300) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        anchor = { x: r.left, y: r.top };
    }

    // Same placement as SoundboardPopover: clamp into the viewport and flip up
    // when the anchor sits near the bottom edge.
    function positionMenu(node: HTMLElement, pos: { x: number; y: number }) {
        let raf = 0;
        function place(p: { x: number; y: number }) {
            node.style.visibility = "hidden";
            node.style.left = "0px";
            node.style.top = "0px";
            node.style.maxHeight = "";
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const w = node.offsetWidth;
                const h = node.offsetHeight;
                let left = Math.min(p.x, vw - w - 4);
                if (left < 4) left = 4;
                let top = p.y;
                if (top + h > vh - 4) top = p.y - h;
                if (top < 4) top = 4;
                const maxH = vh - top - 4;
                if (h > maxH) node.style.maxHeight = maxH + "px";
                node.style.left = left + "px";
                node.style.top = top + "px";
                node.style.visibility = "";
            });
        }
        place(pos);
        return {
            update(next: { x: number; y: number }) {
                place(next);
            },
            destroy() {
                cancelAnimationFrame(raf);
            },
        };
    }
</script>

{#snippet body()}
    <div class="space-y-1">
        <h3
            class="px-2 py-1 text-xs text-zam-textMuted uppercase font-semibold tracking-wide"
        >
            {t("callView.widgets")}
        </h3>
        {#if widgets.length === 0}
            <p class="px-2 py-1.5 text-sm text-zam-textMuted">
                {t("callView.noWidgets")}
            </p>
        {:else}
            <ul>
                {#each widgets as w (w.id)}
                    {@const open = openIds.has(w.id)}
                    <li>
                        <button
                            type="button"
                            onclick={() => toggleCallWidget(w.id)}
                            aria-label={open
                                ? t("callView.closeWidgetInCall", {
                                      widget: w.name,
                                  })
                                : t("callView.openWidgetInCall", {
                                      widget: w.name,
                                  })}
                            class="w-full flex items-center gap-2 px-2 py-1.5 rounded text-start hover:bg-zam-messageHover transition-colors"
                        >
                            <span class="flex-1 min-w-0">
                                <span
                                    class="block text-sm font-semibold text-zam-textPrimary truncate"
                                    >{w.name}</span
                                >
                                <span
                                    class="block text-xs text-zam-textMuted truncate"
                                    >{widgetOrigin(w.url) ?? w.url}</span
                                >
                            </span>
                            {#if open}
                                <Check
                                    size={16}
                                    class="text-zam-accent flex-shrink-0"
                                    aria-hidden="true"
                                />
                            {/if}
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
{/snippet}

{#if visible}
    <button
        type="button"
        onclick={toggle}
        class="{buttonClass} {anchor ? 'text-zam-accent' : idleClass}"
        title={t("callView.widgets")}
        aria-label={t("callView.widgets")}
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
    >
        <LayoutGrid size={20} />
    </button>
{/if}
{#if anchor}
    <Portal>
        {#if interfaceState.isTouchscreen}
            <BottomSheet onClose={close}>
                <div class="p-4">{@render body()}</div>
            </BottomSheet>
        {:else}
            <div
                use:positionMenu={{ x: anchor.x, y: anchor.y }}
                use:focusTrap={{ onEscape: close }}
                use:dismissOnOutsidePointer={{ onDismiss: close }}
                in:scale|global={{
                    start: 0.92,
                    opacity: 0,
                    duration: motionOK() ? 120 : 0,
                }}
                class="fixed z-50 w-72 rounded-lg bg-zam-backgroundTertiary border border-zam-divider shadow-xl p-2 overflow-y-auto"
                role="dialog"
                aria-label={t("callView.widgets")}
            >
                {@render body()}
            </div>
        {/if}
    </Portal>
{/if}
