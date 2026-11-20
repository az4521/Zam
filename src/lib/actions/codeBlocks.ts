/**
 * Svelte action: clip tall `<pre>` code blocks in a message body to a fixed
 * height and add a "Show more" / "Show less" toggle to the ones that overflow.
 *
 * The cap itself is CSS (MessageItem: `.message-body pre`, max-height from
 * codeBlockCollapse.ts). This action only decides which blocks overflow, adds
 * the toggle bar (a sticky child of the `<pre>`, so it sits over the fade at
 * the visible bottom and never scrolls away), and records expansion per block.
 *
 * Scroll anchoring: expanding only grows the block downward. Timeline rows opt
 * out of native overflow-anchor except the reading-line row (MessageArea), so
 * content above the reader stays put exactly as it does for any other growth.
 * Nothing here writes scrollTop.
 *
 * Expansion lives in a module map keyed by event id + block index, so it
 * survives the body being re-rendered (highlighting, edits, a row remounting
 * during windowing). Nothing is persisted.
 */
import { t } from "$lib/i18n";
import {
    codeBlockCapPx,
    codeBlockKey,
    codeBlockOverflows,
} from "$lib/utils/codeBlockCollapse";

const expandedBlocks = new Map<string, true>();

const TOGGLE_CLASS = "code-block-toggle";
const BUTTON_CLASS = "code-block-toggle-btn";

interface CodeBlocksParams {
    /** The event this body belongs to; empty while a send is still local. */
    key?: string;
}

export function codeBlocks(node: HTMLElement, params?: CodeBlocksParams) {
    let eventKey = params?.key ?? "";
    let frame = 0;

    function rootFontPx(): number {
        if (typeof getComputedStyle === "undefined") return 16;
        return parseFloat(getComputedStyle(document.documentElement).fontSize);
    }

    /** Height the block's text needs, padding and border included. */
    function contentHeight(pre: HTMLElement, code: HTMLElement): number {
        const cs = getComputedStyle(pre);
        const vertical =
            parseFloat(cs.paddingTop) +
            parseFloat(cs.paddingBottom) +
            parseFloat(cs.borderTopWidth) +
            parseFloat(cs.borderBottomWidth);
        return code.offsetHeight + (Number.isFinite(vertical) ? vertical : 0);
    }

    function setToggle(pre: HTMLElement, expanded: boolean) {
        let bar = pre.querySelector<HTMLElement>(`:scope > .${TOGGLE_CLASS}`);
        if (!bar) {
            bar = document.createElement("div");
            bar.className = TOGGLE_CLASS;
            bar.contentEditable = "false";
            const button = document.createElement("button");
            button.type = "button";
            button.className = BUTTON_CLASS;
            bar.appendChild(button);
            pre.appendChild(bar);
        }
        const button = bar.querySelector<HTMLButtonElement>(
            `.${BUTTON_CLASS}`,
        )!;
        button.setAttribute("aria-expanded", String(expanded));
        const label = expanded
            ? t("codeBlock.showLess")
            : t("codeBlock.showMore");
        if (button.textContent !== label) button.textContent = label;
    }

    function scan() {
        frame = 0;
        const cap = codeBlockCapPx(rootFontPx());
        const pres = node.querySelectorAll<HTMLElement>("pre");
        pres.forEach((pre, index) => {
            const code = pre.querySelector<HTMLElement>(":scope > code");
            if (!code) return;
            pre.dataset.codeBlockIndex = String(index);
            const expanded = expandedBlocks.has(codeBlockKey(eventKey, index));
            const overflowing = codeBlockOverflows(
                contentHeight(pre, code),
                cap,
            );
            if (expanded) pre.setAttribute("data-code-expanded", "");
            else pre.removeAttribute("data-code-expanded");
            if (overflowing) {
                setToggle(pre, expanded);
            } else {
                pre.querySelector(`:scope > .${TOGGLE_CLASS}`)?.remove();
            }
        });
    }

    function schedule() {
        if (frame) return;
        frame = requestAnimationFrame(scan);
    }

    function onClick(e: MouseEvent) {
        const target = e.target as Element | null;
        const button = target?.closest?.(`.${BUTTON_CLASS}`);
        if (!button || !node.contains(button)) return;
        const pre = button.closest<HTMLElement>("pre");
        if (!pre || !node.contains(pre)) return;
        const index = Number(pre.dataset.codeBlockIndex);
        if (!Number.isFinite(index)) return;
        const id = codeBlockKey(eventKey, index);
        if (expandedBlocks.has(id)) expandedBlocks.delete(id);
        else expandedBlocks.set(id, true);
        // Synchronous, so the button's label and aria-expanded match the
        // click at once; the observer's follow-up scan then finds nothing new.
        scan();
    }

    node.addEventListener("click", onClick);

    // Re-scan when the body's HTML changes (highlighting, edits, a late
    // decryption) and when its width changes (wrapping changes block height).
    // Our own toggle-bar insertions also trigger the observer; scan is
    // idempotent, so the extra pass changes nothing and stops there.
    const mutations =
        typeof MutationObserver === "undefined"
            ? null
            : new MutationObserver(() => schedule());
    mutations?.observe(node, { childList: true, subtree: true });
    const resizes =
        typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(() => schedule());
    resizes?.observe(node);

    schedule();
    // Code font loads change block heights without changing the body's size.
    void document.fonts?.ready.then(() => schedule());

    return {
        update(next?: CodeBlocksParams) {
            eventKey = next?.key ?? "";
            schedule();
        },
        destroy() {
            node.removeEventListener("click", onClick);
            mutations?.disconnect();
            resizes?.disconnect();
            if (frame) cancelAnimationFrame(frame);
        },
    };
}
