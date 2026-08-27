/**
 * Plugin boot glue — the live glue; the second sanctioned client.ts-adjacent
 * consumer (via the store); wires the pure loader's injected ops to the item-2
 * store; does fetch → Blob → import(blobUrl) for repo bundles; persists the
 * per-device enabled set to localStorage["zam_plugins"].
 */
import {
    createPluginLoader,
    type LoadablePlugin,
    type LoaderHostOps,
} from "./loader";
import { BUILTIN_PLUGINS } from "./builtins/index";
import {
    getCachedBundle,
    putCachedBundle,
    isCachedBundleUsable,
    type CachedBundle,
} from "./bundleCache";
import {
    parsePersistedState,
    serializePersistedState,
    emptyPersistedState,
    type PersistedPluginState,
} from "./pluginPersist";
import type { PluginModule } from "./types";
import type { Manifest } from "./manifest";
import {
    createPluginHost,
    disposePluginHost,
    setInstalledPlugin,
    markPluginEnabled,
    markPluginError,
    setPluginRepos,
    addPluginRepo,
    removePluginRepo,
    removeInstalledPlugin,
    enabledPluginIds,
} from "$lib/stores/plugins.svelte";
import { normalizeRepoRef, rawUrl } from "./repo";
import { parseManifest } from "./manifest";
import { satisfiesMinAppVersion } from "./semver";
import { deleteCachedBundle } from "./bundleCache";
import { APP_VERSION } from "$lib/update";
import type { PluginIndexEntry } from "./repo";

const STORAGE_KEY = "zam_plugins";

// --- persisted per-device state ---
function readState(): PersistedPluginState {
    try {
        return parsePersistedState(localStorage.getItem(STORAGE_KEY));
    } catch {
        return emptyPersistedState();
    }
}
function writeState(state: PersistedPluginState): void {
    try {
        localStorage.setItem(STORAGE_KEY, serializePersistedState(state));
    } catch {
        /* private mode / quota — best-effort */
    }
}
function setEnabledFlag(pluginId: string, enabled: boolean): void {
    const state = readState();
    const existing = state.plugins[pluginId];
    if (existing) existing.enabled = enabled;
    else {
        // Fall back to the installed record's shape so a persisted entry is
        // always well-formed even if enable is called before boot seeded it.
        const b = BUILTIN_PLUGINS.find((p) => p.manifest.id === pluginId);
        state.plugins[pluginId] = {
            enabled,
            source: b ? "builtin" : "repo",
        };
    }
    writeState(state);
}

// --- loader wired to the item-2 store ---
const ops: LoaderHostOps = {
    createHost: (id, manifest) => createPluginHost(id, manifest),
    disposeHost: (id) => disposePluginHost(id),
    markEnabled: (id, enabled) => markPluginEnabled(id, enabled),
    markError: (id, error) => markPluginError(id, error),
};
const loader = createPluginLoader(ops);

// --- module import: built-in (direct) + repo (blob-import) ---
async function blobImport(code: string): Promise<PluginModule> {
    const url = URL.createObjectURL(
        new Blob([code], { type: "text/javascript" }),
    );
    try {
        const mod = (await import(/* @vite-ignore */ url)) as {
            default?: PluginModule;
        } & Partial<PluginModule>;
        const resolved = mod.default ?? (mod as PluginModule);
        if (typeof resolved?.onload !== "function") {
            throw new Error("plugin bundle has no onload export");
        }
        return resolved;
    } finally {
        URL.revokeObjectURL(url);
    }
}

function builtinLoadable(
    manifest: Manifest,
    module: PluginModule,
): LoadablePlugin {
    return { manifest, source: "builtin", load: () => Promise.resolve(module) };
}

function repoBundleUrl(repoRef: string, manifest: Manifest): string {
    const ref = normalizeRepoRef(repoRef);
    return rawUrl(ref, `plugins/${manifest.id}/${manifest.entry}`);
}

function repoLoadable(manifest: Manifest, repoRef: string): LoadablePlugin {
    return {
        manifest,
        source: "repo",
        async load() {
            const bundleUrl = repoBundleUrl(repoRef, manifest);
            const cached = await getCachedBundle(manifest.id);
            if (isCachedBundleUsable(cached, manifest.version)) {
                return blobImport((cached as CachedBundle).code);
            }
            let res: Response;
            try {
                res = await fetch(bundleUrl);
            } catch (e) {
                if (cached) return blobImport(cached.code);
                throw e;
            }
            if (!res.ok) {
                // Offline / 404: fall back to a stale cache if we have one.
                if (cached) return blobImport(cached.code);
                throw new Error(`fetch bundle ${res.status}`);
            }
            const code = await res.text();
            await putCachedBundle({
                pluginId: manifest.id,
                version: manifest.version,
                code,
                cachedAt: Date.now(),
            });
            return blobImport(code);
        },
    };
}

// Cache the loadable per installed plugin so enablePlugin (item-4 UI) can
// re-enable without rebuilding boot state.
const loadables = new Map<string, LoadablePlugin>();

export function initPlugins(): () => void {
    const state = readState();
    setPluginRepos(state.repos);

    // 1) Register built-ins (respect a persisted enable override).
    const toBoot: LoadablePlugin[] = [];
    for (const b of BUILTIN_PLUGINS) {
        const persisted = state.plugins[b.manifest.id];
        const enabled = persisted ? persisted.enabled : b.defaultEnabled;
        setInstalledPlugin({
            manifest: b.manifest,
            source: "builtin",
            enabled,
            error: null,
        });
        const l = builtinLoadable(b.manifest, b.module);
        loadables.set(b.manifest.id, l);
        if (enabled) toBoot.push(l);
    }

    // 2) Register persisted repo installs (item 4 populates these; forward-safe).
    for (const [id, entry] of Object.entries(state.plugins)) {
        if (entry.source !== "repo" || !entry.manifest || !entry.repoRef)
            continue;
        setInstalledPlugin({
            manifest: entry.manifest,
            source: "repo",
            enabled: entry.enabled,
            error: null,
            repoRef: entry.repoRef,
        });
        const l = repoLoadable(entry.manifest, entry.repoRef);
        loadables.set(id, l);
        if (entry.enabled) toBoot.push(l);
    }

    // 3) Boot-load enabled plugins (built-ins first, each error-isolated).
    void loader.bootLoad(toBoot);

    // Disposer: disable every currently-loaded plugin on logout/unmount.
    return () => {
        for (const id of [...loadables.keys()]) {
            if (loader.isLoaded(id)) void loader.disable(id);
        }
    };
}

export async function enablePlugin(pluginId: string): Promise<boolean> {
    const l = loadables.get(pluginId);
    if (!l) return false;
    const ok = await loader.enable(l);
    if (ok) setEnabledFlag(pluginId, true);
    return ok;
}

export async function disablePlugin(pluginId: string): Promise<void> {
    await loader.disable(pluginId);
    setEnabledFlag(pluginId, false);
}

export function getUserRepos(): string[] {
    return readState().repos;
}

/** Persist + reactively add a user repo (already normalized by canAddRepo). */
export function addRepo(normalizedRef: string): void {
    const state = readState();
    if (!state.repos.includes(normalizedRef)) {
        state.repos = [...state.repos, normalizedRef];
        writeState(state);
    }
    addPluginRepo(normalizedRef);
}

/** Persist + reactively remove a user repo. */
export function removeRepo(normalizedRef: string): void {
    const state = readState();
    state.repos = state.repos.filter((r) => r !== normalizedRef);
    writeState(state);
    removePluginRepo(normalizedRef);
}

/** Install a repo plugin: fetch + validate the manifest, cache the bundle
 *  (NO code runs — enable is a separate explicit action), record it disabled,
 *  and make it enablable without a reboot. Returns {ok:false,error} on any
 *  failure — never throws to the caller. */
export async function installRepoPlugin(
    repoRef: string,
    entry: PluginIndexEntry,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const ref = normalizeRepoRef(repoRef);
        const manRes = await fetch(rawUrl(ref, `${entry.path}/manifest.json`));
        if (!manRes.ok)
            return { ok: false, error: `manifest fetch ${manRes.status}` };
        const manifest = parseManifest(await manRes.json());
        if (
            manifest.minAppVersion &&
            !satisfiesMinAppVersion(APP_VERSION, manifest.minAppVersion)
        ) {
            return {
                ok: false,
                error: `requires app ${manifest.minAppVersion}+`,
            };
        }
        const bundleRes = await fetch(
            rawUrl(ref, `${entry.path}/${manifest.entry}`),
        );
        if (!bundleRes.ok)
            return { ok: false, error: `bundle fetch ${bundleRes.status}` };
        const code = await bundleRes.text();
        await putCachedBundle({
            pluginId: manifest.id,
            version: manifest.version,
            code,
            cachedAt: Date.now(),
        });
        setInstalledPlugin({
            manifest,
            source: "repo",
            enabled: false,
            error: null,
            repoRef,
        });
        const s = readState();
        s.plugins[manifest.id] = {
            enabled: false,
            source: "repo",
            repoRef,
            manifest,
        };
        writeState(s);
        loadables.set(manifest.id, repoLoadable(manifest, repoRef));
        return { ok: true };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

/** Uninstall a repo plugin: disable it, drop its loadable + cached bundle,
 *  remove its installed record, and delete its persisted entry. */
export async function uninstallRepoPlugin(pluginId: string): Promise<void> {
    if (loader.isLoaded(pluginId)) await loader.disable(pluginId);
    loadables.delete(pluginId);
    await deleteCachedBundle(pluginId);
    removeInstalledPlugin(pluginId);
    const state = readState();
    delete state.plugins[pluginId];
    writeState(state);
}

/** Kill switch (spec §3.4): disable every currently-enabled plugin. */
export async function disableAllPlugins(): Promise<void> {
    for (const id of enabledPluginIds()) {
        await disablePlugin(id);
    }
}
