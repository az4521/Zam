/**
 * Pure fold of plugin outgoing transforms (spec §6/§7). Text transforms run
 * over the composed message text; content transforms run over the fully-built
 * event content — both sender-side, both interop-safe (sent content stays
 * spec-standard). A transform that throws or returns the wrong type is skipped
 * (keep the prior value) so one bad plugin never breaks the send path. Types
 * only — no SDK/DOM imports.
 */
import type {
    OutgoingTextTransform,
    OutgoingContentTransform,
    PreviewUrlTransform,
} from "./types";

export function applyTextTransforms(
    text: string,
    transforms: OutgoingTextTransform[],
    ctx: { roomId: string },
): string {
    let out = text;
    for (const fn of transforms) {
        try {
            const next = fn(out, ctx);
            if (typeof next === "string") out = next;
        } catch (e) {
            console.error("[zam] outgoing text transform threw", e);
        }
    }
    return out;
}

export function applyContentTransforms(
    content: Record<string, unknown>,
    transforms: OutgoingContentTransform[],
    ctx: { roomId: string },
): Record<string, unknown> {
    let out = content;
    for (const fn of transforms) {
        try {
            const next = fn(out, ctx);
            if (next && typeof next === "object" && !Array.isArray(next)) {
                out = next as Record<string, unknown>;
            }
        } catch (e) {
            console.error("[zam] outgoing content transform threw", e);
        }
    }
    return out;
}

/**
 * Fold of the link-preview URL rewrites. A result that is not an http(s) URL
 * is skipped like a throw: the homeserver is only ever asked about web pages.
 */
export function applyPreviewUrlTransforms(
    url: string,
    transforms: PreviewUrlTransform[],
): string {
    let out = url;
    for (const fn of transforms) {
        try {
            const next = fn(out);
            if (typeof next === "string" && /^https?:\/\/[^/\s]/i.test(next))
                out = next;
        } catch (e) {
            console.error("[zam] preview URL transform threw", e);
        }
    }
    return out;
}
