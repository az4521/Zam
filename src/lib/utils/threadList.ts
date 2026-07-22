// src/lib/utils/threadList.ts
/**
 * Pure sort + preview shaping for the room threads-list panel. SDK-free so the
 * ordering and text-shaping rules are table-testable independent of the live
 * `Thread` objects (which `getRoomThreads` maps into `ThreadInfo`).
 */

/** Raw view model emitted by `getRoomThreads` (previews are raw message bodies). */
export interface ThreadInfo {
    rootId: string;
    rootSenderId: string | null;
    rootPreview: string;
    replyCount: number;
    latestTs: number;
    latestPreview: string;
    participated: boolean;
}

/** Display-ready list item (previews shaped/truncated/fallback-filled). */
export interface ThreadListItem {
    rootId: string;
    rootSenderId: string | null;
    rootPreview: string;
    replyCount: number;
    latestTs: number;
    latestPreview: string;
    participated: boolean;
}

const MAX_PREVIEW_LEN = 120;
const EMPTY_PREVIEW = "(no preview)";

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
        .map(
            (t): ThreadListItem => ({
                rootId: t.rootId,
                rootSenderId: t.rootSenderId,
                rootPreview: shapePreview(t.rootPreview),
                replyCount: t.replyCount,
                latestTs: t.latestTs,
                latestPreview: shapePreview(t.latestPreview),
                participated: t.participated,
            }),
        )
        .sort((a, b) => {
            if (b.latestTs !== a.latestTs) return b.latestTs - a.latestTs;
            return a.rootId < b.rootId ? -1 : a.rootId > b.rootId ? 1 : 0;
        });
}
