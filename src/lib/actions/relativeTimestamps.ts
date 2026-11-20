/**
 * Keeps the relative (`R` style) inline timestamps in a message body current.
 *
 * The body HTML is rendered once (renderInlineTimestampsHtml); the elements
 * carry `data-zam-ts-unix`. One shared interval refreshes every tracked
 * element. Entries whose element has left the document are dropped on the
 * next tick, so no per-element timer exists and destroy needs no cleanup.
 *
 * Use with the body's rendered HTML as the param, so an update re-scans the
 * elements {@html} just replaced.
 */
import { getLocale } from "$lib/i18n";
import { formatInlineTimestamp } from "$lib/utils/inlineTimestamp";

const TICK_MS = 30_000;

const live = new Map<HTMLElement, number>();
let timer: ReturnType<typeof setInterval> | null = null;

function refresh(el: HTMLElement, seconds: number): void {
    const out = formatInlineTimestamp(seconds, "R", getLocale(), Date.now());
    if (out && el.textContent !== out.text) el.textContent = out.text;
}

function stop(): void {
    if (timer !== null) clearInterval(timer);
    timer = null;
}

function tick(): void {
    for (const [el, seconds] of live) {
        if (!el.isConnected) {
            live.delete(el);
            continue;
        }
        refresh(el, seconds);
    }
    if (live.size === 0) stop();
}

function track(el: HTMLElement): void {
    const seconds = Number(el.dataset.zamTsUnix);
    if (!Number.isFinite(seconds)) return;
    live.set(el, seconds);
    refresh(el, seconds);
    if (timer === null) timer = setInterval(tick, TICK_MS);
}

function scan(node: HTMLElement): void {
    for (const el of node.querySelectorAll<HTMLElement>(
        "time[data-zam-ts-rel]",
    )) {
        track(el);
    }
}

export function relativeTimestamps(node: HTMLElement, html?: unknown) {
    void html;
    scan(node);
    return {
        update(next?: unknown) {
            void next;
            // {@html} may replace the elements after this update runs, so
            // scan again once the current flush has finished.
            scan(node);
            queueMicrotask(() => scan(node));
        },
    };
}
