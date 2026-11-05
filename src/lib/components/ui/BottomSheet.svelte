<script lang="ts">
    import type { Snippet } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { t } from "$lib/i18n";
    import { focusTrap } from "$lib/actions/focusTrap";
    import { sheetDrag } from "$lib/actions/sheetDrag";
    import { motionOK } from "$lib/utils/motionPreference";

    interface Props {
        /** Dismiss the sheet (backdrop tap, Escape, or a swipe down). */
        onClose: () => void;
        children: Snippet;
    }
    let { onClose, children }: Props = $props();

    let backdropEl: HTMLElement | undefined = $state();
    let sheetEl: HTMLElement | undefined = $state();

    // A swipe has already carried the sheet off-screen and faded the
    // backdrop, so the outros would only hold the DOM for nothing.
    let swiped = false;
    const duration = (ms: number) => (swiped || !motionOK() ? 0 : ms);

    function fadeBackdrop(progress: number) {
        if (backdropEl)
            backdropEl.style.opacity = progress ? String(1 - progress) : "";
    }

    function dismissBySwipe() {
        swiped = true;
        onClose();
    }
</script>

<!--
  The canonical mobile bottom sheet: a dimmed backdrop (tap to dismiss) and a
  full-bleed panel pinned to the bottom edge, with rounded top corners, a grab
  handle, and a focus trap whose Escape dismisses it. Callers own the Portal.

  The transitions are |global because every host opens the sheet from inside
  nested blocks ({#if open}{#if touch}…), where a local transition never plays;
  the outros keep the sheet and backdrop around until they finish, whichever
  way the host closes it.

  Swiping down anywhere (the backdrop, or the sheet's handle, header, or body at
  scrollTop 0) drags the sheet and dismisses past ~30% of its height or on a
  fast flick; see sheetDrag.
-->
<button
    bind:this={backdropEl}
    use:sheetDrag={{
        onDismiss: dismissBySwipe,
        onProgress: fadeBackdrop,
        animate: motionOK,
        sheet: () => sheetEl,
    }}
    type="button"
    aria-label={t("common.close")}
    class="fixed inset-0 z-50 bg-black/40"
    in:fade|global={{ duration: duration(200) }}
    out:fade|global={{ duration: duration(200) }}
    onclick={onClose}
></button>
<div
    bind:this={sheetEl}
    use:focusTrap={{ onEscape: onClose }}
    use:sheetDrag={{
        onDismiss: dismissBySwipe,
        onProgress: fadeBackdrop,
        animate: motionOK,
    }}
    in:fly|global={{ y: "100%", duration: duration(260), easing: cubicOut }}
    out:fly|global={{ y: "100%", duration: duration(200), easing: cubicIn }}
    class="fixed bottom-0 start-0 end-0 z-50 bg-discord-backgroundTertiary border-t border-discord-divider rounded-t-2xl shadow-2xl pb-safe pt-2 max-h-[70vh] overflow-y-auto overscroll-contain"
>
    <div
        class="relative z-10 w-10 h-1 bg-discord-divider rounded-full mx-auto mb-2"
    ></div>
    {@render children()}
</div>
