import { motionOK } from "$lib/utils/motionPreference";

/** How long after one avatar goes that a new one for the same reader still
 *  counts as the same receipt moving. Both happen in one render. */
const MOVE_WINDOW_MS = 300;
const GLIDE_MS = 300;

// Where each reader's avatar last was, keyed by room and user, recorded just
// before it is removed from the row it left.
const lastSeen = new Map<string, { x: number; y: number; at: number }>();

/** The key the avatars of one reader share across rows. */
export function receiptGlideKey(roomId: string, userId: string): string {
    return `${roomId}|${userId}`;
}

/**
 * Note where the avatars in `cluster` that are about to go are. Call it from
 * a `$effect.pre`, before the render removes them: Svelte detaches an
 * element before its action's destroy runs, so by then it has no position.
 * `staying` holds the keys that remain in this row.
 */
export function noteLeavingReceipts(
    cluster: HTMLElement | null,
    staying: ReadonlySet<string>,
): void {
    if (!cluster?.isConnected) return;
    const now = performance.now();
    for (const [k, v] of lastSeen)
        if (now - v.at > MOVE_WINDOW_MS) lastSeen.delete(k);
    for (const el of cluster.querySelectorAll<HTMLElement>(
        "[data-receipt-key]",
    )) {
        const key = el.dataset.receiptKey!;
        if (staying.has(key)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        lastSeen.set(key, { x: r.left, y: r.top, at: now });
    }
}

/**
 * Svelte action for a read-receipt avatar (with `data-receipt-key`): when a
 * reader's receipt moves to another message, the avatar glides there from
 * the row it left instead of jumping. Each row draws its own avatars, so the
 * one that leaves and the one that arrives are different elements; they are
 * paired by key through noteLeavingReceipts.
 */
export function receiptGlide(node: HTMLElement) {
    // A microtask, so the row it left has had its pre-effect. Still before
    // the paint.
    queueMicrotask(() => {
        if (!node.isConnected) return;
        const key = node.dataset.receiptKey;
        const from = key ? lastSeen.get(key) : undefined;
        if (!key || !from) return;
        lastSeen.delete(key);
        if (performance.now() - from.at > MOVE_WINDOW_MS || !motionOK()) return;
        const to = node.getBoundingClientRect();
        const dx = from.x - to.left;
        const dy = from.y - to.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        node.animate(
            [
                { transform: `translate(${dx}px, ${dy}px)` },
                { transform: "none" },
            ],
            { duration: GLIDE_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
        );
    });
}
