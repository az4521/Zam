/**
 * Pure shaper for `zam.matrix.getRecentMessages`. client.ts extracts each
 * renderable MatrixEvent into a plain PluginTimelineRecord; this util applies
 * the limit + isOwn logic with zero SDK/DOM imports (the countReactions
 * pattern). Never returns live SDK objects.
 */
export interface PluginTimelineRecord {
    eventId: string;
    sender: string;
    msgtype: string;
    body: string;
    timestamp: number;
    isRedacted: boolean;
}

export interface PluginTimelineMessageShape extends PluginTimelineRecord {
    isOwn: boolean;
}

export const DEFAULT_RECENT_LIMIT = 20;
export const MAX_RECENT_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
    if (limit === undefined) return DEFAULT_RECENT_LIMIT;
    if (!Number.isFinite(limit)) return 1;
    const floored = Math.floor(limit);
    if (floored < 1) return 1;
    if (floored > MAX_RECENT_LIMIT) return MAX_RECENT_LIMIT;
    return floored;
}

export function selectRecentMessages(
    records: PluginTimelineRecord[],
    limit?: number,
    ownUserId?: string | null,
): PluginTimelineMessageShape[] {
    const n = clampLimit(limit);
    // slice(-n) is non-mutating and returns the last n in original order.
    return records.slice(-n).map((r) => ({
        ...r,
        isOwn: ownUserId != null && r.sender === ownUserId,
    }));
}
