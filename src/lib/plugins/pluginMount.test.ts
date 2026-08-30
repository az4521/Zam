import { describe, it, expect, vi } from "vitest";
import { pluginMount } from "./pluginMount";

function fakeEl(): HTMLElement {
    return { tagName: "DIV" } as unknown as HTMLElement;
}

describe("pluginMount", () => {
    it("calls render with the node on mount", () => {
        const render = vi.fn(() => () => {});
        const node = fakeEl();
        pluginMount(node, render);
        expect(render).toHaveBeenCalledWith(node);
    });

    it("runs the returned cleanup exactly once on destroy", () => {
        const cleanup = vi.fn();
        const action = pluginMount(fakeEl(), () => cleanup);
        action.destroy();
        action.destroy();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("is a safe no-op on destroy when render returns void", () => {
        const action = pluginMount(fakeEl(), () => {});
        expect(() => action.destroy()).not.toThrow();
    });

    it("swallows a throw from render (does not crash the host)", () => {
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() =>
            pluginMount(fakeEl(), () => {
                throw new Error("boom");
            }),
        ).not.toThrow();
        errSpy.mockRestore();
    });

    it("swallows a throw from cleanup on destroy", () => {
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const action = pluginMount(fakeEl(), () => () => {
            throw new Error("cleanup boom");
        });
        expect(() => action.destroy()).not.toThrow();
        errSpy.mockRestore();
    });
});
