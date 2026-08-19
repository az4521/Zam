<script lang="ts">
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import Avatar from "$lib/components/ui/Avatar.svelte";

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
    }

    let {
        reactors,
        overflow,
        label = "",
        touch = false,
        x = 0,
        y = 0,
        onClose,
    }: Props = $props();

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
    {#each reactors as r (r.userId)}
        <div class="flex items-center gap-2 px-3 py-1">
            <Avatar src={r.avatarUrl} name={r.name} id={r.userId} size={20} />
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
            {/if}
            <div class="max-h-[50vh] overflow-y-auto py-1">
                {@render rows()}
            </div>
        </BottomSheet>
    </Portal>
{:else}
    <Portal>
        <div
            use:positionCard={{ x, y }}
            class="fixed z-50 pointer-events-none bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl py-1 min-w-40 max-w-64"
        >
            {@render rows()}
        </div>
    </Portal>
{/if}
