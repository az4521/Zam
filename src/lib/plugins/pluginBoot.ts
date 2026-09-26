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
    isCacheFallbackAllowed,
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
import {
    normalizeRepoRef,
    parseIndex,
    pinnedFileUrl,
    commitShaApiUrl,
    repoKey,
    isCommitSha,
} from "./repo";
import { parseManifest } from "./manifest";
import { satisfiesMinAppVersion } from "./semver";
import { checkInstallId, decideRepoLoad } from "./pluginPin";
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
import { persistPluginSync, loadPluginSync } from "../matrix/pluginHost";
import {
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
    setPluginNeedsUpdate,
    setInstalledPluginSha,
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

// --- SHA resolution ---

/**
 * Resolve a branch to a commit SHA via the GitHub API. Called ONLY at install,
 * update, and the boot migration for unpinned plugins. Throws on failure.
 */
async function resolveCommitSha(
    ref: ReturnType<typeof normalizeRepoRef>,
): Promise<string> {
    const url = commitShaApiUrl(ref);
    const res = await fetch(url, {
        headers: { Accept: "application/vnd.github.sha" },
    });
    if (!res.ok) {
        throw new Error(
            `Couldn't resolve ${ref.owner}/${ref.repo}@${ref.branch} to a commit (HTTP ${res.status})`,
        );
    }
    const sha = await res.text();
    if (!isCommitSha(sha.trim())) {
        throw new Error(
            `GitHub API returned invalid SHA for ${ref.owner}/${ref.repo}@${ref.branch}`,
        );
    }
    return sha.trim();
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

function repoLoadable(manifest: Manifest, repoRef: string): LoadablePlugin {
    return {
        manifest,
        source: "repo",
        async load() {
            const ref = normalizeRepoRef(repoRef);
            const state = readState();
            const persisted = state.plugins[manifest.id];

            // Get pinned SHA from persisted state (if present and valid)
            const pinnedSha =
                persisted?.sha && isCommitSha(persisted.sha)
                    ? persisted.sha
                    : null;

            // Get path from persisted state, fall back to plugins/<id>
            const pluginPath = persisted?.path || `plugins/${manifest.id}`;

            // Check cache
            const cached = await getCachedBundle(manifest.id);
            const cacheUsable = isCachedBundleUsable(
                cached,
                manifest.version,
                pinnedSha || undefined,
            );
            const hasAnyCache = !!cached;

            // Try to resolve SHA if unpinned (migration path)
            let resolvedSha: string | null = null;
            if (!pinnedSha) {
                try {
                    resolvedSha = await resolveCommitSha(ref);
                } catch {
                    // Resolve failed — will be handled by decideRepoLoad
                }
            }

            // Decide what to do
            const decision = decideRepoLoad({
                pinnedSha,
                cacheUsable,
                hasAnyCache,
                resolvedSha,
            });

            // Record SHA if migration succeeded
            if (decision.record && persisted) {
                persisted.sha = decision.record;
                persisted.path = pluginPath;
                writeState(state);
                setInstalledPluginSha(manifest.id, decision.record);
            }

            if (decision.kind === "needs-update") {
                setPluginNeedsUpdate(manifest.id, true);
                throw new Error(
                    `Needs update: couldn't resolve ${ref.owner}/${ref.repo}@${ref.branch} and no cache available`,
                );
            }
            setPluginNeedsUpdate(manifest.id, false);

            if (decision.kind === "cache") {
                if (!cached) throw new Error("cache decision but no cache"); // shouldn't happen
                return blobImport(cached.code);
            }

            // decision.kind === "fetch"
            const sha = decision.sha;
            let res: Response;
            try {
                res = await fetch(
                    pinnedFileUrl(ref, sha, pluginPath, manifest.entry),
                );
            } catch (e) {
                // Network error: fall back to any cache
                if (isCacheFallbackAllowed(cached, sha))
                    return blobImport(cached.code);
                throw e;
            }

            if (!res.ok) {
                // Offline / 404: fall back to any cache if we have one
                if (isCacheFallbackAllowed(cached, sha))
                    return blobImport(cached.code);
                throw new Error(`fetch bundle ${res.status}`);
            }

            const code = await res.text();
            await putCachedBundle({
                pluginId: manifest.id,
                version: manifest.version,
                code,
                cachedAt: Date.now(),
                sha,
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
    const builtinIds = BUILTIN_PLUGINS.map((p) => p.manifest.id);
    for (const [id, entry] of Object.entries(state.plugins)) {
        if (entry.source !== "repo" || !entry.manifest || !entry.repoRef)
            continue;
        // Skip plugins whose id collides with a built-in id (shouldn't happen,
        // but defense in depth against persisted corruption).
        if (builtinIds.includes(id)) continue;
        setInstalledPlugin({
            manifest: entry.manifest,
            source: "repo",
            enabled: entry.enabled,
            error: null,
            repoRef: entry.repoRef,
            sha: entry.sha,
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

/** Install a repo plugin: resolve SHA, fetch + validate manifest at that SHA,
 *  cache the bundle (NO code runs — enable is a separate explicit action),
 *  record it disabled with the pinned SHA. Returns {ok:false,error} on any
 *  failure — never throws to the caller. */
export async function installRepoPlugin(
    repoRef: string,
    entry: PluginIndexEntry,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const ref = normalizeRepoRef(repoRef);

        // Check install id before doing any fetches
        const builtinIds = BUILTIN_PLUGINS.map((p) => p.manifest.id);
        const installed: Record<
            string,
            { source: "builtin" | "repo"; repoRef?: typeof ref }
        > = {};
        for (const [id, record] of Object.entries(installedPlugins)) {
            let recordRef: ReturnType<typeof normalizeRepoRef> | undefined;
            try {
                recordRef = record.repoRef
                    ? normalizeRepoRef(record.repoRef)
                    : undefined;
            } catch {
                recordRef = undefined;
            }
            installed[id] = { source: record.source, repoRef: recordRef };
        }
        const idError = checkInstallId({
            entryId: entry.id,
            manifestId: entry.id, // will be checked again after manifest fetch
            repoRef: ref,
            builtinIds,
            installed,
        });
        if (idError) return { ok: false, error: idError };

        // Try to get synced SHA from account data
        let sha: string | null = null;
        try {
            const syncData = loadPluginSync();
            const syncPayload = syncData ? parseSyncPayload(syncData) : null;
            if (syncPayload) {
                const syncEntry = syncPayload.plugins[entry.id];
                if (
                    syncEntry &&
                    syncEntry.repoRef &&
                    repoKey(normalizeRepoRef(syncEntry.repoRef)) ===
                        repoKey(ref) &&
                    syncEntry.sha &&
                    isCommitSha(syncEntry.sha)
                ) {
                    sha = syncEntry.sha;
                }
            }
        } catch {
            // Ignore sync errors — fall back to resolving
        }

        // If no valid synced SHA, resolve the branch
        if (!sha) {
            sha = await resolveCommitSha(ref);
        }

        // Fetch manifest at the pinned SHA
        const manRes = await fetch(
            pinnedFileUrl(ref, sha, entry.path, "manifest.json"),
        );
        if (!manRes.ok)
            return { ok: false, error: `manifest fetch ${manRes.status}` };
        const manifest = parseManifest(await manRes.json());

        // Re-check id now that we have the actual manifest
        const manifestIdError = checkInstallId({
            entryId: entry.id,
            manifestId: manifest.id,
            repoRef: ref,
            builtinIds,
            installed,
        });
        if (manifestIdError) return { ok: false, error: manifestIdError };

        if (
            manifest.minAppVersion &&
            !satisfiesMinAppVersion(APP_VERSION, manifest.minAppVersion)
        ) {
            return {
                ok: false,
                error: `requires app ${manifest.minAppVersion}+`,
            };
        }

        // Fetch bundle at the same SHA
        const bundleRes = await fetch(
            pinnedFileUrl(ref, sha, entry.path, manifest.entry),
        );
        if (!bundleRes.ok)
            return { ok: false, error: `bundle fetch ${bundleRes.status}` };
        const code = await bundleRes.text();

        // Cache with SHA
        await putCachedBundle({
            pluginId: manifest.id,
            version: manifest.version,
            code,
            cachedAt: Date.now(),
            sha,
        });

        setInstalledPlugin({
            manifest,
            source: "repo",
            enabled: false,
            error: null,
            repoRef,
            sha,
        });

        // Persist with SHA and path
        const s = readState();
        s.plugins[manifest.id] = {
            enabled: false,
            source: "repo",
            repoRef,
            manifest,
            sha,
            path: entry.path,
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
    setPluginNeedsUpdate(pluginId, false);
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
            sha: persisted?.sha,
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

/** Given the latest versions seen in Browse indexes (keyed by repoKey), publish
 *  the update badges and auto-update any plugin whose effective policy allows it. */
export async function applyUpdateCheck(
    latestByRepo: Record<string, Record<string, string>>,
): Promise<void> {
    const installed: InstalledForUpdate[] = Object.values(installedPlugins).map(
        (r) => ({
            id: r.manifest.id,
            version: r.manifest.version,
            source: r.source,
            repoRef: r.repoRef ? normalizeRepoRef(r.repoRef) : undefined,
        }),
    );
    const status = computeUpdateStatus(installed, latestByRepo);
    const available: Record<string, string> = {};
    for (const s of status) if (s.hasUpdate) available[s.id] = s.latestVersion;
    setUpdateAvailable(available);

    const auto = pluginsToAutoUpdate(
        status,
        pluginPrefs.autoUpdate,
        pluginPrefs.perPlugin,
    );
    for (const id of auto) {
        const res = await updateRepoPlugin(id);
        // Surface a failed auto-update on the plugin's row; it keeps running
        // its pinned code.
        if (!res.ok)
            markPluginError(
                id,
                `Auto-update failed: ${res.error ?? "unknown"}`,
            );
    }
}

/** Pull the newest bundle for an installed repo plugin: resolve SHA, fetch index
 *  + manifest + bundle at that SHA, re-cache, update the installed record with
 *  the new SHA, and reload if enabled. Preserves the enabled state (unlike
 *  install, which records disabled). */
export async function updateRepoPlugin(
    pluginId: string,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const state = readState();
        const persisted = state.plugins[pluginId];
        if (!persisted || persisted.source !== "repo" || !persisted.repoRef)
            return { ok: false, error: "not an installed repo plugin" };
        const ref = normalizeRepoRef(persisted.repoRef);

        // Resolve SHA FIRST
        const sha = await resolveCommitSha(ref);

        // Fetch index.json at the resolved SHA to find the entry
        const indexRes = await fetch(pinnedFileUrl(ref, sha, "index.json"));
        if (!indexRes.ok)
            return { ok: false, error: `index fetch ${indexRes.status}` };
        // parseIndex drops entries with an unsafe path; the index at THIS
        // commit decides where the plugin lives now.
        const entry = parseIndex(await indexRes.json()).find(
            (e) => e.id === pluginId,
        );
        if (!entry)
            return {
                ok: false,
                error: `plugin ${pluginId} not found in repo index`,
            };
        const pluginPath = entry.path;

        // Fetch manifest at the pinned SHA
        const manRes = await fetch(
            pinnedFileUrl(ref, sha, pluginPath, "manifest.json"),
        );
        if (!manRes.ok)
            return { ok: false, error: `manifest fetch ${manRes.status}` };
        const manifest = parseManifest(await manRes.json());

        // Manifest id must match the plugin id
        if (manifest.id !== pluginId) {
            return {
                ok: false,
                error: `manifest id mismatch: expected ${pluginId}, got ${manifest.id}`,
            };
        }

        if (
            manifest.minAppVersion &&
            !satisfiesMinAppVersion(APP_VERSION, manifest.minAppVersion)
        )
            return {
                ok: false,
                error: `requires app ${manifest.minAppVersion}+`,
            };

        // Fetch bundle at the same SHA
        const bundleRes = await fetch(
            pinnedFileUrl(ref, sha, pluginPath, manifest.entry),
        );
        if (!bundleRes.ok)
            return { ok: false, error: `bundle fetch ${bundleRes.status}` };
        const code = await bundleRes.text();

        // Cache with SHA
        await putCachedBundle({
            pluginId: manifest.id,
            version: manifest.version,
            code,
            cachedAt: Date.now(),
            sha,
        });

        const wasLoaded = loader.isLoaded(pluginId);
        // A plugin the user enabled but that could not load (e.g. "needs
        // update") comes up once the update gives it a pinned bundle.
        const wasEnabled = wasLoaded || persisted.enabled;

        // Update record + persist with new SHA and path, preserving enabled state.
        setInstalledPlugin({
            manifest,
            source: "repo",
            enabled: wasEnabled,
            error: null,
            repoRef: persisted.repoRef,
            sha,
        });
        persisted.manifest = manifest;
        persisted.sha = sha;
        persisted.path = pluginPath;
        writeState(state);

        loadables.set(manifest.id, repoLoadable(manifest, persisted.repoRef));

        // Clear needs-update on success
        setPluginNeedsUpdate(pluginId, false);

        if (wasLoaded) await disablePlugin(pluginId);
        if (wasEnabled) await enablePlugin(pluginId);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: (e as Error).message };
    }
}
