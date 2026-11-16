// Bridge to the native history prefetch (HistoryPrefetchPlugin.java, run by
// HistoryPrefetchWorker). Native fetches raw, still-encrypted /messages pages
// in the background into app-private storage; the search-index crawler takes
// them from here instead of the network. Native never decrypts.
//
// Every export is a no-op or null off Android, and none throws to callers.

import { Capacitor, registerPlugin } from "@capacitor/core";
import {
    parsePrefetchStatus,
    parseTakenPrefetchPage,
    type PrefetchPlanInput,
    type PrefetchStatus,
    type TakenPrefetchPage,
} from "$lib/utils/historyPrefetchPlan";

interface HistoryPrefetchPlugin {
    setPlan(plan: PrefetchPlanInput): Promise<void>;
    takePage(options: {
        accountKey: string;
        roomId: string;
        from: string;
    }): Promise<unknown>;
    clear(options: { accountKey: string }): Promise<void>;
    status(options: { accountKey: string }): Promise<unknown>;
}

let plugin: HistoryPrefetchPlugin | null = null;

/** True only in the Android app (Capacitor native shell). */
export function historyPrefetchAvailable(): boolean {
    try {
        return (
            Capacitor.isNativePlatform() &&
            Capacitor.getPlatform() === "android"
        );
    } catch {
        return false;
    }
}

function native(): HistoryPrefetchPlugin | null {
    if (!historyPrefetchAvailable()) return null;
    if (!plugin)
        plugin = registerPlugin<HistoryPrefetchPlugin>("HistoryPrefetch");
    return plugin;
}

function warn(op: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[historyPrefetch] ${op} failed: ${msg}`);
}

/**
 * Hand native the account's plan: the token to fetch with, the filter and
 * page size, and each room's next token. Rooms without a token are ignored.
 */
export async function setPrefetchPlan(plan: PrefetchPlanInput): Promise<void> {
    const p = native();
    if (!p) return;
    try {
        await p.setPlan(plan);
    } catch (err) {
        warn("setPlan", err);
    }
}

/**
 * The prefetched page for this room whose `from` is the given token, or null.
 * Taking a page removes it from native storage.
 */
export async function takePrefetchedPage(
    accountKey: string,
    roomId: string,
    from: string,
): Promise<TakenPrefetchPage | null> {
    const p = native();
    if (!p) return null;
    try {
        return parseTakenPrefetchPage(
            await p.takePage({ accountKey, roomId, from }),
        );
    } catch (err) {
        warn("takePage", err);
        return null;
    }
}

/** Remove the account's plan and prefetched pages (sign-out, or the setting is off). */
export async function clearPrefetch(accountKey: string): Promise<void> {
    const p = native();
    if (!p) return;
    try {
        await p.clear({ accountKey });
    } catch (err) {
        warn("clear", err);
    }
}

/** Storage and last-run report for the account, for the debug panel. */
export async function prefetchStatus(
    accountKey: string,
): Promise<PrefetchStatus | null> {
    const p = native();
    if (!p) return null;
    try {
        return parsePrefetchStatus(await p.status({ accountKey }));
    } catch (err) {
        warn("status", err);
        return null;
    }
}
