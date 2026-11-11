import { describe, it, expect, vi } from "vitest";

vi.mock("../matrix/client", () => ({ sendReaction: vi.fn() }));
vi.mock("../matrix/pluginHost", () => ({
    sendEventContent: vi.fn(),
    getPluginRoomSummary: vi.fn(),
    getPluginRoomMembers: vi.fn(),
}));

import { pluginRegistry } from "../stores/plugins.svelte";
import { addEntry } from "./registry";
import {
    callControlItems,
    callPanelItems,
    callTileDecorationItems,
    closeCallPanel,
    openCallPanel,
} from "./pluginCall.svelte";

describe("pluginCall", () => {
    it("shows a panel only while it is open, in opening order", () => {
        addEntry(pluginRegistry, "callPanels", "a", {
            id: "one",
            title: "One",
            render() {},
        });
        addEntry(pluginRegistry, "callPanels", "a", {
            id: "two",
            title: "Two",
            render() {},
        });
        expect(callPanelItems("!r")).toEqual([]);
        openCallPanel("a", "two");
        openCallPanel("a", "one");
        openCallPanel("a", "one");
        expect(callPanelItems("!r").map((p) => p.title)).toEqual([
            "Two",
            "One",
        ]);
        closeCallPanel("a", "two");
        expect(callPanelItems("!r").map((p) => p.title)).toEqual(["One"]);
        closeCallPanel("a");
        expect(callPanelItems("!r")).toEqual([]);
    });

    it("passes the room to a panel and survives a throwing control", () => {
        const render = vi.fn();
        addEntry(pluginRegistry, "callPanels", "b", {
            id: "p",
            title: "P",
            render,
        });
        openCallPanel("b", "p");
        const el = document.createElement("div");
        callPanelItems("!room")[0].render(el);
        expect(render).toHaveBeenCalledWith(el, { roomId: "!room" });

        const err = vi.spyOn(console, "error").mockImplementation(() => {});
        addEntry(pluginRegistry, "callControls", "b", {
            id: "c",
            label: "C",
            active() {
                throw new Error("x");
            },
            onClick() {
                throw new Error("y");
            },
        });
        const [c] = callControlItems("!room").filter((i) => i.label === "C");
        expect(c.active).toBe(false);
        expect(() => c.click(el)).not.toThrow();
        err.mockRestore();
    });

    it("hands each tile its user", () => {
        const render = vi.fn();
        addEntry(pluginRegistry, "callTileDecorations", "c", {
            id: "d",
            render,
        });
        const el = document.createElement("div");
        callTileDecorationItems("!r", "@u:s")[0].render(el);
        expect(render).toHaveBeenCalledWith(el, {
            roomId: "!r",
            userId: "@u:s",
        });
    });
});
