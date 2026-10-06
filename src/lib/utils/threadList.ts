// src/lib/utils/threadList.ts
/**
 * Pure sort + preview shaping for the room threads-list panel. SDK-free so the
 * ordering and text-shaping rules are table-testable independent of the live
 * `Thread` objects (which `getRoomThreads` maps into `ThreadInfo`).
 */

/** Raw view model emitted by `getRoomThreads` (previews are raw message bodies). */
import { t } from "$lib/i18n";
export interface ThreadInfo {
    rootId: string;
    /** The thread's name (utils/threadName), or null when unnamed. */
    name: string | null;
    rootSenderId: string | null;
    rootPreview: string;
    replyCount: number;
    latestTs: number;
    latestPreview: string;
    participated: boolean;
    unreadTotal: number;
    unreadHighlight: number;
}

/** Display-ready list item (previews shaped/truncated/fallback-filled). */
export interface ThreadListItem {
    rootId: string;
    name: string | null;
    rootSenderId: string | null;
    rootPreview: string;
    replyCount: number;
    latestTs: number;
    latestPreview: string;
    participated: boolean;
    unreadTotal: number;
    unreadHighlight: number;
}

const MAX_PREVIEW_LEN = 120;
const EMPTY_PREVIEW = t("threadList.noPreview");

/** Collapse whitespace, trim, fall back when empty, and bound the length. */
function shapePreview(raw: string): string {
    const collapsed = raw.replace(/\s+/g, " ").trim();
    if (collapsed.length === 0) return EMPTY_PREVIEW;
    if (collapsed.length > MAX_PREVIEW_LEN) {
        return collapsed.slice(0, MAX_PREVIEW_LEN) + "…";
    }
    return collapsed;
}

/**
 * Sort threads by most-recent activity (latestTs desc, tiebreak rootId asc for
 * a stable deterministic order) and shape their preview text. Never mutates the
 * input; tolerates missing sender (null), zero ts, and empty previews.
 */
export function buildThreadListItems(threads: ThreadInfo[]): ThreadListItem[] {
    return threads
        .map((t): ThreadListItem => ({
            rootId: t.rootId,
            name: t.name,
            rootSenderId: t.rootSenderId,
            rootPreview: shapePreview(t.rootPreview),
            replyCount: t.replyCount,
            latestTs: t.latestTs,
            latestPreview: shapePreview(t.latestPreview),
            participated: t.participated,
            unreadTotal: t.unreadTotal,
            unreadHighlight: t.unreadHighlight,
        }))
        .sort((a, b) => {
            if (b.latestTs !== a.latestTs) return b.latestTs - a.latestTs;
            return a.rootId < b.rootId ? -1 : a.rootId > b.rootId ? 1 : 0;
        });
}

export type ThreadListFilter = "all" | "mine";

/**
 * The threads-list filter: "all" keeps every thread, "mine" only those the
 * current user started or replied in (Element's "My threads").
 */
export function filterThreadListItems(
    items: ThreadListItem[],
    filter: ThreadListFilter,
): ThreadListItem[] {
    return filter === "mine" ? items.filter((i) => i.participated) : items;
}
