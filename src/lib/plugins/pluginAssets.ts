/**
 * Files a repo plugin ships beside its bundle (manifest `assets`): fetched
 * from the plugin's pinned commit, checked against the manifest's size and
 * SHA-256 before anything uses them, and kept in their own Cache Storage
 * cache. A pinned raw URL never changes content, so a cached file is never
 * stale; uninstall drops the plugin's files (deletePluginFiles).
 */
import type { ManifestFile } from "./manifest";
import { normalizeRepoRef, pinnedFileUrl } from "./repo";

export const PLUGIN_FILES_CACHE = "zam-plugin-files-v1";
const OWNER_HEADER = "x-zam-plugin";

/** Where a repo plugin's files come from. */
export interface PluginFileSource {
    repoRef: string;
    sha: string;
    /** The plugin's directory in its repo. */
    path: string;
}

export function pluginFileUrl(src: PluginFileSource, rel: string): string {
    return pinnedFileUrl(normalizeRepoRef(src.repoRef), src.sha, src.path, rel);
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
    const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    let s = "";
    for (const b of d) s += b.toString(16).padStart(2, "0");
    return s;
}

/** Throws unless `bytes` is exactly the file the manifest describes. */
export async function verifyPluginFile(
    file: ManifestFile,
    bytes: ArrayBuffer,
): Promise<void> {
    if (bytes.byteLength !== file.size)
        throw new Error(
            `${file.path}: ${bytes.byteLength} bytes, manifest says ${file.size}`,
        );
    const got = await sha256Hex(bytes);
    if (got !== file.sha256)
        throw new Error(`${file.path}: SHA-256 doesn't match the manifest`);
}

async function openCache(): Promise<Cache | null> {
    if (typeof caches === "undefined") return null;
    try {
        return await caches.open(PLUGIN_FILES_CACHE);
    } catch {
        return null; // storage blocked: fetch every time
    }
}

const inflight = new Map<string, Promise<ArrayBuffer>>();

/** The file's bytes, from the device or downloaded (and then kept). */
export function fetchPluginFile(
    pluginId: string,
    src: PluginFileSource,
    file: ManifestFile,
): Promise<ArrayBuffer> {
    const url = pluginFileUrl(src, file.path);
    let p = inflight.get(url);
    if (!p) {
        p = (async () => {
            const cache = await openCache();
            const hit = await cache?.match(url).catch(() => undefined);
            if (hit?.ok) {
                const bytes = await hit.arrayBuffer();
                if (bytes.byteLength === file.size) return bytes;
            }
            const res = await fetch(url);
            if (!res.ok)
                throw new Error(
                    `${file.path}: HTTP ${res.status} from the plugin repo`,
                );
            const bytes = await res.arrayBuffer();
            await verifyPluginFile(file, bytes);
            try {
                await cache?.put(
                    url,
                    new Response(bytes.slice(0), {
                        headers: {
                            "Content-Type": "application/octet-stream",
                            [OWNER_HEADER]: pluginId,
                        },
                    }),
                );
            } catch {
                /* quota: still usable this session */
            }
            return bytes;
        })().finally(() => inflight.delete(url));
        inflight.set(url, p);
    }
    return p;
}

export async function isPluginFileCached(
    src: PluginFileSource,
    file: ManifestFile,
): Promise<boolean> {
    const cache = await openCache();
    if (!cache) return false;
    return !!(await cache
        .match(pluginFileUrl(src, file.path))
        .catch(() => null));
}

/** Drop every cached file of a plugin (uninstall). */
export async function deletePluginFiles(pluginId: string): Promise<void> {
    const cache = await openCache();
    if (!cache) return;
    try {
        for (const req of await cache.keys()) {
            const res = await cache.match(req);
            if (res?.headers.get(OWNER_HEADER) === pluginId)
                await cache.delete(req);
        }
    } catch {
        /* best effort */
    }
}

/** zam.assets for one plugin. `source` is null for built-ins (no files). */
export function createAssetAccess(
    pluginId: string,
    files: ManifestFile[] | undefined,
    source: PluginFileSource | null,
) {
    const find = (path: string): ManifestFile => {
        const f = files?.find((x) => x.path === path);
        if (!f)
            throw new Error(`"${path}" isn't in the plugin's manifest assets`);
        if (!source) throw new Error("only repo plugins have asset files");
        return f;
    };
    return {
        get: async (path: string) =>
            fetchPluginFile(pluginId, source!, find(path)),
        url: async (path: string, type = "application/octet-stream") => {
            const bytes = await fetchPluginFile(pluginId, source!, find(path));
            return URL.createObjectURL(new Blob([bytes], { type }));
        },
        cached: async (path: string) => {
            try {
                return await isPluginFileCached(source!, find(path));
            } catch {
                return false;
            }
        },
    };
}
