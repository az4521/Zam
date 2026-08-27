/**
 * Pure adapters turning plugin message-hook registry entries into the view
 * models MessageItem's action toolbar / overflow sheet and the decoration
 * renderer consume. No SDK/DOM imports — types only — so filtering + error
 * isolation are unit-testable in isolation (the components own the reactive
 * `pluginRegistry.tick` read and the markup). Mirrors utils/pluginComposer.ts
 * (item 8) and utils/slashCommands.ts (item 7).
 *
 * Interop (spec §2): both outputs are ADDITIVE — a message action-menu item and
 * a per-message badge. Neither touches inbound body rendering.
 */
import type { RegistryEntry } from "$lib/plugins/registry";
import type { MessageActionItem, MessageDecorator } from "$lib/plugins/types";
import { pluginContribKey } from "./pluginComposer";

export interface PluginMessageActionView {
    /** `plugin:<pluginId>:<id>` — stable {#each} key + dispatch id. */
    key: string;
    label: string;
    /** SVG path `d` string (rendered via <path d=...>); NOT raw markup. */
    icon?: string;
    /** onSelect bound to this message's ctx; returns its value so the caller
     *  can await/catch. Dispatch-time throws are the caller's to isolate. */
    run(): void | Promise<void>;
}

/**
 * Build the plugin action rows for one message, filtered by each action's
 * `when(ctx)` gate. A `when` that throws is treated as "hide" — a buggy
 * full-trust plugin must never break the whole action menu. Order = registry
 * order (plugins append after core).
 */
export function pluginMessageActions(
    entries: RegistryEntry<MessageActionItem>[],
    ctx: { roomId: string; eventId: string },
): PluginMessageActionView[] {
    const views: PluginMessageActionView[] = [];
    for (const { pluginId, value } of entries) {
        if (value.when) {
            let ok = false;
            try {
                ok = !!value.when(ctx);
            } catch (e) {
                console.error(
                    `[zam] plugin ${pluginId} message-action when() threw`,
                    e,
                );
                ok = false;
            }
            if (!ok) continue;
        }
        views.push({
            key: pluginContribKey(pluginId, value.id),
            label: value.label,
            icon: value.icon,
            run: () => value.onSelect(ctx),
        });
    }
    return views;
}

export interface MessageDecoration {
    /** `plugin:<pluginId>:<entryId>` — unique per registry entry. */
    key: string;
    pluginId: string;
    badge?: string;
    tooltip?: string;
}

/**
 * Run every decorator for one message and collect the non-empty results.
 * A decorator that throws or returns null/undefined is skipped; a result is
 * kept only when it carries a non-empty badge or tooltip. Additive only —
 * the renderer overlays these on the row, never touching body rendering.
 */
export function collectDecorations(
    entries: RegistryEntry<MessageDecorator>[],
    ctx: { roomId: string; eventId: string; senderId: string },
): MessageDecoration[] {
    const out: MessageDecoration[] = [];
    for (const { pluginId, entryId, value } of entries) {
        let res: { badge?: string; tooltip?: string } | null | undefined;
        try {
            res = value(ctx);
        } catch (e) {
            console.error(`[zam] plugin ${pluginId} decorate() threw`, e);
            continue;
        }
        if (!res) continue;
        const badge = typeof res.badge === "string" ? res.badge : undefined;
        const tooltip =
            typeof res.tooltip === "string" ? res.tooltip : undefined;
        if (!badge && !tooltip) continue;
        out.push({
            key: `plugin:${pluginId}:${entryId}`,
            pluginId,
            badge,
            tooltip,
        });
    }
    return out;
}
