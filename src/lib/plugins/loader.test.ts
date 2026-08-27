import { describe, it, expect, vi } from "vitest";
import { createPluginLoader, type LoadablePlugin } from "./loader";
import type { Manifest } from "./manifest";
import type { PluginModule, ZamPluginApi } from "./types";

function fakeOps() {
    const enabled: Record<string, boolean> = {};
    const errors: Record<string, string | null> = {};
    const disposed: string[] = [];
    const zam = {} as ZamPluginApi;
    return {
        enabled,
        errors,
        disposed,
        ops: {
            createHost: vi.fn((_id: string, _m: Manifest) => ({ zam })),
            disposeHost: vi.fn((id: string) => disposed.push(id)),
            markEnabled: vi.fn((id: string, v: boolean) => (enabled[id] = v)),
            markError: vi.fn(
                (id: string, e: string | null) => (errors[id] = e),
            ),
        },
    };
}

const manifest = (id: string): Manifest => ({
    id,
    name: id,
    version: "1.0.0",
    description: "d",
    author: "a",
    entry: "main.js",
});

function loadable(
    id: string,
    source: "builtin" | "repo",
    mod: PluginModule | (() => Promise<PluginModule>),
): LoadablePlugin {
    return {
        manifest: manifest(id),
        source,
        load: typeof mod === "function" ? mod : () => Promise.resolve(mod),
    };
}

describe("createPluginLoader", () => {
    it("enable() calls onload and marks enabled", async () => {
        const f = fakeOps();
        const loader = createPluginLoader(f.ops);
        const onload = vi.fn();
        const ok = await loader.enable(loadable("p", "builtin", { onload }));
        expect(ok).toBe(true);
        expect(onload).toHaveBeenCalledOnce();
        expect(f.enabled["p"]).toBe(true);
        expect(f.errors["p"]).toBe(null);
        expect(loader.isLoaded("p")).toBe(true);
    });

    it("isolates a throwing onload: disposes, flags error, returns false", async () => {
        const f = fakeOps();
        const loader = createPluginLoader(f.ops);
        const ok = await loader.enable(
            loadable("bad", "builtin", {
                onload() {
                    throw new Error("boom");
                },
            }),
        );
        expect(ok).toBe(false);
        expect(f.disposed).toContain("bad");
        expect(f.enabled["bad"]).toBe(false);
        expect(f.errors["bad"]).toContain("boom");
        expect(loader.isLoaded("bad")).toBe(false);
    });

    it("isolates a rejecting load()", async () => {
        const f = fakeOps();
        const loader = createPluginLoader(f.ops);
        const ok = await loader.enable(
            loadable("badimport", "repo", () =>
                Promise.reject(new Error("network")),
            ),
        );
        expect(ok).toBe(false);
        expect(f.errors["badimport"]).toContain("network");
    });

    it("disable() calls onunload then disposes", async () => {
        const f = fakeOps();
        const loader = createPluginLoader(f.ops);
        const onunload = vi.fn();
        await loader.enable(
            loadable("p", "builtin", { onload() {}, onunload }),
        );
        await loader.disable("p");
        expect(onunload).toHaveBeenCalledOnce();
        expect(f.disposed).toContain("p");
        expect(f.enabled["p"]).toBe(false);
        expect(loader.isLoaded("p")).toBe(false);
    });

    it("disable() survives a throwing onunload", async () => {
        const f = fakeOps();
        const loader = createPluginLoader(f.ops);
        await loader.enable(
            loadable("p", "builtin", {
                onload() {},
                onunload() {
                    throw new Error("unload boom");
                },
            }),
        );
        await expect(loader.disable("p")).resolves.toBeUndefined();
        expect(f.disposed).toContain("p");
    });

    it("enable→disable→enable leaves no stale retained module", async () => {
        const f = fakeOps();
        const loader = createPluginLoader(f.ops);
        const l = loadable("p", "builtin", { onload() {} });
        await loader.enable(l);
        await loader.disable("p");
        await loader.enable(l);
        expect(loader.isLoaded("p")).toBe(true);
        // createHost called once per enable (2), never left double-registered
        expect(f.ops.createHost).toHaveBeenCalledTimes(2);
    });

    it("bootLoad loads built-ins before repo and isolates failures", async () => {
        const f = fakeOps();
        const loader = createPluginLoader(f.ops);
        const order: string[] = [];
        const mk = (id: string, source: "builtin" | "repo", fail = false) =>
            loadable(id, source, {
                onload() {
                    order.push(id);
                    if (fail) throw new Error("x");
                },
            });
        await loader.bootLoad([
            mk("repo1", "repo"),
            mk("builtinBad", "builtin", true),
            mk("builtin1", "builtin"),
        ]);
        // built-ins first (order among built-ins is stable input order)
        expect(order.slice(0, 2)).toEqual(["builtinBad", "builtin1"]);
        expect(order[2]).toBe("repo1");
        expect(loader.isLoaded("builtin1")).toBe(true);
        expect(loader.isLoaded("builtinBad")).toBe(false);
        expect(loader.isLoaded("repo1")).toBe(true);
    });

    it("does not re-throw when a cleanup op throws during a failed enable", async () => {
        const f = fakeOps();
        f.ops.markError = vi.fn(() => {
            throw new Error("store write failed");
        });
        const loader = createPluginLoader(f.ops);
        await expect(
            loader.enable(
                loadable("bad", "builtin", {
                    onload() {
                        throw new Error("boom");
                    },
                }),
            ),
        ).resolves.toBe(false);
    });
});
