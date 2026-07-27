<script lang="ts">
    import type { Snippet } from "svelte";
    import { focusTrap } from "$lib/actions/focusTrap";

    interface Props {
        /** Dismiss the sheet (Escape inside the trap calls this). */
        onClose: () => void;
        children: Snippet;
    }
    let { onClose, children }: Props = $props();
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
-->
<div
    use:focusTrap={{ onEscape: onClose }}
    class="fixed bottom-0 left-0 right-0 z-50 bg-discord-backgroundTertiary border-t border-discord-divider rounded-t-2xl shadow-2xl pb-safe pt-2 max-h-[70vh] overflow-y-auto"
>
    <div class="w-10 h-1 bg-discord-divider rounded-full mx-auto mb-2"></div>
    {@render children()}
</div>
