import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK boundary so buildHostApi's client imports resolve without
// matrix-js-sdk. Each fn is a spy we assert against.
vi.mock("../matrix/client", () => ({
    sendEventContent: vi.fn().mockResolvedValue("$evt"),
    sendReaction: vi.fn().mockResolvedValue(undefined),
    getPluginRoomSummary: vi.fn().mockReturnValue({
        roomId: "!r",
        name: "Room",
        topic: null,
        memberCount: 2,
    }),
    getPluginRoomMembers: vi.fn().mockReturnValue([]),
    getClient: vi.fn().mockReturnValue({ __sentinel: "client" }),
}));

import * as client from "../matrix/client";
import { buildHostApi } from "./hostApi";
import { createRegistryData, countEntries } from "./registry";
import type { Manifest } from "./manifest";
import { hostBridge } from "./hostBridge";

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
    vi.clearAllMocks();
});

describe("buildHostApi — registration + cleanup", () => {
    it("register via zam pushes a keyed entry; dispose removes only it", () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1.2.3",
        });
        const d = host.zam.commands.register({
            name: "hi",
            description: "d",
            run() {},
        });
        expect(registry.commands.length).toBe(1);
        expect(registry.commands[0].pluginId).toBe("a");
        d.dispose();
        d.dispose(); // idempotent
        expect(registry.commands.length).toBe(0);
    });

    it("disposeAll removes ALL of a plugin's entries across kinds, leaves others", () => {
        const registry = createRegistryData();
        const a = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        const b = buildHostApi({
            pluginId: "b",
            manifest: manifest("b"),
            registry,
            appVersion: "1",
        });
        a.zam.commands.register({ name: "c", description: "d", run() {} });
        a.zam.shortcuts.register({
            keys: "ctrl+k",
            description: "d",
            run() {},
        });
        a.zam.messages.transformOutgoing((t) => t);
        a.zam.events.on("message", () => {});
        b.zam.commands.register({ name: "c2", description: "d", run() {} });
        expect(countEntries(registry, "a")).toBe(4);
        a.disposeAll();
        expect(countEntries(registry, "a")).toBe(0);
        expect(countEntries(registry, "b")).toBe(1);
    });

    it("self-disposed registrations are released from tracking; disposeAll still works", () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        const d1 = host.zam.commands.register({
            name: "c1",
            description: "d",
            run() {},
        });
        const d2 = host.zam.commands.register({
            name: "c2",
            description: "d",
            run() {},
        });
        expect(registry.commands.length).toBe(2);
        d1.dispose(); // self-dispose one
        expect(registry.commands.length).toBe(1);
        expect(registry.commands[0].value.name).toBe("c2");
        // disposeAll should cleanly remove the remaining one and be a no-op for the already-disposed one
        host.disposeAll();
        expect(registry.commands.length).toBe(0);
    });

    it("app.version is exposed and matrix.react routes to client.sendReaction", async () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "9.9.9",
        });
        expect(host.zam.app.version).toBe("9.9.9");
        await host.zam.matrix.react("!r", "$e", "👍");
        expect(client.sendReaction).toHaveBeenCalledWith("!r", "$e", "👍");
    });

    it("matrix.sendImage builds a 2-arg m.image content", async () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        await host.zam.matrix.sendImage("!r", { url: "mxc://x", body: "cat" });
        expect(client.sendEventContent).toHaveBeenCalledWith("!r", {
            msgtype: "m.image",
            body: "cat",
            url: "mxc://x",
            info: {},
        });
    });
});

describe("buildHostApi — storage + settings", () => {
    it("storage is namespaced per plugin and tolerates malformed JSON", () => {
        const registry = createRegistryData();
        const a = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        const b = buildHostApi({
            pluginId: "b",
            manifest: manifest("b"),
            registry,
            appVersion: "1",
        });
        a.zam.storage.set("k", { n: 1 });
        expect(b.zam.storage.get("k", "fallback")).toBe("fallback");
        expect(a.zam.storage.get("k")).toEqual({ n: 1 });
        // corrupt the stored value → get returns fallback, never throws
        localStorage.setItem("zam.plugin.a.storage.k", "{not json");
        expect(a.zam.storage.get("k", "fb")).toBe("fb");
        a.zam.storage.delete("k");
        expect(a.zam.storage.get("k", "gone")).toBe("gone");
    });

    it("settings.define seeds coerced defaults; get returns them", () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        host.zam.settings.define([
            { key: "loud", type: "toggle", label: "Loud", default: true },
            { key: "name", type: "text", label: "Name", default: "bob" },
        ]);
        expect(host.zam.settings.get("loud")).toBe(true);
        expect(host.zam.settings.get("name")).toBe("bob");
        expect(host.zam.settings.get("missing", "fb")).toBe("fb");
    });

    it("settings.define throws on an invalid schema", () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        expect(() =>
            host.zam.settings.define([
                { key: "", type: "toggle", label: "x" },
            ] as never),
        ).toThrow();
    });

    it("onChange fires on setSettings with coerced values; its Disposable stops it", () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        host.zam.settings.define([
            {
                key: "n",
                type: "number",
                label: "N",
                default: 0,
                min: 0,
                max: 10,
            },
        ]);
        const seen: unknown[] = [];
        const sub = host.zam.settings.onChange((v) => seen.push(v.n));
        host.setSettings({ n: 99 }); // coerced/clamped to 10
        expect(seen).toEqual([10]);
        sub.dispose();
        host.setSettings({ n: 5 });
        expect(seen).toEqual([10]); // no further delivery after dispose
    });

    it("disposeAll drops settings onChange subscriptions", () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        host.zam.settings.define([
            { key: "t", type: "toggle", label: "T", default: false },
        ]);
        const seen: unknown[] = [];
        host.zam.settings.onChange(() => seen.push(1));
        host.disposeAll();
        host.setSettings({ t: true });
        expect(seen).toEqual([]);
    });

    it("composer.startEdit routes to hostBridge and is a safe no-op when unwired", () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "zam.t",
            manifest: manifest("zam.t"),
            registry,
            appVersion: "1",
        });
        // No-op when hostBridge.startEdit is null
        expect(() =>
            host.zam.composer.startEdit({ roomId: "!r", eventId: "$e" }),
        ).not.toThrow();
        // Routes to the bridge when set
        const calls: unknown[] = [];
        hostBridge.startEdit = (ctx) => calls.push(ctx);
        host.zam.composer.startEdit({ roomId: "!r", eventId: "$e" });
        expect(calls).toEqual([{ roomId: "!r", eventId: "$e" }]);
        // Cleanup
        hostBridge.startEdit = null;
    });

    it("disposeAll leaves the other plugin's entry on a shared extension point", () => {
        const registry = createRegistryData();
        const a = buildHostApi({
            pluginId: "a",
            manifest: manifest("a"),
            registry,
            appVersion: "1",
        });
        const b = buildHostApi({
            pluginId: "b",
            manifest: manifest("b"),
            registry,
            appVersion: "1",
        });
        a.zam.commands.register({ name: "acmd", description: "d", run() {} });
        b.zam.commands.register({ name: "bcmd", description: "d", run() {} });
        a.disposeAll();
        expect(registry.commands.map((e) => e.pluginId)).toEqual(["b"]);
        expect(registry.commands[0].value.name).toBe("bcmd");
    });

    it("zam.unsafe.getClient returns the live SDK client sentinel", () => {
        const registry = createRegistryData();
        const host = buildHostApi({
            pluginId: "zam.t",
            manifest: manifest("zam.t"),
            registry,
            appVersion: "1",
        });
        const result = host.zam.unsafe.getClient();
        // same live client reference on every call — proves the hatch hands the client
        // through unchanged rather than wrapping/copying it
        expect(result).toBe(host.zam.unsafe.getClient());
        expect(result).toStrictEqual({ __sentinel: "client" });
        expect(client.getClient).toHaveBeenCalled();
    });
});
