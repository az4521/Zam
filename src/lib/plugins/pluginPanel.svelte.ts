/**
 * Backing store for a plugin's room-header panel (spec §6 room.addHeaderButton).
 * A panel is transient side content, so it reuses the single sidebar slot
 * (interface.svelte.ts): opening claims "plugin", which closes any other open
 * panel; Escape/back/close-button/supersede all dismiss it through AppShell's
 * central stack. `pluginPanel.current` holds the bound render + title + roomId;
 * MessageArea renders it via the pluginMount action. No SDK/client import.
 */
import { openSidebar } from "$lib/stores/interface.svelte";

export interface PluginPanelState {
    /** Stable header-button key (pluginHeaderKey) — identifies which button's
     *  panel is open, for the active-accent + teardown guards. */
    key: string;
    title: string;
    roomId: string;
    render(el: HTMLElement): void | (() => void);
}

export const pluginPanel = $state<{ current: PluginPanelState | null }>({
    current: null,
});

export function openPluginPanel(state: PluginPanelState): void {
    // Claim FIRST (ordering contract): the outgoing owner's close runs here.
    openSidebar("plugin", () => {
        // Escape/back/closeSidebar/supersede → drop the state so the host
        // unmounts and pluginMount runs the plugin's render cleanup.
        pluginPanel.current = null;
    });
    pluginPanel.current = state;
}
