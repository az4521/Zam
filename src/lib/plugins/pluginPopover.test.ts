import { describe, it, expect, vi, beforeEach } from "vitest";
import { pluginPopover, openPluginPopover } from "./pluginPopover.svelte";
import {
    interfaceState,
    openModal,
    closeModal,
} from "$lib/stores/interface.svelte";

function anchor(): HTMLElement {
    return document.createElement("button");
}

beforeEach(() => {
    // Reset the shared modal slot between cases.
    closeModal();
    pluginPopover.current = null;
});

describe("openPluginPopover", () => {
    it("claims the plugin-popover modal slot and stores anchor+render", () => {
        const render = vi.fn();
        const a = anchor();
        openPluginPopover({ anchor: a, render });
        expect(interfaceState.modal).toBe("plugin-popover");
        expect(pluginPopover.current?.anchor).toBe(a);
        expect(pluginPopover.current?.render).toBe(render);
    });

    it("dispose() closes the popover when it still owns the slot", () => {
        const d = openPluginPopover({ anchor: anchor(), render: vi.fn() });
        d.dispose();
        expect(interfaceState.modal).toBe(null);
        expect(pluginPopover.current).toBe(null);
    });

    it("closeModal (Escape/backdrop) clears current via the close handler", () => {
        openPluginPopover({ anchor: anchor(), render: vi.fn() });
        closeModal();
        expect(pluginPopover.current).toBe(null);
    });

    it("dispose() of a superseded popover does NOT close the newer modal", () => {
        const d1 = openPluginPopover({ anchor: anchor(), render: vi.fn() });
        // A different modal supersedes it (runs d1's close, nulling current).
        openModal("create-poll", () => {});
        expect(pluginPopover.current).toBe(null);
        d1.dispose(); // stale token → no-op
        expect(interfaceState.modal).toBe("create-poll");
    });
});
