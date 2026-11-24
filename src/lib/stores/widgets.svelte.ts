import { readScoped, writeScoped } from "$lib/utils/scopedStorage";
import type { RoomWidget } from "$lib/utils/widgets";

/** Which widget is open in which room, and a counter for widget list changes. */
export const widgetsState = $state<{
    tick: number;
    activeWidgetId: string | null;
    activeRoomId: string | null;
}>({
    tick: 0,
    activeWidgetId: null,
    activeRoomId: null,
});

export function bumpWidgetsTick(): void {
    widgetsState.tick++;
}

export function setActiveWidget(
    roomId: string | null,
    widgetId: string | null,
): void {
    widgetsState.activeRoomId = roomId;
    widgetsState.activeWidgetId = widgetId;
}

/** What the user decided for one widget in one room. */
export interface WidgetApproval {
    /** Whether the widget may load at all. */
    load: boolean;
    /** Capabilities the user approved. */
    capabilities: string[];
    /** Capabilities the user refused. Refused ones are not asked again. */
    denied: string[];
    /** Identity (OpenID) decision, or null when not asked yet. */
    openId: boolean | null;
}

const APPROVALS_KEY = "zam_widget_approvals";

type ApprovalMap = Record<string, WidgetApproval>;

function approvalKey(
    roomId: string,
    w: Pick<RoomWidget, "id" | "url">,
): string {
    // The raw url is part of the key, so a changed url asks again.
    return `${roomId}|${w.id}|${w.url}`;
}

/** Reads one stored record. Records written before `denied` existed read as
 *  having no refusals. Returns null for anything malformed. */
function normalizeApproval(value: unknown): WidgetApproval | null {
    if (typeof value !== "object" || value === null) return null;
    const a = value as Record<string, unknown>;
    if (
        typeof a.load !== "boolean" ||
        !Array.isArray(a.capabilities) ||
        !a.capabilities.every((c) => typeof c === "string") ||
        !(a.openId === null || typeof a.openId === "boolean")
    )
        return null;
    const capabilities = a.capabilities as string[];
    const denied = Array.isArray(a.denied)
        ? a.denied.filter(
              (c): c is string =>
                  typeof c === "string" && !capabilities.includes(c),
          )
        : [];
    return {
        load: a.load,
        capabilities: [...capabilities],
        denied,
        openId: a.openId as boolean | null,
    };
}

function readApprovals(userId: string | null): ApprovalMap {
    try {
        const raw = readScoped(APPROVALS_KEY, userId);
        if (!raw) return {};
        const parsed: unknown = JSON.parse(raw);
        if (
            typeof parsed !== "object" ||
            parsed === null ||
            Array.isArray(parsed)
        )
            return {};
        const out: ApprovalMap = {};
        for (const [key, value] of Object.entries(
            parsed as Record<string, unknown>,
        )) {
            const approval = normalizeApproval(value);
            if (approval) out[key] = approval;
        }
        return out;
    } catch {
        return {};
    }
}

function writeApprovals(userId: string | null, map: ApprovalMap): void {
    writeScoped(APPROVALS_KEY, userId, JSON.stringify(map));
}

export function getWidgetApproval(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
): WidgetApproval | null {
    return readApprovals(userId)[approvalKey(roomId, w)] ?? null;
}

export function setWidgetApproval(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
    a: WidgetApproval,
): void {
    const map = readApprovals(userId);
    map[approvalKey(roomId, w)] = {
        load: a.load,
        capabilities: [...a.capabilities],
        denied: [...a.denied],
        openId: a.openId,
    };
    writeApprovals(userId, map);
}

export function forgetWidgetApproval(
    userId: string | null,
    roomId: string,
    w: RoomWidget,
): void {
    const map = readApprovals(userId);
    const key = approvalKey(roomId, w);
    if (!(key in map)) return;
    delete map[key];
    writeApprovals(userId, map);
}
