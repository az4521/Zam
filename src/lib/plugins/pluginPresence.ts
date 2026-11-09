/**
 * zam.presence's entry shape to and from MSC4544's wire objects. Pure: the
 * parsing (lengths, mxc-only pictures, http-only buttons) is the same
 * parseRpcEntry that reads other users' profiles.
 */
import type { PluginPresence } from "./types";
import {
    RPC_UNSTABLE_PREFIX,
    parseRpcEntry,
    serializeRpcEntry,
    type RpcEntry,
} from "../utils/richPresence";

/** A plugin's entry as an RpcEntry, or a reason it was refused. Without an
 *  expiry it gets `fallbackExpiry` (the store renews it). */
export function pluginPresenceToEntry(
    p: PluginPresence,
    fallbackExpiry: number,
): RpcEntry | string {
    if (!p || typeof p !== "object") return "entry must be an object";
    if (p.kind !== "activity" && p.kind !== "music")
        return 'kind must be "activity" or "music"';
    if (typeof p.id !== "string" || !p.id.trim()) return "id is required";
    const { kind, expiry, buttons, progress, ...rest } = p as PluginPresence & {
        progress?: unknown;
    };
    const wire: Record<string, unknown> = {
        type: `${RPC_UNSTABLE_PREFIX}.${kind}`,
        expiry: expiry ?? fallbackExpiry,
        buttons: Array.isArray(buttons)
            ? buttons.map((b) => ({ label: b?.label, url: b?.url }))
            : undefined,
        progress,
    };
    for (const [k, v] of Object.entries(rest))
        wire[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
    const entry = parseRpcEntry(wire);
    if (!entry)
        return kind === "activity"
            ? "an activity needs a name and a valid expiry"
            : "music needs a track and a valid expiry";
    return entry;
}

/** What a plugin reads back: the entry without Zam's internals. */
export function entryToPluginPresence(e: RpcEntry): PluginPresence {
    const wire = serializeRpcEntry(e);
    const out: Record<string, unknown> = { kind: e.kind };
    for (const [k, v] of Object.entries(wire)) {
        if (k === "type") continue;
        out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
    }
    return out as unknown as PluginPresence;
}
