<script lang="ts">
    import type { Snippet } from "svelte";
    import { fly } from "svelte/transition";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { sheetDrag } from "$lib/actions/sheetDrag";
    import { motionOK } from "$lib/utils/motionPreference";

    interface Props {
        /** Dismiss the sheet (Escape inside the trap calls this). */
        onClose: () => void;
        children: Snippet;
    }
    let { onClose, children }: Props = $props();

    let sheetEl: HTMLElement | undefined = $state();

    // Callers own the backdrop and render it as the sheet's previous sibling
    // (`fixed inset-0 bg-black/40`); fade it with the drag without touching
    // every caller. Skipped if the sibling is not a full-screen layer.
    function fadeBackdrop(progress: number) {
        const el = sheetEl?.previousElementSibling;
        if (!(el instanceof HTMLElement) || !el.classList.contains("inset-0"))
            return;
        el.style.opacity = progress ? String(1 - progress) : "";
    }
</script>

<!--
  The canonical mobile bottom sheet: full-bleed panel pinned to the bottom
  edge, rounded top corners, a grab handle, and a focus trap whose Escape
  dismisses it. Callers own the Portal and the backdrop, because every host
  already renders both alongside a desktop-positioned variant.

  `pb-safe` is intended to keep the last row clear of the home indicator, but
  it is a no-op today because no such utility exists: `tailwind.config.js` has
  no `padding` extend and no plugins, and no CSS layer defines the class. The
  safe-area work (that utility plus `viewport-fit=cover` on the viewport meta)
  is owned elsewhere; the class name is left here so it starts working the
  moment that lands.

  Swiping down on the sheet (handle, header, or body at scrollTop 0) drags it
  and dismisses past ~30% of its height or on a fast flick; see sheetDrag.
-->
<div
    bind:this={sheetEl}
    use:focusTrap={{ onEscape: onClose }}
    use:sheetDrag={{
        onDismiss: onClose,
        onProgress: fadeBackdrop,
        animate: motionOK,
    }}
    in:fly={{ y: 32, duration: motionOK() ? 220 : 0 }}
    class="fixed bottom-0 start-0 end-0 z-50 bg-discord-backgroundTertiary border-t border-discord-divider rounded-t-2xl shadow-2xl pb-safe pt-2 max-h-[70vh] overflow-y-auto overscroll-contain"
>
    <div
        class="relative z-10 w-10 h-1 bg-discord-divider rounded-full mx-auto mb-2"
    ></div>
    {@render children()}
</div>
