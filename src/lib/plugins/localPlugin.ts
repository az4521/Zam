/**
 * Loading a plugin from a folder on this device, so plugin authors can iterate
 * without pushing to a repo. `readLocalPlugin` turns the folder's files into a
 * validated manifest + bundle + asset bytes; `filesFromList` / `filesFromDirectory`
 * collect those files from a `<input webkitdirectory>` or a File System Access
 * directory handle. Nothing here touches storage: pluginBoot persists the result.
 */
import { parseManifest, type Manifest } from "./manifest";
import { isSafeRelPath } from "./repo";

/** Folders never worth reading when a whole project directory is picked. */
const SKIPPED_DIRS = new Set(["node_modules", ".git"]);

export interface LocalPluginContents {
    manifest: Manifest;
    code: string;
    /** Manifest `assets`, by path. Not checksummed: the author is editing them. */
    assets: Map<string, ArrayBuffer>;
}

function skipped(path: string): boolean {
    return path.split("/").some((seg) => SKIPPED_DIRS.has(seg));
}

/** Files of a picked folder (`<input webkitdirectory>`), keyed by path relative
 *  to that folder. */
export function filesFromList(list: ArrayLike<File>): Map<string, Blob> {
    const out = new Map<string, Blob>();
    for (const f of Array.from(list)) {
        // webkitRelativePath is "<picked folder>/<path inside it>".
        const rel = f.webkitRelativePath.split("/").slice(1).join("/");
        if (rel && !skipped(rel)) out.set(rel, f);
    }
    return out;
}

/** Files of a File System Access directory handle, recursively. */
export async function filesFromDirectory(
    dir: FileSystemDirectoryHandle,
): Promise<Map<string, Blob>> {
    const out = new Map<string, Blob>();
    async function walk(d: FileSystemDirectoryHandle, prefix: string) {
        // The DOM lib's handle typings lack async iteration in older TS.
        const entries = (
            d as unknown as {
                entries(): AsyncIterable<
                    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
                >;
            }
        ).entries();
        for await (const [name, h] of entries) {
            const rel = prefix + name;
            if (skipped(rel)) continue;
            if (h.kind === "directory")
                await walk(h as FileSystemDirectoryHandle, rel + "/");
            else out.set(rel, await (h as FileSystemFileHandle).getFile());
        }
    }
    await walk(dir, "");
    return out;
}

/** Folders under `files` that are plugins, as path prefixes ("" for the top,
 *  else "sub/dir/"). A manifest.json at the top means the folder is one plugin;
 *  otherwise it's a repo, and every folder holding a manifest.json is one (the
 *  search stops at a plugin, so its own subfolders aren't taken for more). */
export function findPluginDirs(files: Map<string, Blob>): string[] {
    if (files.has("manifest.json")) return [""];
    const dirs = [...files.keys()]
        .filter((p) => p.endsWith("/manifest.json"))
        .map((p) => p.slice(0, -"manifest.json".length))
        .sort();
    return dirs.filter((d) => !dirs.some((o) => o !== d && d.startsWith(o)));
}

/** The files inside `prefix` (from findPluginDirs), keyed relative to it. */
export function filesUnder(
    files: Map<string, Blob>,
    prefix: string,
): Map<string, Blob> {
    if (!prefix) return files;
    const out = new Map<string, Blob>();
    for (const [p, f] of files)
        if (p.startsWith(prefix)) out.set(p.slice(prefix.length), f);
    return out;
}

/** The handle of the folder at `prefix` inside `root`. */
export async function directoryUnder(
    root: FileSystemDirectoryHandle,
    prefix: string,
): Promise<FileSystemDirectoryHandle> {
    let h = root;
    for (const seg of prefix.split("/").filter(Boolean))
        h = await h.getDirectoryHandle(seg);
    return h;
}

/** Validate a plugin folder's files. Throws an Error naming what's wrong. */
export async function readLocalPlugin(
    files: Map<string, Blob>,
): Promise<LocalPluginContents> {
    const manifestFile = files.get("manifest.json");
    if (!manifestFile)
        throw new Error(
            "No manifest.json found in that folder or the folders inside it.",
        );
    let raw: unknown;
    try {
        raw = JSON.parse(await manifestFile.text());
    } catch {
        throw new Error("manifest.json isn't valid JSON");
    }
    const manifest = parseManifest(raw);

    const entry = files.get(manifest.entry);
    if (!entry || !isSafeRelPath(manifest.entry))
        throw new Error(
            `Entry file "${manifest.entry}" not found in the folder`,
        );
    const code = await entry.text();
    if (!code.trim())
        throw new Error(`Entry file "${manifest.entry}" is empty`);

    const assets = new Map<string, ArrayBuffer>();
    for (const a of manifest.assets ?? []) {
        const f = files.get(a.path);
        if (!f) throw new Error(`Asset "${a.path}" not found in the folder`);
        assets.set(a.path, await f.arrayBuffer());
    }
    return { manifest, code, assets };
}
