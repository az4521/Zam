/**
 * Reactive plugin registry + install/enabled state (Svelte 5 runes). The host
 * API (hostApi.ts) writes contributions into `pluginRegistry`; components read
 * `[...core, ...pluginRegistry.<kind>.map(e => e.value)]` and depend on
 * `pluginRegistry.tick` to re-derive (the tick bumps on every mutation, whether
 * from a plugin Disposable or a bulk disable). This store is the one place that
 * mints/tears down per-plugin hosts; only hostApi.ts touches client.ts.
 *
 * Reactivity: `pluginRegistry` is a $state OBJECT — its fields mutate in place
 * (never reassign the object), so the $state deep proxy stays live AND `tick`
 * gives a single dependency a $derived can read:
 *   const cmds = $derived(
 *     (void pluginRegistry.tick, mergeCore(SLASH_COMMANDS, pluginRegistry.commands)),
 *   );
 */
import { APP_VERSION } from "$lib/update";
import {
    createRegistryData,
    removePluginEntries,
    type PluginRegistryData,
} from "$lib/plugins/registry";
import { buildHostApi, type PluginHost } from "$lib/plugins/hostApi";
import type { Manifest } from "$lib/plugins/manifest";

export type PluginSource = "builtin" | "repo";

export interface InstalledPluginRecord {
    manifest: Manifest;
    source: PluginSource;
    enabled: boolean;
    error: string | null;
    /** Repo slug (`owner/repo[@branch]`) for repo plugins; absent for builtins. */
    repoRef?: string;
}

/** The shared reactive registry all extension points read from. Never
 *  reassigned — only its fields mutate (see reactivity note above). */
export const pluginRegistry: PluginRegistryData = $state(createRegistryData());

/** Installed plugins keyed by id (per-device state; the loader in item 3 and
 *  the manager UI in item 4 populate this). */
export const installedPlugins = $state<Record<string, InstalledPluginRecord>>(
    {},
);

/** Live hosts, keyed by plugin id — present only while the plugin is enabled.
 *  Module-scope Map (not $state): components never read it, only the lifecycle
 *  functions below. */
const hosts = new Map<string, PluginHost>();

/** Mint a host for a plugin and record it. Supersedes (disposes) any existing
 *  host for the same id so a re-enable never double-registers. */
export function createPluginHost(
    pluginId: string,
    manifest: Manifest,
): PluginHost {
    disposePluginHost(pluginId);
    const host = buildHostApi({
        pluginId,
        manifest,
        registry: pluginRegistry,
        appVersion: APP_VERSION,
    });
    hosts.set(pluginId, host);
    return host;
}

/** Tear down a plugin's host: run its disposeAll, drop the handle, and purge
 *  any stray registry entries as a safety net (defense in depth against a lost
 *  Disposable). */
export function disposePluginHost(pluginId: string): void {
    const host = hosts.get(pluginId);
    if (host) {
        try {
            host.disposeAll();
        } catch (e) {
            console.error(`[plugin ${pluginId}] disposeAll threw`, e);
        }
        hosts.delete(pluginId);
    }
    removePluginEntries(pluginRegistry, pluginId);
}

export function getPluginHost(pluginId: string): PluginHost | undefined {
    return hosts.get(pluginId);
}

export function setInstalledPlugin(record: InstalledPluginRecord): void {
    installedPlugins[record.manifest.id] = record;
}

export function markPluginEnabled(pluginId: string, enabled: boolean): void {
    const r = installedPlugins[pluginId];
    if (r) r.enabled = enabled;
}

export function markPluginError(pluginId: string, error: string | null): void {
    const r = installedPlugins[pluginId];
    if (r) r.error = error;
}

export function removeInstalledPlugin(pluginId: string): void {
    delete installedPlugins[pluginId];
}
