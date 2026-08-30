/**
 * The zam.ui.openPopover backing store (spec §6). A plugin popover is a
 * transient single popup, so it reuses the app's single-slot modal stack
 * (interface.svelte.ts): opening it claims the "plugin-popover" ModalId, which
 * closes any other open popup, and Escape/backdrop/supersede all dismiss it
 * through AppShell's central dismissTopmost — no private keydown handler.
 * `pluginPopover.current` holds the anchor + the plugin's render fn; the single
 * global PluginPopoverHost renders it. No SDK/client import: this is UI state.
 */
import { openModal, clearModalIfOwner } from "$lib/stores/interface.svelte";
import type { Disposable } from "./types";

export interface PluginPopoverState {
    anchor: HTMLElement;
    render(el: HTMLElement): void | (() => void);
}

/** Wrapped in an object so the field can be reassigned reactively; a $state
 *  proxy tracks `.current`. */
export const pluginPopover = $state<{ current: PluginPopoverState | null }>({
    current: null,
});

export function openPluginPopover(opts: {
    anchor: HTMLElement;
    render(el: HTMLElement): void | (() => void);
}): Disposable {
    // Claim FIRST (ordering contract): the outgoing owner's close runs here.
    const token = openModal("plugin-popover", () => {
        // Runs on Escape/backdrop/closeModal/supersede — drop the state so the
        // host unmounts and pluginMount runs the plugin's render cleanup.
        pluginPopover.current = null;
    });
    pluginPopover.current = { anchor: opts.anchor, render: opts.render };

    return {
        dispose() {
            // Only act if we still own the slot: clearModalIfOwner releases it
            // (without re-running our close), then we drop the state ourselves.
            // A superseded popover's token is stale → no-op, so we never close
            // a modal someone else now owns.
            if (clearModalIfOwner(token)) {
                pluginPopover.current = null;
            }
        },
    };
}
