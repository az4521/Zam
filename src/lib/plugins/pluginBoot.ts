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
import { hostBridge } from "./hostBridge";
import { openPluginPopover } from "./pluginPopover.svelte";
import { dispatchPluginEvent } from "./pluginDispatch";
import type { PluginIndexEntry } from "./repo";
import {
    buildSyncPayload,
    parseSyncPayload,
    summarizePull,
    type PluginSyncPayload,
    type LocalSyncSnapshot,
    type PullSummary,
} from "./pluginSync";
import {
    computeUpdateStatus,
    pluginsToAutoUpdate,
    type InstalledForUpdate,
} from "./updateCheck";
// Sanctioned host consumer of the SDK boundary (like hostApi.ts) — sync writes
// self-scoped account data; plugins never import client.ts.
import {
    persistPluginSync,
    loadPluginSync,
    onTimelineEvent,
    onReactionEvent,
    onRoomUpdate,
    onSyncPrepared,
    onSyncReconnected,
} from "../matrix/client";
import { readPluginSettings, writePluginSettings } from "./pluginSettingsStore";
import {
    installedPlugins,
    pluginPrefs,
    setGlobalAutoUpdateState,
    setPluginAutoUpdateState,
    setUpdateAvailable,
    pluginRegistry,
} from "$lib/stores/plugins.svelte";

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

// --- auto-update get/set (persist + store mirror) ---

export function getGlobalAutoUpdate(): boolean {
    return readState().autoUpdate;
}

export function setGlobalAutoUpdate(v: boolean): void {
    const state = readState();
    state.autoUpdate = v;
    writeState(state);
    setGlobalAutoUpdateState(v);
}

export function getPluginAutoUpdate(id: string): boolean | undefined {
    return readState().plugins[id]?.autoUpdate;
}

export function setPluginAutoUpdate(id: string, v: boolean | undefined): void {
    const state = readState();
    const entry = state.plugins[id];
    if (entry) {
        if (v === undefined) delete entry.autoUpdate;
        else entry.autoUpdate = v;
        writeState(state);
    }
    setPluginAutoUpdateState(id, v);
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

/** Subscribe the globally-available client events and fan them out to plugin
 *  `events.on(...)` handlers. Payloads are plain + serializable (never live
 *  SDK objects), matching the §6 boundary. dispatchPluginEvent reads
 *  pluginRegistry.eventSubs at fire time, so late-registered subs are seen.
 *  Deferred (registered but not fired in v1, no consumer this run): typing
 *  (needs a per-room Room), member-join, message-sent, room-enter, notification.
 *  Returns an unsubscribe-all. */
function initEventBus(): () => void {
    const unsubs: Array<() => void> = [];

    unsubs.push(
        onTimelineEvent((event, room) => {
            const payload = {
                roomId: room.roomId,
                eventId: event.getId() ?? "",
                sender: event.getSender() ?? "",
                type: event.getType(),
                // Shallow-clone so a plugin that mutates the handed-out content
                // can't corrupt the SDK's stored event (full-trust footgun).
                content: { ...event.getContent() },
            };
            dispatchPluginEvent(
                pluginRegistry.eventSubs.map((e) => e.value),
                "message",
                payload,
            );
            dispatchPluginEvent(
                pluginRegistry.eventSubs.map((e) => e.value),
                "timeline",
                payload,
            );
        }),
    );

    unsubs.push(
        onReactionEvent((event, room) => {
            dispatchPluginEvent(
                pluginRegistry.eventSubs.map((e) => e.value),
                "reaction-added",
                {
                    roomId: room.roomId,
                    eventId: event.getId() ?? "",
                    sender: event.getSender() ?? "",
                    relatesTo: event.getContent()["m.relates_to"] ?? null,
                },
            );
        }),
    );

    unsubs.push(
        onRoomUpdate(() => {
            dispatchPluginEvent(
                pluginRegistry.eventSubs.map((e) => e.value),
                "room-update",
                {},
            );
        }),
    );

    unsubs.push(
        onSyncPrepared(() => {
            dispatchPluginEvent(
                pluginRegistry.eventSubs.map((e) => e.value),
                "sync",
                {
                    state: "PREPARED",
                },
            );
        }),
    );
    unsubs.push(
        onSyncReconnected(() => {
            dispatchPluginEvent(
                pluginRegistry.eventSubs.map((e) => e.value),
                "sync",
                {
                    state: "RECONNECTED",
                },
            );
        }),
    );

    return () => {
        for (const u of unsubs) {
            try {
                u();
            } catch {
                /* best-effort teardown */
            }
        }
    };
}

export function initPlugins(): () => void {
    // Wire the imperative UI seam item 8 owns: zam.ui.openPopover routes
    // through hostBridge.openPopover (hostApi.ts). Set once at boot.
    hostBridge.openPopover = openPluginPopover;

    // Fan client events out to plugin events.on(...) handlers (no-ops safely if
    // the client is not ready yet; the on* helpers guard internally).
    const disposeEventBus = initEventBus();

    const state = readState();
    setPluginRepos(state.repos);
    setGlobalAutoUpdateState(state.autoUpdate);
    for (const [id, entry] of Object.entries(state.plugins)) {
        if (typeof entry.autoUpdate === "boolean")
            setPluginAutoUpdateState(id, entry.autoUpdate);
    }

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

    // Disposer: unsubscribe the event bus + disable every loaded plugin.
    return () => {
        disposeEventBus();
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

// --- sync + update orchestration ---

/** Build the local plugin snapshot from persisted state + live settings. */
function localSnapshot(): LocalSyncSnapshot {
    const state = readState();
    const plugins: LocalSyncSnapshot["plugins"] = {};
    for (const [id, record] of Object.entries(installedPlugins)) {
        const persisted = state.plugins[id];
        const schema = record.manifest.settings;
        const settings = schema ? readPluginSettings(id, schema) : undefined;
        plugins[id] = {
            enabled: record.enabled,
            source: record.source,
            version: record.manifest.version,
            repoRef: record.repoRef,
            autoUpdate: persisted?.autoUpdate,
            settings,
        };
    }
    return { repos: state.repos, autoUpdate: state.autoUpdate, plugins };
}

/** Push the local plugin set + settings to account data. Never throws. */
export async function pushPluginSync(): Promise<{
    ok: boolean;
    error?: string;
}> {
    try {
        await persistPluginSync(buildSyncPayload(localSnapshot()));
        return { ok: true };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

/** Read remote account data and diff it against local state. Runs NO plugin
 *  code and mutates nothing — the summary drives the consent UI; applyPull does
 *  the work only after explicit confirmation. */
export async function getPullSummary(): Promise<{
    ok: boolean;
    summary?: PullSummary;
    payload?: PluginSyncPayload;
    error?: string;
}> {
    try {
        const raw = loadPluginSync();
        if (!raw)
            return {
                ok: false,
                error: "No plugin sync data on your account yet.",
            };
        const payload = parseSyncPayload(raw);
        if (!payload)
            return {
                ok: false,
                error: "The sync data on your account is malformed.",
            };
        return {
            ok: true,
            summary: summarizePull(payload, localSnapshot()),
            payload,
        };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}

/** Apply a pulled payload: add repos, enable/disable + reset settings for
 *  plugins ALREADY installed here, and set the global auto-update flag. Repo
 *  plugins not installed locally are intentionally left alone (the consent
 *  summary lists them; the user installs them from Browse, then re-pulls) — a
 *  pull never silently fetches/runs third-party remote code. */
export async function applyPull(payload: PluginSyncPayload): Promise<void> {
    for (const ref of payload.repos) addRepo(ref);
    setGlobalAutoUpdate(payload.autoUpdate);
    for (const [id, entry] of Object.entries(payload.plugins)) {
        const record = installedPlugins[id];
        if (!record) continue; // not installed here — skip (listed in summary)
        // Reset settings first so a plugin re-enabled below reads the pulled values.
        if (entry.settings && record.manifest.settings) {
            writePluginSettings(id, record.manifest.settings, entry.settings);
        }
        if (typeof entry.autoUpdate === "boolean")
            setPluginAutoUpdate(id, entry.autoUpdate);
        if (entry.enabled && !record.enabled) await enablePlugin(id);
        else if (!entry.enabled && record.enabled) await disablePlugin(id);
    }
}

/** Given the latest versions seen in Browse indexes, publish the update badges
 *  and auto-update any plugin whose effective policy allows it. */
export async function applyUpdateCheck(
    latestVersions: Record<string, string>,
): Promise<void> {
    const installed: InstalledForUpdate[] = Object.values(installedPlugins).map(
        (r) => ({
            id: r.manifest.id,
            version: r.manifest.version,
            source: r.source,
        }),
    );
    const status = computeUpdateStatus(installed, latestVersions);
    const available: Record<string, string> = {};
    for (const s of status) if (s.hasUpdate) available[s.id] = s.latestVersion;
    setUpdateAvailable(available);

    const auto = pluginsToAutoUpdate(
        status,
        pluginPrefs.autoUpdate,
        pluginPrefs.perPlugin,
    );
    for (const id of auto) await updateRepoPlugin(id);
}

/** Pull the newest bundle for an installed repo plugin: re-fetch manifest +
 *  bundle, re-cache, update the installed record, and reload if enabled.
 *  Preserves the enabled state (unlike install, which records disabled). */
export async function updateRepoPlugin(
    pluginId: string,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const state = readState();
        const persisted = state.plugins[pluginId];
        if (!persisted || persisted.source !== "repo" || !persisted.repoRef)
            return { ok: false, error: "not an installed repo plugin" };
        const ref = normalizeRepoRef(persisted.repoRef);
        const manRes = await fetch(
            rawUrl(ref, `plugins/${pluginId}/manifest.json`),
        );
        if (!manRes.ok)
            return { ok: false, error: `manifest fetch ${manRes.status}` };
        const manifest = parseManifest(await manRes.json());
        if (
            manifest.minAppVersion &&
            !satisfiesMinAppVersion(APP_VERSION, manifest.minAppVersion)
        )
            return {
                ok: false,
                error: `requires app ${manifest.minAppVersion}+`,
            };
        const bundleRes = await fetch(
            rawUrl(ref, `plugins/${pluginId}/${manifest.entry}`),
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
        const wasEnabled = loader.isLoaded(pluginId);
        // Update record + persist, preserving enabled state.
        setInstalledPlugin({
            manifest,
            source: "repo",
            enabled: wasEnabled,
            error: null,
            repoRef: persisted.repoRef,
        });
        persisted.manifest = manifest;
        writeState(state);
        loadables.set(manifest.id, repoLoadable(manifest, persisted.repoRef));
        if (wasEnabled) {
            await disablePlugin(pluginId);
            await enablePlugin(pluginId);
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}
