// src/lib/plugins/embeds.ts
/**
 * Custom-embed subsystem (spec §6 `messages.registerEmbed`, §7). ADDITIVE: an
 * embed renders a nicer card for a matching URL; no match → the normal link
 * preview still shows and the inbound message body/link (rendered in
 * MessageItem) is never touched (interop, spec §2). The resolver is pure; the
 * mount action (Task 2) touches the DOM only inside its body, so this module
 * imports no SDK/client.ts — it stays inside the plugin boundary.
 */
import type { RegistryEntry } from "./registry";
import type { MessageEmbed } from "./types";

/**
 * First registered embed whose `match(url)` returns truthy, in registry order
 * (plugins append after each other; there is no core embed). Returns the whole
 * entry so the caller can key on `entryId` and call `value.render`. A `match`
 * that throws is treated as no-match — a buggy full-trust plugin must never
 * break the preview pipeline.
 */
export function resolveEmbed(
    entries: RegistryEntry<MessageEmbed>[],
    url: string,
): RegistryEntry<MessageEmbed> | null {
    for (const e of entries) {
        let ok = false;
        try {
            ok = !!e.value.match(url);
        } catch (err) {
            console.error(
                `[zam] plugin ${e.pluginId} embed match() threw`,
                err,
            );
            ok = false;
        }
        if (ok) return e;
    }
    return null;
}
