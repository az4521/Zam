// Reader for files the Android shell stages in its cache (SharedIncomingFiles
// in MainActivity / ComposerWebView). Java passes only metadata plus the
// absolute path; the bytes are fetched through Capacitor's local file server
// and the staged copy is deleted once read (SharedFile.release).

import { Capacitor, registerPlugin } from "@capacitor/core";

/** Same bound the Java side enforces; a guard in case a payload exceeds it. */
export const MAX_NATIVE_SHARED_FILE_BYTES = 25 * 1024 * 1024;

export type NativeStagedFile = {
    path?: string;
    name?: string;
    mimeType?: string;
    size?: number;
};

interface SharedFilePlugin {
    release(options: { path: string }): Promise<{ removed: boolean }>;
}

const SharedFile = registerPlugin<SharedFilePlugin>("SharedFile");

/** Delete a staged file. Failures are ignored: the native sweep catches leftovers. */
export async function releaseNativeStagedFile(path: string): Promise<void> {
    try {
        await SharedFile.release({ path });
    } catch {
        /* best effort */
    }
}

/**
 * Read a staged file into a File, then delete the staged copy. Returns null
 * for a malformed entry, an oversize file, or a failed read.
 */
export async function nativeStagedFileToFile(
    staged: NativeStagedFile,
): Promise<File | null> {
    const path = staged?.path;
    if (!path) return null;
    try {
        if (
            typeof staged.size === "number" &&
            staged.size > MAX_NATIVE_SHARED_FILE_BYTES
        ) {
            return null;
        }
        const res = await fetch(Capacitor.convertFileSrc(path));
        if (!res.ok) return null;
        const blob = await res.blob();
        if (blob.size > MAX_NATIVE_SHARED_FILE_BYTES) return null;
        return new File([blob], staged.name || "file", {
            type: staged.mimeType || "application/octet-stream",
        });
    } catch {
        return null;
    } finally {
        await releaseNativeStagedFile(path);
    }
}
