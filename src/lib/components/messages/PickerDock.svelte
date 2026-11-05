<script lang="ts" module>
    // Switching tabs (emoji → GIF) swaps one picker's dock for another's in the
    // same tick; sliding the old one out and the new one in would look like
    // the panel closed and reopened. A switch marks itself and both
    // transitions run instantly.
    let switchedAt = 0;
    export function markPickerSwitch() {
        switchedAt = performance.now();
    }
    const justSwitched = () => performance.now() - switchedAt < 100;
</script>

<script lang="ts">
    import type { Snippet } from "svelte";
    import { fly } from "svelte/transition";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { t } from "$lib/i18n";
    import Portal from "$lib/components/ui/Portal.svelte";
    import { sheetDrag } from "$lib/actions/sheetDrag";
    import { motionOK } from "$lib/utils/motionPreference";

    interface Props {
        /** Close the picker (outside tap or a swipe down). */
        onClose: () => void;
        /** Height of the on-screen keyboard, so the dock sits above it. */
        keyboardOffset: number;
        children: Snippet;
    }
    let { onClose, keyboardOffset, children }: Props = $props();

    let dockEl: HTMLElement | undefined = $state();

    // A swipe has already carried the dock off-screen.
    let swiped = false;
    const duration = (ms: number) =>
        swiped || justSwitched() || !motionOK() ? 0 : ms;

    function dismissBySwipe() {
        swiped = true;
        onClose();
    }

    const drag = {
        onDismiss: dismissBySwipe,
        animate: motionOK,
        sheet: () => dockEl,
    };
</script>

<!--
  The touch emoji / sticker / GIF picker: docked at the bottom where the
  keyboard goes, like a bottom sheet but without dimming the conversation.
  Slides in and out, and a swipe down (on the picker's header, its grid when
  scrolled to the top, or anywhere above it) drags it away; see sheetDrag.
  Portalled because the GIF and sticker buttons' wrappers go display:none the
  moment their picker closes, which would hide the outro.
-->
<Portal>
    <button
        type="button"
        use:sheetDrag={drag}
        aria-label={t("common.close")}
        tabindex="-1"
        class="fixed inset-0 z-40 cursor-default"
        onclick={onClose}
    ></button>
    <div
        bind:this={dockEl}
        use:sheetDrag={drag}
        in:fly|global={{ y: "100%", duration: duration(240), easing: cubicOut }}
        out:fly|global={{ y: "100%", duration: duration(180), easing: cubicIn }}
        class="fixed start-0 end-0 z-50 overscroll-contain"
        style="bottom: {keyboardOffset}px;"
    >
        {@render children()}
    </div>
</Portal>
