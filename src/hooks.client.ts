// Before anything else: some Android WebViews lack APIs the SDK calls.
import "$lib/polyfills";
// First, so everything logged from here on (crypto init included) is kept
// for Settings > Debug Info > Client logs.
import { installLogCapture } from "$lib/logCapture";
import { initI18n } from "$lib/i18n";
import {
    installStorageErrorHandlers,
    startStorageMonitor,
} from "$lib/stores/storageHealth.svelte";

import type { HandleClientError } from "@sveltejs/kit";
import { version } from "$app/environment";
import { updated } from "$app/state";
import { reloadToLatest } from "$lib/update";

installLogCapture();
// A full disk otherwise fails silently deep inside IndexedDB writes; catch
// what nobody else does, and watch the quota from the start.
installStorageErrorHandlers();
startStorageMonitor();

const STALE_BUILD_RELOAD_KEY = "zam:stale-build-reload";

// Chrome, Safari and Firefox wording for a failed `import()`, plus Vite's
// own preload failure.
const CHUNK_LOAD_ERROR =
    /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

// After a deploy, iOS restoring an evicted PWA can boot the OLD index.html
// from its cache. The chunks it names were deleted by the deploy, the route
// fails to load and SvelteKit shows "500 Internal Error" until the app is
// fully closed and reopened. SvelteKit reloads by itself only when
// version.json says the build changed, and that restore can hand back a
// cached version.json too. So a failed chunk load is enough reason on its
// own: reload once past the HTTP cache. Once per build, so a server that
// really is missing the file shows the error instead of looping.
export const handleError: HandleClientError = async ({ error, status }) => {
    const message = status === 404 ? "Not Found" : "Internal Error";
    if (status === 404) return { message };
    const chunkFailed =
        error instanceof Error && CHUNK_LOAD_ERROR.test(error.message);
    if (!chunkFailed && !(await updated.check())) return { message };
    let tried: string | null = null;
    try {
        tried = sessionStorage.getItem(STALE_BUILD_RELOAD_KEY);
    } catch {
        // No storage: still worth one reload attempt.
    }
    if (tried !== version) {
        try {
            sessionStorage.setItem(STALE_BUILD_RELOAD_KEY, version);
        } catch {
            // ignore
        }
        console.warn("[update] stale build failed to load, reloading", error);
        void reloadToLatest();
    }
    return { message };
};

// Runs before the app starts and before any route module is imported, so
// the active language's catalogue is in place for every `t()` call,
// including module-level constants.
export async function init(): Promise<void> {
    await initI18n();
}
