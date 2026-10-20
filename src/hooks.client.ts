// First, so everything logged from here on (crypto init included) is kept
// for Settings > Debug Info > Client logs.
import { installLogCapture } from "$lib/logCapture";
import { initI18n } from "$lib/i18n";

installLogCapture();

// Runs before the app starts and before any route module is imported, so
// the active language's catalogue is in place for every `t()` call,
// including module-level constants.
export async function init(): Promise<void> {
    await initI18n();
}
