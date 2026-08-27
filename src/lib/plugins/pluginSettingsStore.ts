/**
 * Per-plugin settings storage — the ONE source of truth for the settings
 * localStorage key. Both hostApi.ts (the plugin's own read/persist) and the
 * Plugin Manager's settings form read/write through this key, so a plugin sees
 * the form's edits and the form seeds/reads the plugin's persisted values.
 * localStorage is touched only inside function bodies (vitest-import-safe).
 * No SDK/DOM-at-module-scope/client.ts imports.
 */
import { coerceValues, type SettingsSchema } from "./settingsSchema";

/** Stable per-plugin settings key. hostApi.ts sources its key from here too. */
export function settingsStorageKey(pluginId: string): string {
    return `zam.plugin.${pluginId}.settings`;
}

function readRaw(pluginId: string): unknown {
    try {
        const raw = localStorage.getItem(settingsStorageKey(pluginId));
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

/** Current coerced values for a plugin (defaults when missing/corrupt). */
export function readPluginSettings(
    pluginId: string,
    schema: SettingsSchema,
): Record<string, unknown> {
    return coerceValues(schema, readRaw(pluginId));
}

/** Coerce, persist, and return. Best-effort persist (swallows quota errors). */
export function writePluginSettings(
    pluginId: string,
    schema: SettingsSchema,
    values: unknown,
): Record<string, unknown> {
    const coerced = coerceValues(schema, values);
    try {
        localStorage.setItem(
            settingsStorageKey(pluginId),
            JSON.stringify(coerced),
        );
    } catch {
        /* quota / serialization — best-effort */
    }
    return coerced;
}
