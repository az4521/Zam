/**
 * The shared custom-UI mount primitive (spec §6 `ui.openPopover`/`registerPanel`).
 * A Svelte action: it runs a plugin's `render(el)` into the host element, keeps
 * the cleanup fn the plugin returns, and runs it once when the element is
 * destroyed (Escape/backdrop/supersede/plugin-disable all unmount the host, so
 * cleanup is tied to DOM lifetime). Every plugin call is try/catch-wrapped so a
 * throwing plugin never crashes Zam. Reused by openPopover now; registerPanel +
 * custom embeds mount through the same action later.
 */
export function pluginMount(
    node: HTMLElement,
    render: (el: HTMLElement) => void | (() => void),
): { destroy(): void } {
    let cleanup: void | (() => void);
    let cleaned = false;
    try {
        cleanup = render(node);
    } catch (e) {
        console.error("[zam] plugin popover render threw", e);
    }
    return {
        destroy() {
            if (cleaned) return;
            cleaned = true;
            try {
                cleanup?.();
            } catch (e) {
                console.error("[zam] plugin popover cleanup threw", e);
            }
        },
    };
}
