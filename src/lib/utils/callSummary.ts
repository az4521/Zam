/**
 * Pure logic that folds MatrixRTC call events (m.call.member membership
 * state + org.matrix.msc4075.call.notify rings) into per-call summary cards
 * for the timeline. SDK-free: callers adapt MatrixEvent -> CallEventInput.
 */

export type CallOutcome = "answered" | "missed" | "ongoing";

export interface CallEventInput {
    eventId: string;
    type: string;
    sender: string;
    stateKey?: string;
    ts: number;
    content: Record<string, unknown>;
    live?: boolean;
}

export interface CallSummary {
    callId: string;
    anchorEventId: string;
    participants: string[];
    startTs: number;
    endTs: number | null;
    durationMs: number | null;
    outcome: CallOutcome;
    notified: boolean;
}

const MEMBER_TYPES = new Set([
    "m.call.member",
    "org.matrix.msc3401.call.member",
    "org.matrix.msc4143.rtc.member",
]);
const NOTIFY_TYPES = new Set([
    "org.matrix.msc4075.call.notify",
    "m.call.notify",
]);

export function isCallMemberEventType(type: string): boolean {
    return MEMBER_TYPES.has(type);
}
export function isCallNotifyEventType(type: string): boolean {
    return NOTIFY_TYPES.has(type);
}
export function isCallEventType(type: string): boolean {
    return isCallMemberEventType(type) || isCallNotifyEventType(type);
}

/** A membership state event with no content (ignoring the sticky-key marker)
 *  is a LEAVE. */
export function isMembershipLeave(content: Record<string, unknown>): boolean {
    return (
        Object.keys(content).filter((k) => k !== "msc4354_sticky_key")
            .length === 0
    );
}

/** Device id from a membership content (session `device_id` or rtc
 *  `member.device_id`). */
export function memberDeviceId(
    content: Record<string, unknown>,
): string | undefined {
    if (typeof content.device_id === "string") return content.device_id;
    const member = content.member;
    if (member && typeof member === "object") {
        const d = (member as Record<string, unknown>).device_id;
        if (typeof d === "string") return d;
    }
    return undefined;
}

/** Grouping key for a call: explicit call_id / slot_id when present, else "". */
export function callEventGroupKey(input: CallEventInput): string {
    const c = input.content;
    if (typeof c.call_id === "string" && c.call_id) return c.call_id;
    if (typeof c.slot_id === "string" && c.slot_id) return c.slot_id;
    return "";
}

/** "M:SS" or "H:MM:SS"; "" for null. */
export function formatCallDuration(ms: number | null): string {
    if (ms == null) return "";
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const two = (n: number) => n.toString().padStart(2, "0");
    return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`;
}

/** Fold one call session's events (assumed to belong to a single call) into a
 *  summary. `events` need not be sorted. */
export function foldCallSession(events: CallEventInput[]): CallSummary {
    const sorted = [...events].sort((a, b) => a.ts - b.ts);
    const anchor = sorted[0];
    const callId = callEventGroupKey(anchor ?? ({} as CallEventInput));
    const notified = sorted.some((e) => isCallNotifyEventType(e.type));

    const members = sorted.filter((e) => isCallMemberEventType(e.type));
    const joins = members.filter((e) => !isMembershipLeave(e.content));

    if (joins.length === 0) {
        return {
            callId,
            anchorEventId: anchor?.eventId ?? "",
            participants: [],
            startTs: anchor?.ts ?? 0,
            endTs: null,
            durationMs: null,
            outcome: "missed",
            notified,
        };
    }

    const participants: string[] = [];
    for (const j of joins)
        if (!participants.includes(j.sender)) participants.push(j.sender);

    const startTs = joins[0].ts;

    // Per device (stateKey): is the device still in the call? Still-in iff its
    // last member event is a JOIN and that join's liveness is not explicitly
    // false.
    const lastByDevice = new Map<string, CallEventInput>();
    for (const m of members) lastByDevice.set(m.stateKey ?? m.eventId, m);
    let anyStillIn = false;
    for (const last of lastByDevice.values()) {
        if (!isMembershipLeave(last.content) && last.live !== false) {
            anyStillIn = true;
            break;
        }
    }

    if (anyStillIn) {
        return {
            callId,
            anchorEventId: anchor.eventId,
            participants,
            startTs,
            endTs: null,
            durationMs: null,
            outcome: "ongoing",
            notified,
        };
    }

    // Ended: last activity ts is the best-available end.
    const endTs = members[members.length - 1].ts;
    return {
        callId,
        anchorEventId: anchor.eventId,
        participants,
        startTs,
        endTs,
        durationMs: Math.max(0, endTs - startTs),
        outcome: "answered",
        notified,
    };
}
