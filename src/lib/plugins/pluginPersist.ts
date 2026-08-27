import type { Manifest } from "./manifest";

export interface PersistedPluginEntry {
    enabled: boolean;
    source: "builtin" | "repo";
    repoRef?: string;
    manifest?: Manifest;
}

export interface PersistedPluginState {
    version: 1;
    plugins: Record<string, PersistedPluginEntry>;
    repos: string[];
}

export function emptyPersistedState(): PersistedPluginState {
    return { version: 1, plugins: {}, repos: [] };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parsePersistedState(raw: string | null): PersistedPluginState {
    if (!raw) return emptyPersistedState();
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return emptyPersistedState();
    }
    if (!isPlainObject(data) || data.version !== 1)
        return emptyPersistedState();
    if (!isPlainObject(data.plugins)) return emptyPersistedState();

    const out = emptyPersistedState();
    for (const [id, rawEntry] of Object.entries(data.plugins)) {
        if (!isPlainObject(rawEntry)) continue;
        const enabled = rawEntry.enabled;
        const source = rawEntry.source;
        if (typeof enabled !== "boolean") continue;
        if (source !== "builtin" && source !== "repo") continue;
        const entry: PersistedPluginEntry = { enabled, source };
        if (typeof rawEntry.repoRef === "string")
            entry.repoRef = rawEntry.repoRef;
        if (isPlainObject(rawEntry.manifest))
            entry.manifest = rawEntry.manifest as unknown as Manifest;
        out.plugins[id] = entry;
    }
    if (Array.isArray(data.repos)) {
        out.repos = data.repos.filter(
            (r): r is string => typeof r === "string",
        );
    }
    return out;
}

export function serializePersistedState(state: PersistedPluginState): string {
    return JSON.stringify(state);
}
