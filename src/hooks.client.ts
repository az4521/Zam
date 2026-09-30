import { initI18n } from "$lib/i18n";

// Runs before the app starts and before any route module is imported, so
// the active language's catalogue is in place for every `t()` call,
// including module-level constants.
export async function init(): Promise<void> {
    await initI18n();
}
