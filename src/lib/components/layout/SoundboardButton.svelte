<script lang="ts">
    import { t } from "$lib/i18n";
    import type { Room } from "matrix-js-sdk";
    import { AudioLines } from "lucide-svelte";
    import SoundboardPopover from "./SoundboardPopover.svelte";
    import { interfaceState } from "$lib/stores/interface.svelte";

    interface Props {
        room: Room;
        size?: number;
        /** Padding and shape, which differ between the call view, the sidebar
         *  panel and the banner. */
        buttonClass: string;
        /** Colour while the popover is closed. */
        idleClass: string;
    }
    let { room, size = 20, buttonClass, idleClass }: Props = $props();

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
        // click, so a click on the button while it was open arrives here with
        // it already closed: leave it closed rather than reopening.
        if (performance.now() - closedAt < 300) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        anchor = { x: r.left, y: r.top };
    }
</script>

<button
    onclick={toggle}
    class="{buttonClass} {anchor ? 'text-discord-accent' : idleClass}"
    title={t("soundboard.title")}
    aria-label={t("soundboard.title")}
    aria-haspopup="dialog"
    aria-expanded={!!anchor}
>
    <AudioLines {size} />
</button>
{#if anchor}
    <SoundboardPopover
        {room}
        x={anchor.x}
        y={anchor.y}
        touch={interfaceState.isTouchscreen}
        onClose={close}
    />
{/if}
