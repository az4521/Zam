/**
 * Plugin noise filters for the user's own mic (zam.audio.registerMicFilter).
 * The plugin store hands its registry to this module at load
 * (setMicFilterSource), so the audio code reads registered filters without
 * importing the plugin system. A filter is named in settings by its key,
 * `plugin:<pluginId>/<filterId>`; a key whose plugin isn't loaded resolves to
 * nothing and the mic chain uses DeepFilterNet3.
 */
import type { MicFilter } from "$lib/plugins/types";

export const PLUGIN_FILTER_PREFIX = "plugin:";

export type PluginFilterKey = `plugin:${string}`;

interface Registered {
    pluginId: string;
    value: MicFilter;
}

let source: () => Registered[] = () => [];

export function setMicFilterSource(fn: () => Registered[]): void {
    source = fn;
}

export function micFilterKey(
    pluginId: string,
    filterId: string,
): PluginFilterKey {
    return `plugin:${pluginId}/${filterId}`;
}

export function isPluginFilterKey(v: unknown): v is PluginFilterKey {
    return (
        typeof v === "string" &&
        /^plugin:[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(
            v,
        )
    );
}

export function findMicFilter(key: string): MicFilter | null {
    for (const e of source())
        if (micFilterKey(e.pluginId, e.value.id) === key) return e.value;
    return null;
}

export function listMicFilters(): {
    key: PluginFilterKey;
    label: string;
    description?: string;
}[] {
    return source().map((e) => ({
        key: micFilterKey(e.pluginId, e.value.id),
        label: e.value.label,
        description: e.value.description,
    }));
}

/** The filter, waiting up to `timeoutMs` for its plugin to finish loading
 *  (plugins boot alongside the app; a call can start before they're in). */
export async function waitForMicFilter(
    key: string,
    timeoutMs: number,
): Promise<MicFilter | null> {
    const end = Date.now() + timeoutMs;
    for (;;) {
        const f = findMicFilter(key);
        if (f || Date.now() >= end) return f;
        await new Promise((r) => setTimeout(r, 100));
    }
}

/** Whether the filter says it can run here at all. */
export function micFilterUsable(f: MicFilter): boolean {
    try {
        return f.available ? f.available() : true;
    } catch {
        return false;
    }
}
