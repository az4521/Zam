/**
 * Pure serialize/deserialize of the plugin-sync account-data payload
 * (moe.crafty.matrix.plugins). No SDK/DOM/localStorage imports — the boot glue
 * feeds it a plain snapshot and hands the parsed result to the manager UI.
 */

export interface PluginSyncEntry {
    enabled: boolean;
    source: "builtin" | "repo";
    version?: string;
    repoRef?: string;
    autoUpdate?: boolean;
    settings?: Record<string, unknown>;
}

export interface PluginSyncPayload {
    version: 1;
    repos: string[];
    plugins: Record<string, PluginSyncEntry>;
    autoUpdate: boolean;
}

export interface LocalSyncSnapshot {
    repos: string[];
    autoUpdate: boolean;
    plugins: Record<string, PluginSyncEntry>;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Whitelist an entry's fields so nothing extraneous is written to the wire. */
function cleanEntry(e: PluginSyncEntry): PluginSyncEntry {
    const out: PluginSyncEntry = { enabled: e.enabled, source: e.source };
    if (typeof e.version === "string") out.version = e.version;
    if (typeof e.repoRef === "string") out.repoRef = e.repoRef;
    if (typeof e.autoUpdate === "boolean") out.autoUpdate = e.autoUpdate;
    if (isPlainObject(e.settings)) out.settings = { ...e.settings };
    return out;
}

export function buildSyncPayload(local: LocalSyncSnapshot): PluginSyncPayload {
    const plugins: Record<string, PluginSyncEntry> = {};
    for (const [id, e] of Object.entries(local.plugins)) {
        plugins[id] = cleanEntry(e);
    }
    return {
        version: 1,
        repos: [...local.repos],
        plugins,
        autoUpdate: !!local.autoUpdate,
    };
}

export function parseSyncPayload(raw: unknown): PluginSyncPayload | null {
    if (!isPlainObject(raw) || raw.version !== 1) return null;
    const out: PluginSyncPayload = {
        version: 1,
        repos: [],
        plugins: {},
        autoUpdate: false,
    };
    if (typeof raw.autoUpdate === "boolean") out.autoUpdate = raw.autoUpdate;
    if (Array.isArray(raw.repos)) {
        out.repos = raw.repos.filter((r): r is string => typeof r === "string");
    }
    if (isPlainObject(raw.plugins)) {
        for (const [id, rawEntry] of Object.entries(raw.plugins)) {
            if (!isPlainObject(rawEntry)) continue;
            if (typeof rawEntry.enabled !== "boolean") continue;
            if (rawEntry.source !== "builtin" && rawEntry.source !== "repo")
                continue;
            const entry: PluginSyncEntry = {
                enabled: rawEntry.enabled,
                source: rawEntry.source,
            };
            if (typeof rawEntry.version === "string")
                entry.version = rawEntry.version;
            if (typeof rawEntry.repoRef === "string")
                entry.repoRef = rawEntry.repoRef;
            if (typeof rawEntry.autoUpdate === "boolean")
                entry.autoUpdate = rawEntry.autoUpdate;
            if (isPlainObject(rawEntry.settings))
                entry.settings = { ...rawEntry.settings };
            out.plugins[id] = entry;
        }
    }
    return out;
}
