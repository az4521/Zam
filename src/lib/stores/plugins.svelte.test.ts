import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("$lib/matrix/client", () => ({
    sendEventContent: vi.fn(),
    sendReaction: vi.fn(),
    getPluginRoomSummary: vi.fn(),
    getPluginRoomMembers: vi.fn(),
}));

import {
    pluginRegistry,
    installedPlugins,
    createPluginHost,
    disposePluginHost,
    getPluginHost,
    setInstalledPlugin,
    markPluginEnabled,
    removeInstalledPlugin,
} from "./plugins.svelte";
import { countEntries } from "$lib/plugins/registry";
import type { Manifest } from "$lib/plugins/manifest";

const manifest = (id: string): Manifest => ({
    id,
    name: id,
    version: "1.0.0",
    description: "x",
    author: "x",
    entry: "main.js",
});

beforeEach(() => {
    localStorage.clear();
    // Reset shared module state between tests.
    for (const id of Object.keys(installedPlugins)) disposePluginHost(id);
    for (const id of Object.keys(installedPlugins)) removeInstalledPlugin(id);
});

describe("plugins store", () => {
    it("createPluginHost registers into the shared reactive registry + bumps tick", () => {
        const before = pluginRegistry.tick;
        const host = createPluginHost("a", manifest("a"));
        host.zam.commands.register({ name: "hi", description: "d", run() {} });
        expect(pluginRegistry.commands.some((e) => e.pluginId === "a")).toBe(
            true,
        );
        expect(pluginRegistry.tick).toBeGreaterThan(before);
        expect(getPluginHost("a")).toBe(host);
    });

    it("disposePluginHost removes a plugin's entries but not another's", () => {
        const a = createPluginHost("a", manifest("a"));
        const b = createPluginHost("b", manifest("b"));
        a.zam.commands.register({ name: "a", description: "d", run() {} });
        b.zam.commands.register({ name: "b", description: "d", run() {} });
        disposePluginHost("a");
        expect(countEntries(pluginRegistry, "a")).toBe(0);
        expect(countEntries(pluginRegistry, "b")).toBe(1);
        expect(getPluginHost("a")).toBeUndefined();
    });

    it("re-creating a host for the same id supersedes (disposes) the old one", () => {
        const first = createPluginHost("a", manifest("a"));
        first.zam.commands.register({ name: "x", description: "d", run() {} });
        createPluginHost("a", manifest("a")); // supersede
        expect(countEntries(pluginRegistry, "a")).toBe(0);
    });

    it("install-state setters update the reactive installedPlugins map", () => {
        setInstalledPlugin({
            manifest: manifest("a"),
            source: "builtin",
            enabled: false,
            error: null,
        });
        expect(installedPlugins["a"].enabled).toBe(false);
        markPluginEnabled("a", true);
        expect(installedPlugins["a"].enabled).toBe(true);
        removeInstalledPlugin("a");
        expect(installedPlugins["a"]).toBeUndefined();
    });
});
