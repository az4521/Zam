import { describe, it, expect } from "vitest";
import {
    createRegistryData,
    addEntry,
    removeEntry,
    removePluginEntries,
    valuesFor,
    mergeCore,
    countEntries,
    EXTENSION_KINDS,
} from "./registry";
import type { PluginCommand } from "./types";

const cmd = (name: string): PluginCommand => ({
    name,
    description: name,
    run() {},
});

describe("registry core", () => {
    it("starts empty with tick 0 and every kind present", () => {
        const d = createRegistryData();
        expect(d.tick).toBe(0);
        for (const kind of EXTENSION_KINDS) {
            expect(Array.isArray(d[kind])).toBe(true);
            expect((d[kind] as unknown[]).length).toBe(0);
        }
    });

    it("addEntry pushes a keyed entry and bumps tick", () => {
        const d = createRegistryData();
        addEntry(d, "commands", "a", cmd("hi"));
        expect(d.commands.length).toBe(1);
        expect(d.commands[0].pluginId).toBe("a");
        expect(d.commands[0].value.name).toBe("hi");
        expect(d.tick).toBe(1);
    });

    it("entryIds are strictly monotonic — never reused after removal", () => {
        const d = createRegistryData();
        const first = addEntry(d, "commands", "a", cmd("1"));
        const id1 = d.commands[0].entryId;
        first.dispose();
        addEntry(d, "commands", "a", cmd("2"));
        expect(d.commands[0].entryId).toBeGreaterThan(id1);
    });

    it("a Disposable removes only its own entry and is idempotent", () => {
        const d = createRegistryData();
        const da = addEntry(d, "commands", "a", cmd("a"));
        addEntry(d, "commands", "a", cmd("b"));
        da.dispose();
        da.dispose(); // second dispose is a no-op, does not throw or remove "b"
        expect(d.commands.map((e) => e.value.name)).toEqual(["b"]);
    });

    it("removePluginEntries clears ALL kinds for one plugin, leaves others", () => {
        const d = createRegistryData();
        addEntry(d, "commands", "a", cmd("a-cmd"));
        addEntry(d, "shortcuts", "a", {
            keys: "ctrl+k",
            description: "x",
            run() {},
        });
        addEntry(d, "commands", "b", cmd("b-cmd"));
        removePluginEntries(d, "a");
        expect(d.commands.map((e) => e.value.name)).toEqual(["b-cmd"]);
        expect(d.shortcuts.length).toBe(0);
        expect(countEntries(d, "a")).toBe(0);
        expect(countEntries(d, "b")).toBe(1);
    });

    it("mergeCore is [...core, ...pluginValues]", () => {
        const d = createRegistryData();
        addEntry(d, "commands", "a", cmd("plugin"));
        expect(mergeCore([cmd("core")], d.commands).map((c) => c.name)).toEqual(
            ["core", "plugin"],
        );
        expect(valuesFor(d.commands).map((c) => c.name)).toEqual(["plugin"]);
    });

    it("removeEntry returns false for an unknown id and does not bump tick", () => {
        const d = createRegistryData();
        addEntry(d, "commands", "a", cmd("a"));
        const tickBefore = d.tick;
        expect(removeEntry(d, "commands", 9999)).toBe(false);
        expect(d.tick).toBe(tickBefore);
    });

    it("removePluginEntries clears one plugin across all 13 kinds, leaves the other", () => {
        const data = createRegistryData();
        for (const kind of EXTENSION_KINDS) {
            addEntry(data, kind, "a", {} as never);
            addEntry(data, kind, "b", {} as never);
        }
        removePluginEntries(data, "a");
        expect(countEntries(data, "a")).toBe(0);
        expect(countEntries(data, "b")).toBe(EXTENSION_KINDS.length);
        for (const kind of EXTENSION_KINDS) {
            const arr = data[kind] as { pluginId: string }[];
            expect(arr.map((e) => e.pluginId)).toEqual(["b"]);
        }
    });

    it("disposing one plugin's entry on a shared kind leaves the other plugin's entry", () => {
        const data = createRegistryData();
        const da = addEntry(data, "commands", "a", { name: "acmd" } as never);
        addEntry(data, "commands", "b", { name: "bcmd" } as never);
        da.dispose();
        const cmds = data.commands.map((e) => ({
            pluginId: e.pluginId,
            value: e.value,
        }));
        expect(cmds).toEqual([{ pluginId: "b", value: { name: "bcmd" } }]);
    });
});
