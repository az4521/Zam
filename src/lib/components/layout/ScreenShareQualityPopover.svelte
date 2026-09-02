<script lang="ts">
    import Portal from "$lib/components/ui/Portal.svelte";
    import BottomSheet from "$lib/components/ui/BottomSheet.svelte";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { dismissOnOutsidePointer } from "$lib/actions/dismissOnOutsidePointer";
    import ScreenShareQualityChips from "./ScreenShareQualityChips.svelte";
    import { toggleScreenShare } from "$lib/stores/voiceCall.svelte";
    import { setScreenShareQuality } from "$lib/matrix/client";

    interface Props {
        x: number;
        y: number;
        mode: "pre-share" | "live";
        touch?: boolean;
        onClose: () => void;
    }
    let { x, y, mode, touch = false, onClose }: Props = $props();

    function goLive(): void {
        onClose();
        void toggleScreenShare();
    }

    // Copied verbatim from CallParticipantMenu.svelte:83-121 — clamps into the
    // viewport and flips up when the anchor (a share button near the bottom
    // edge) would push the popover off-screen.
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

<Portal>
    {#if touch}
        <button
            type="button"
            aria-label="Close"
            class="fixed inset-0 z-50 bg-black/40"
            onclick={onClose}
        ></button>
        <BottomSheet {onClose}>
            <div class="p-4 space-y-4">
                <ScreenShareQualityChips
                    onQualityChange={mode === "live"
                        ? setScreenShareQuality
                        : undefined}
                />
                {#if mode === "pre-share"}
                    <button
                        type="button"
                        class="w-full py-2 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-medium"
                        onclick={goLive}
                    >
                        Go Live
                    </button>
                {/if}
            </div>
        </BottomSheet>
    {:else}
        <div
            use:positionMenu={{ x, y }}
            use:focusTrap={{ onEscape: onClose }}
            use:dismissOnOutsidePointer={{ onDismiss: onClose }}
            class="fixed z-50 w-64 rounded-lg bg-discord-backgroundTertiary border border-discord-divider shadow-xl p-3 space-y-3 overflow-y-auto"
            role="dialog"
            aria-label="Screen share quality"
        >
            <ScreenShareQualityChips
                onQualityChange={mode === "live"
                    ? setScreenShareQuality
                    : undefined}
            />
            {#if mode === "pre-share"}
                <button
                    type="button"
                    class="w-full py-1.5 rounded bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-medium"
                    onclick={goLive}
                >
                    Go Live
                </button>
            {/if}
        </div>
    {/if}
</Portal>
