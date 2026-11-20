/**
 * Offering to rejoin a call after the app was closed, reloaded or crashed
 * mid-call. While in a call the store writes a small record (per account)
 * and refreshes its heartbeat; a deliberate leave or the call ending clears
 * it. On the next start the record says there was a call, and the decision
 * here says whether to offer a rejoin. Pure: no SDK, no storage, no clock.
 */

/** Per-account localStorage base key for the record (scopedStorage). */
export const CALL_RECORD_KEY = "zam.activeCall";

/** A heartbeat older than this means the app was gone too long to rejoin. */
export const CALL_RECORD_MAX_AGE_MS = 10 * 60_000;

/** How often the heartbeat is refreshed while in a call. */
export const CALL_HEARTBEAT_MS = 60_000;

export type CallRecordKind = "voice" | "video";

export interface CallRecord {
    roomId: string;
    /** When this call first connected. */
    joinedAt: number;
    /** Last time the app was seen in this call. */
    heartbeat: number;
    kind: CallRecordKind;
}

/** A MatrixRTC membership reduced to what the decision needs. */
export interface CallMembershipRef {
    userId: string;
    deviceId: string;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

/** The stored record, or null when absent or malformed. */
export function parseCallRecord(raw: string | null): CallRecord | null {
    if (!raw) return null;
    try {
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== "object") return null;
        const { roomId, joinedAt, heartbeat, kind } = value as Record<
            string,
            unknown
        >;
        if (typeof roomId !== "string" || roomId === "") return null;
        if (!isFiniteNumber(joinedAt) || !isFiniteNumber(heartbeat))
            return null;
        if (kind !== "voice" && kind !== "video") return null;
        return { roomId, joinedAt, heartbeat, kind };
    } catch {
        return null;
    }
}

/** The record a heartbeat writes for a call we are in. */
export function buildCallRecord(input: {
    roomId: string;
    joinedAt: number;
    now: number;
    video: boolean;
}): CallRecord {
    return {
        roomId: input.roomId,
        joinedAt: input.joinedAt,
        heartbeat: input.now,
        kind: input.video ? "video" : "voice",
    };
}

/** Whether anyone other than this device is in the call's memberships. Our
 *  own stale membership from before the restart does not count. */
export function hasOtherCallParticipants(
    memberships: readonly CallMembershipRef[],
    self: { userId: string | null; deviceId: string | null },
): boolean {
    return memberships.some(
        (m) => !(m.userId === self.userId && m.deviceId === self.deviceId),
    );
}

/** Whether a record is stale or unusable and should be dropped. */
export function isCallRecordExpired(record: CallRecord, now: number): boolean {
    const age = now - record.heartbeat;
    return age < 0 || age > CALL_RECORD_MAX_AGE_MS;
}

export interface RejoinInput {
    record: CallRecord | null;
    now: number;
    /** We are still a member of the record's room. */
    roomJoined: boolean;
    /** The call in that room still has someone else in it. */
    othersInCall: boolean;
    /** This session is already in a call (no prompt over a live call). */
    alreadyInCall: boolean;
}

/** Offer a rejoin only for a recent record whose room is still joined and
 *  whose call still has someone in it. Never joins by itself. */
export function shouldOfferRejoin(input: RejoinInput): boolean {
    const { record, now } = input;
    if (!record) return false;
    if (input.alreadyInCall) return false;
    if (isCallRecordExpired(record, now)) return false;
    return input.roomJoined && input.othersInCall;
}
