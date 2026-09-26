// Web Share Target POST guard: limit files by count, per-file size, and total size.
// Mirrored into static/sw.js — change one, change both; shareTargetGuard.mirrors.test.ts
// executes the mirrored region against this module's case table.

export const SHARE_MAX_FILES = 20;
export const SHARE_MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB
export const SHARE_MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Returns true when the request is a valid Web Share Target POST that this SW
 * should intercept: POST to /share-target, same origin, navigate mode.
 */
export function isShareTargetPost(
    req: { method: string; url: string; mode: string },
    origin: string,
): boolean {
    if (req.method !== "POST") return false;
    if (req.mode !== "navigate") return false;
    let parsed: URL;
    try {
        parsed = new URL(req.url);
    } catch {
        return false;
    }
    if (parsed.origin !== origin) return false;
    if (parsed.pathname !== "/share-target") return false;
    return true;
}

/**
 * Limit shared files: at most SHARE_MAX_FILES, each at most SHARE_MAX_FILE_BYTES,
 * total at most SHARE_MAX_TOTAL_BYTES. Walk in order, greedy: keep a file if
 * kept-count < max, its size <= per-file max, and running total + size <= total max.
 */
export function limitShareFiles<T extends { size: number }>(
    files: T[],
): {
    kept: T[];
    dropped: number;
} {
    const kept: T[] = [];
    let totalSize = 0;
    for (const file of files) {
        if (kept.length >= SHARE_MAX_FILES) break;
        if (file.size > SHARE_MAX_FILE_BYTES) continue;
        if (totalSize + file.size > SHARE_MAX_TOTAL_BYTES) continue;
        kept.push(file);
        totalSize += file.size;
    }
    return { kept, dropped: files.length - kept.length };
}
