<script lang="ts">
    import { t } from "$lib/i18n";
    import Portal from "$lib/components/ui/Portal.svelte";
    import { scale } from "svelte/transition";
    import { motionOK } from "$lib/utils/motionPreference";
    import { closeModal } from "$lib/stores/interface.svelte";
    import { pluginPopover } from "$lib/plugins/pluginPopover.svelte";
    import { pluginMount } from "$lib/plugins/pluginMount";
    import { focusTrap } from "$lib/actions/focusTrap";

    // Position the card near its anchor: prefer directly above the anchor;
    // fall back below when there is no room. Clamp inside the viewport. Mirrors
    // ReactorPopover.svelte's positionCard, driven by the anchor's rect.
    function positionCard(node: HTMLElement, anchor: HTMLElement) {
        const place = () => {
            node.style.visibility = "hidden";
            node.style.left = "0px";
            node.style.top = "0px";
            requestAnimationFrame(() => {
                const r = anchor.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const w = node.offsetWidth;
                const h = node.offsetHeight;
                let left = r.left + r.width / 2 - w / 2;
                if (left + w > vw - 8) left = vw - w - 8;
                if (left < 8) left = 8;
                let top = r.top - h - 8; // above the anchor
                if (top < 8) top = r.bottom + 8; // no room above → below
                if (top + h > vh - 8) top = Math.max(8, vh - h - 8);
                node.style.left = left + "px";
                node.style.top = top + "px";
                node.style.visibility = "";
            });
        };
        place();
        return {
            update(next: HTMLElement) {
                anchor = next;
                place();
            },
        };
    }
</script>

{#if pluginPopover.current}
    {@const current = pluginPopover.current}
    <Portal>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="fixed inset-0 z-40" onclick={closeModal}></div>
        <!-- positionCard BEFORE focusTrap: both defer to rAF, and the card is
             visibility:hidden until positionCard's frame runs. The other order
             tries to focus a hidden element, which silently fails. -->
        <div
            role="dialog"
            aria-label={current.label ?? t("pluginPopoverHost.plugin")}
            use:positionCard={current.anchor}
            use:focusTrap={{ onEscape: closeModal }}
            in:scale|global={{
                start: 0.92,
                opacity: 0,
                duration: motionOK() ? 120 : 0,
            }}
            class="fixed z-50 bg-discord-backgroundTertiary border border-discord-divider rounded-lg shadow-xl overflow-hidden"
        >
            {#key current}
                <div use:pluginMount={current.render}></div>
            {/key}
        </div>
    </Portal>
{/if}
