<script lang="ts">
    import { onMount } from "svelte";
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";
    import { scale } from "svelte/transition";
    import { motionOK } from "$lib/utils/motionPreference";
    import { focusTrap } from "$lib/actions/focusTrap";
    import type { ModalId } from "$lib/stores/interface.svelte";
    import { openModal, clearModalIfOwner } from "$lib/stores/interface.svelte";

    interface Reactor {
        userId: string;
        name: string;
        avatarUrl: string | null;
    }

    interface Props {
        reactors: Reactor[];
        overflow: number;
        label?: string;
        touch?: boolean;
        x?: number;
        y?: number;
        onClose?: () => void;
        /**
         * Desktop-only: render a transparent full-screen backdrop behind the
         * floating card so a click OUTSIDE it dismisses. Needed when the card is
         * opened on click (e.g. the read-receipt reader list) rather than hover —
         * the hover callers (reactions) leave this false and are unaffected.
         */
        desktopDismiss?: boolean;
        /** Claim the modal slot so Escape/back dismiss centrally. */
        modalId?: ModalId;
        /** Accessible label for the desktop dialog. */
        dialogLabel?: string;
    }

    let {
        reactors,
        overflow,
        label = "",
        touch = false,
        x = 0,
        y = 0,
        onClose,
        desktopDismiss = false,
        modalId = undefined,
        dialogLabel = undefined,
    }: Props = $props();

    onMount(() => {
        if (!modalId) return;
        const token = openModal(modalId, () => onClose?.());
        return () => {
            clearModalIfOwner(token);
        };
    });

    // Clamp a fixed, centered card to the viewport and place it ABOVE the
    // anchor (the reaction pill). Mirrors CallParticipantMenu.positionMenu but
    // anchors the card's bottom edge to `y` and centers on `x`.
    function positionCard(node: HTMLElement, pos: { x: number; y: number }) {
        const place = () => {
            node.style.visibility = "hidden";
            node.style.left = "0px";
            node.style.top = "0px";
            requestAnimationFrame(() => {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const w = node.offsetWidth;
                const h = node.offsetHeight;
                let left = pos.x - w / 2;
                if (left + w > vw - 4) left = vw - w - 4;
                if (left < 4) left = 4;
                let top = pos.y - h - 8; // above the pill
                if (top < 4) top = pos.y + 24; // no room above → below
                if (top + h > vh - 4) top = Math.max(4, vh - h - 4);
                node.style.left = left + "px";
                node.style.top = top + "px";
                node.style.visibility = "";
            });
        };
        place();
        return {
            update(next: { x: number; y: number }) {
                pos = next;
                place();
            },
        };
    }
</script>

{#snippet rows()}
    <div role="list">
        {#each reactors as r (r.userId)}
            <div class="flex items-center gap-2 px-3 py-1" role="listitem">
                <Avatar
                    src={r.avatarUrl}
                    name={r.name}
                    id={r.userId}
                    size={20}
                />
                <span class="text-sm text-discord-textPrimary truncate"
                    >{r.name}</span
                >
            </div>
        {/each}
        {#if overflow > 0}
            <div class="px-3 py-1 text-xs text-discord-textMuted">
                +{overflow} more
            </div>
        {/if}
    </div>
{/snippet}

{#if touch}
    <Portal>
        <button
            type="button"
            aria-label="Close"
            class="fixed inset-0 z-50 bg-black/40"
            onclick={() => onClose?.()}
        ></button>
        <BottomSheet onClose={() => onClose?.()}>
            {#if label}
                <div
                    class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-discord-textMuted border-b border-discord-divider"
                >
                    Reacted with {label}
                </div>
            {:else if dialogLabel && !label}
                <div
                    class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-discord-textMuted border-b border-discord-divider"
                >
                    {dialogLabel}
                </div>
            {/if}
            <div class="max-h-[50vh] overflow-y-auto py-1">
                {@render rows()}
            </div>
        </BottomSheet>
    </Portal>
{:else}
    <Portal>
        {#if desktopDismiss}
            <button
                type="button"
                aria-label="Close"
                class="fixed inset-0 z-40"
                onclick={() => onClose?.()}
            ></button>
            <div
                use:positionCard={{ x, y }}
                use:focusTrap={{ onEscape: () => onClose?.() }}
                in:scale|global={{
                    start: 0.92,
                    opacity: 0,
                    duration: motionOK() ? 120 : 0,
                }}
                class="fixed z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-40 max-w-64"
                role="dialog"
                aria-label={dialogLabel || "User list"}
            >
                {@render rows()}
            </div>
        {:else}
            <div
                use:positionCard={{ x, y }}
                in:scale|global={{
                    start: 0.92,
                    opacity: 0,
                    duration: motionOK() ? 120 : 0,
                }}
                class="fixed z-50 pointer-events-none bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-40 max-w-64"
            >
                {@render rows()}
            </div>
        {/if}
    </Portal>
{/if}
