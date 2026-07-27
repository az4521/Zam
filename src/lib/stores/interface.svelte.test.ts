import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    interfaceState,
    openSubPage,
    closeSubPage,
    clearSubPageIfOwner,
} from "./interface.svelte";

beforeEach(() => {
    interfaceState.subPageClose = null;
});

describe("sub-page slot", () => {
    it("starts empty", () => {
        expect(interfaceState.subPageClose).toBe(null);
    });

    it("openSubPage takes the slot", () => {
        const close = vi.fn();
        openSubPage(close);
        expect(interfaceState.subPageClose).toBe(close);
        expect(close).not.toHaveBeenCalled();
    });

    it("closeSubPage empties the slot and runs the close handler once", () => {
        const close = vi.fn();
        openSubPage(close);
        closeSubPage();
        expect(interfaceState.subPageClose).toBe(null);
        expect(close).toHaveBeenCalledTimes(1);
    });

    it("closeSubPage on an empty slot is a no-op", () => {
        expect(() => closeSubPage()).not.toThrow();
        expect(interfaceState.subPageClose).toBe(null);
    });

    it("closeSubPage clears the slot before running close, so a re-entrant open survives", () => {
        const inner = vi.fn();
        const outer = vi.fn(() => openSubPage(inner));
        openSubPage(outer);
        closeSubPage();
        expect(interfaceState.subPageClose).toBe(inner);
    });

    it("openSubPage supersedes a previous owner, running its close exactly once", () => {
        const first = vi.fn();
        const second = vi.fn();
        openSubPage(first);
        openSubPage(second);
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
        expect(interfaceState.subPageClose).toBe(second);
    });

    it("openSubPage with the same handler does not re-run it", () => {
        const close = vi.fn();
        openSubPage(close);
        openSubPage(close);
        expect(close).not.toHaveBeenCalled();
        expect(interfaceState.subPageClose).toBe(close);
    });

    it("clearSubPageIfOwner empties the slot without running close", () => {
        const close = vi.fn();
        openSubPage(close);
        clearSubPageIfOwner(close);
        expect(interfaceState.subPageClose).toBe(null);
        expect(close).not.toHaveBeenCalled();
    });

    it("clearSubPageIfOwner leaves a newer owner's slot alone", () => {
        const stale = vi.fn();
        const current = vi.fn();
        openSubPage(stale);
        openSubPage(current);
        clearSubPageIfOwner(stale);
        expect(interfaceState.subPageClose).toBe(current);
        expect(current).not.toHaveBeenCalled();
    });
});
