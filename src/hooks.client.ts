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

installLogCapture();
// A full disk otherwise fails silently deep inside IndexedDB writes; catch
// what nobody else does, and watch the quota from the start.
installStorageErrorHandlers();
startStorageMonitor();

// Runs before the app starts and before any route module is imported, so
// the active language's catalogue is in place for every `t()` call,
// including module-level constants.
export async function init(): Promise<void> {
    await initI18n();
}
