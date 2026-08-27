/**
 * Pure, dependency-injected loader state machine.
 *
 * NO imports of DOM/SDK/storage (client.ts, matrix-js-sdk, localStorage,
 * indexedDB, or browser APIs) — all real behavior arrives through the injected
 * `ops` and `load` seams. This is what makes it unit-testable; keep it
 * type-only. `pluginBoot.ts` wires the real ops + load implementations.
 */

import type { Manifest } from "./manifest";
import type { PluginModule, ZamPluginApi } from "./types";

export interface LoaderHostOps {
    createHost(pluginId: string, manifest: Manifest): { zam: ZamPluginApi };
    disposeHost(pluginId: string): void;
    markEnabled(pluginId: string, enabled: boolean): void;
    markError(pluginId: string, error: string | null): void;
}

export interface LoadablePlugin {
    manifest: Manifest;
    source: "builtin" | "repo";
    /** Resolve the plugin's module. Built-in: the bundled module. Repo:
     *  fetch(+cache) → blob-import. Injected so tests supply a fake. */
    load(): Promise<PluginModule>;
}

export interface PluginLoader {
    enable(p: LoadablePlugin): Promise<boolean>;
    disable(pluginId: string): Promise<void>;
    bootLoad(plugins: LoadablePlugin[]): Promise<void>;
    isLoaded(pluginId: string): boolean;
}

function errMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    return String(e);
}

export function createPluginLoader(ops: LoaderHostOps): PluginLoader {
    // Retain each enabled plugin's module so disable can call onunload.
    const modules = new Map<string, PluginModule>();

    async function enable(p: LoadablePlugin): Promise<boolean> {
        const id = p.manifest.id;
        try {
            const mod = await p.load();
            const { zam } = ops.createHost(id, p.manifest);
            await mod.onload(zam);
            modules.set(id, mod);
            ops.markEnabled(id, true);
            ops.markError(id, null);
            return true;
        } catch (e) {
            // Error isolation: never let a bad plugin reach boot. Purge any
            // partial registrations, flag the plugin, keep going.
            modules.delete(id);
            try {
                ops.disposeHost(id);
            } catch (de) {
                console.error(`[plugin ${id}] disposeHost threw`, de);
            }
            ops.markEnabled(id, false);
            ops.markError(id, errMessage(e));
            console.error(`[plugin ${id}] failed to enable`, e);
            return false;
        }
    }

    async function disable(pluginId: string): Promise<void> {
        const mod = modules.get(pluginId);
        if (mod?.onunload) {
            try {
                await mod.onunload();
            } catch (e) {
                console.error(`[plugin ${pluginId}] onunload threw`, e);
            }
        }
        modules.delete(pluginId);
        ops.disposeHost(pluginId);
        ops.markEnabled(pluginId, false);
    }

    async function bootLoad(plugins: LoadablePlugin[]): Promise<void> {
        const ordered = [...plugins].sort((a, b) => {
            const rank = (s: string) => (s === "builtin" ? 0 : 1);
            return rank(a.source) - rank(b.source);
        });
        for (const p of ordered) {
            await enable(p);
        }
    }

    return {
        enable,
        disable,
        bootLoad,
        isLoaded: (id) => modules.has(id),
    };
}
