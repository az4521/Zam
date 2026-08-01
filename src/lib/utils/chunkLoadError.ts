/**
 * Recognises a failed dynamic `import()` of a code-split chunk.
 *
 * Why this needs its own predicate: the browser's module map caches a FAILED
 * module-script fetch as a null entry that is never evicted, so a later
 * `import()` of the same URL rejects instantly without touching the network.
 * No amount of retrying in app code can recover it — only a page reload can.
 * So a chunk failure is not "try again in a moment", it is "reload", and the
 * message a user gets has to say so. The raw rejection message is a developer
 * string with a hashed URL in it ("Failed to fetch dynamically imported
 * module: https://…/CkYjDUEM.js") and must never reach a toast.
 *
 * Matching is on the message text because that is all the platforms give us:
 * none of them use a distinct error class or code for this.
 */

/** Message fragments every engine we ship on produces for a failed import. */
const CHUNK_LOAD_PATTERNS: RegExp[] = [
    // Chrome / Edge / Opera (Blink)
    /failed to fetch dynamically imported module/i,
    // Firefox (SpiderMonkey)
    /error loading dynamically imported module/i,
    // Safari (JavaScriptCore)
    /importing a module script failed/i,
    // Vite's own preload helper, which rejects before the import is attempted
    /unable to preload css/i,
];

/** True when `err` is a dynamic-import/chunk-fetch failure rather than an
 *  ordinary application or server error. Safe for any value, including
 *  `null`, primitives and objects with a throwing `message` getter. */
export function isChunkLoadError(err: unknown): boolean {
    if (typeof err !== "object" || err === null) return false;
    let raw: unknown;
    try {
        raw = (err as { message?: unknown }).message;
    } catch {
        return false;
    }
    if (typeof raw !== "string") return false;
    const message = raw;
    return CHUNK_LOAD_PATTERNS.some((pattern) => pattern.test(message));
}
