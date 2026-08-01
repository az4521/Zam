/**
 * Svelte action: make `[data-mx-spoiler]` spans toggle-reveal on click.
 *
 * Delegated on purpose. MessageItem is instantiated once per timeline row, and
 * the previous implementation branded every spoiler span with its own listener
 * and then kept a per-row MutationObserver alive so that `{@html}` content
 * replaced by an edit or a late decryption would get listeners too. That is two
 * per-row costs (a subtree observer plus a querySelectorAll sweep) for a feature
 * most rows never use. One delegated listener resolves its target at click time,
 * so content that does not exist yet is handled for free.
 *
 * Bubbling is reproduced deliberately: with per-element listeners a click inside
 * a nested spoiler toggled the inner span AND every spoiler ancestor, so the
 * walk toggles every marked ancestor up to (not including) the action's node.
 */
export function spoilers(node: HTMLElement) {
    function onClick(e: MouseEvent) {
        let el = e.target as Element | null;
        while (el && el !== node) {
            if (el instanceof HTMLElement && "mxSpoiler" in el.dataset) {
                el.classList.toggle("revealed");
            }
            el = el.parentElement;
        }
    }
    node.addEventListener("click", onClick);
    return {
        destroy() {
            node.removeEventListener("click", onClick);
        },
    };
}
