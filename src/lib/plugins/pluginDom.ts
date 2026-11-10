/**
 * `zam.dom`: plugin access to Zam's own DOM through a few stable hooks
 * (`data-zam-region`, `data-event-id`, ...) instead of Tailwind classes and
 * nesting depth. One MutationObserver on <body> serves every plugin's
 * `observe()`; `style()` remembers what it overwrote so disposing (or the
 * plugin unloading) puts it back. Every plugin callback is try/catch-wrapped.
 */
import type { Disposable, DomObserver, ZamRegion } from "./types";

export const ZAM_REGIONS: readonly ZamRegion[] = [
    "app",
    "space-sidebar",
    "room-list",
    "room-header",
    "timeline",
    "composer",
    "member-list",
];

export function regionElement(name: ZamRegion): HTMLElement | null {
    if (!ZAM_REGIONS.includes(name)) return null;
    return document.querySelector<HTMLElement>(`[data-zam-region="${name}"]`);
}

export function messageElement(eventId: string): HTMLElement | null {
    if (typeof eventId !== "string" || eventId === "") return null;
    return document.querySelector<HTMLElement>(
        `[data-zam-region="timeline"] [data-event-id="${CSS.escape(eventId)}"]`,
    );
}

interface Watch {
    selector: string;
    observer: DomObserver;
    /** Matched elements and the cleanup each `added` returned. */
    seen: Map<HTMLElement, (() => void) | undefined>;
}

const watches = new Set<Watch>();
let mutationObserver: MutationObserver | null = null;
let scanQueued = false;

function runCleanup(fn: (() => void) | undefined): void {
    try {
        fn?.();
    } catch (e) {
        console.error("[zam] dom.observe cleanup threw", e);
    }
}

function scan(w: Watch): void {
    let matches: NodeListOf<HTMLElement>;
    try {
        matches = document.querySelectorAll<HTMLElement>(w.selector);
    } catch {
        return;
    }
    const now = new Set<HTMLElement>(matches);
    for (const [el, cleanup] of w.seen) {
        if (!now.has(el) || !el.isConnected) {
            w.seen.delete(el);
            runCleanup(cleanup);
        }
    }
    for (const el of now) {
        if (w.seen.has(el)) continue;
        let cleanup: void | (() => void) = undefined;
        try {
            cleanup = w.observer.added(el);
        } catch (e) {
            console.error("[zam] dom.observe added threw", e);
        }
        w.seen.set(el, typeof cleanup === "function" ? cleanup : undefined);
    }
}

// Batched to one scan per frame: a timeline re-render adds hundreds of nodes
// in one go, and a full querySelectorAll per watch is cheaper than walking
// every added subtree.
function queueScan(): void {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
        scanQueued = false;
        for (const w of [...watches]) scan(w);
    });
}

export function observeDom(
    selector: string,
    observer: DomObserver,
): Disposable {
    // Throws a SyntaxError for a bad selector here, where the plugin can see
    // it, rather than silently inside the frame callback.
    document.querySelector(selector);
    const w: Watch = { selector, observer, seen: new Map() };
    watches.add(w);
    if (!mutationObserver) {
        mutationObserver = new MutationObserver(queueScan);
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "data-event-id", "data-zam-region"],
        });
    }
    scan(w);
    return {
        dispose() {
            if (!watches.delete(w)) return;
            for (const cleanup of w.seen.values()) runCleanup(cleanup);
            w.seen.clear();
            if (watches.size === 0 && mutationObserver) {
                mutationObserver.disconnect();
                mutationObserver = null;
            }
        },
    };
}

export function styleElement(
    el: HTMLElement,
    props: Record<string, string>,
): Disposable {
    const before: [string, string, string][] = [];
    for (const [name, value] of Object.entries(props)) {
        before.push([
            name,
            el.style.getPropertyValue(name),
            el.style.getPropertyPriority(name),
        ]);
        el.style.setProperty(name, String(value));
    }
    return {
        dispose() {
            for (const [name, value, priority] of before.reverse()) {
                if (value) el.style.setProperty(name, value, priority);
                else el.style.removeProperty(name);
            }
        },
    };
}
