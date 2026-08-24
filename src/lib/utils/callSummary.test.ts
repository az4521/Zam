import { describe, it, expect } from "vitest";
import {
    isCallMemberEventType,
    isCallNotifyEventType,
    isCallEventType,
    isMembershipLeave,
    memberDeviceId,
    formatCallDuration,
    foldCallSession,
    segmentCallSessions,
    summariseCallEvents,
    callAnchorEventIds,
    type CallEventInput,
} from "./callSummary";

const join = (
    over: Partial<CallEventInput> & { eventId: string; ts: number },
): CallEventInput => ({
    type: "m.call.member",
    sender: "@a:s",
    stateKey: "@a:s_DEV",
    content: { call_id: "", device_id: "DEV", application: "m.call" },
    ...over,
});
const leave = (
    over: Partial<CallEventInput> & { eventId: string; ts: number },
): CallEventInput => ({
    type: "m.call.member",
    sender: "@a:s",
    stateKey: "@a:s_DEV",
    content: {},
    ...over,
});
const notify = (
    over: Partial<CallEventInput> & { eventId: string; ts: number },
): CallEventInput => ({
    type: "org.matrix.msc4075.call.notify",
    sender: "@a:s",
    content: { application: "m.call", call_id: "", notify_type: "ring" },
    ...over,
});

describe("type guards", () => {
    it("recognizes member types", () => {
        expect(isCallMemberEventType("m.call.member")).toBe(true);
        expect(isCallMemberEventType("org.matrix.msc3401.call.member")).toBe(
            true,
        );
        expect(isCallMemberEventType("org.matrix.msc4143.rtc.member")).toBe(
            true,
        );
        expect(isCallMemberEventType("m.room.message")).toBe(false);
    });
    it("recognizes notify types", () => {
        expect(isCallNotifyEventType("org.matrix.msc4075.call.notify")).toBe(
            true,
        );
        expect(isCallNotifyEventType("m.call.notify")).toBe(true);
        expect(isCallNotifyEventType("m.call.member")).toBe(false);
    });
    it("isCallEventType is the union", () => {
        expect(isCallEventType("m.call.member")).toBe(true);
        expect(isCallEventType("org.matrix.msc4075.call.notify")).toBe(true);
        expect(isCallEventType("m.sticker")).toBe(false);
    });
});

describe("isMembershipLeave", () => {
    it("empty content is a leave", () => {
        expect(isMembershipLeave({})).toBe(true);
    });
    it("only sticky key is a leave", () => {
        expect(isMembershipLeave({ msc4354_sticky_key: "x" })).toBe(true);
    });
    it("membership content is not a leave", () => {
        expect(isMembershipLeave({ call_id: "", device_id: "DEV" })).toBe(
            false,
        );
    });
});

describe("memberDeviceId", () => {
    it("reads session device_id", () => {
        expect(memberDeviceId({ device_id: "DEV" })).toBe("DEV");
    });
    it("reads rtc member.device_id", () => {
        expect(memberDeviceId({ member: { device_id: "RTC" } })).toBe("RTC");
    });
    it("undefined when absent", () => {
        expect(memberDeviceId({})).toBeUndefined();
    });
});

describe("formatCallDuration", () => {
    it("null -> empty", () => {
        expect(formatCallDuration(null)).toBe("");
    });
    it("seconds under a minute", () => {
        expect(formatCallDuration(42_000)).toBe("0:42");
    });
    it("minutes:seconds", () => {
        expect(formatCallDuration(65_000)).toBe("1:05");
    });
    it("hours:minutes:seconds", () => {
        expect(formatCallDuration(3_723_000)).toBe("1:02:03");
    });
});

describe("foldCallSession", () => {
    it("answered: join then leave", () => {
        const s = foldCallSession([
            join({ eventId: "$1", ts: 1000 }),
            leave({ eventId: "$2", ts: 61000 }),
        ]);
        expect(s.outcome).toBe("answered");
        expect(s.participants).toEqual(["@a:s"]);
        expect(s.startTs).toBe(1000);
        expect(s.endTs).toBe(61000);
        expect(s.durationMs).toBe(60000);
        expect(s.anchorEventId).toBe("$1");
        expect(s.notified).toBe(false);
    });
    it("missed: notify with no join", () => {
        const s = foldCallSession([notify({ eventId: "$1", ts: 1000 })]);
        expect(s.outcome).toBe("missed");
        expect(s.participants).toEqual([]);
        expect(s.startTs).toBe(1000);
        expect(s.endTs).toBeNull();
        expect(s.durationMs).toBeNull();
        expect(s.notified).toBe(true);
        expect(s.anchorEventId).toBe("$1");
    });
    it("ongoing: join, no leave, liveness unknown", () => {
        const s = foldCallSession([join({ eventId: "$1", ts: 1000 })]);
        expect(s.outcome).toBe("ongoing");
        expect(s.endTs).toBeNull();
        expect(s.durationMs).toBeNull();
    });
    it("ongoing: join with live=true", () => {
        const s = foldCallSession([
            join({ eventId: "$1", ts: 1000, live: true }),
        ]);
        expect(s.outcome).toBe("ongoing");
    });
    it("answered: join with live=false, no leave (stale membership)", () => {
        const s = foldCallSession([
            join({ eventId: "$1", ts: 1000, live: false }),
        ]);
        expect(s.outcome).toBe("answered");
        expect(s.endTs).toBe(1000);
        expect(s.durationMs).toBe(0);
    });
    it("multi-participant duration = first-join -> last-leave", () => {
        const s = foldCallSession([
            join({
                eventId: "$1",
                ts: 1000,
                sender: "@a:s",
                stateKey: "@a:s_A",
                content: { device_id: "A" },
            }),
            join({
                eventId: "$2",
                ts: 2000,
                sender: "@b:s",
                stateKey: "@b:s_B",
                content: { device_id: "B" },
            }),
            leave({
                eventId: "$3",
                ts: 5000,
                sender: "@a:s",
                stateKey: "@a:s_A",
            }),
            leave({
                eventId: "$4",
                ts: 8000,
                sender: "@b:s",
                stateKey: "@b:s_B",
            }),
        ]);
        expect(s.outcome).toBe("answered");
        expect(s.participants).toEqual(["@a:s", "@b:s"]);
        expect(s.startTs).toBe(1000);
        expect(s.endTs).toBe(8000);
        expect(s.durationMs).toBe(7000);
    });
    it("notify then answered join then leave: notified, start=join", () => {
        const s = foldCallSession([
            notify({ eventId: "$0", ts: 1000 }),
            join({ eventId: "$1", ts: 1500 }),
            leave({ eventId: "$2", ts: 60000 }),
        ]);
        expect(s.notified).toBe(true);
        expect(s.outcome).toBe("answered");
        expect(s.startTs).toBe(1500);
        expect(s.endTs).toBe(60000);
        expect(s.anchorEventId).toBe("$0");
    });
    it("ongoing wins when one device still in, another left", () => {
        const s = foldCallSession([
            join({
                eventId: "$1",
                ts: 1000,
                live: true,
                sender: "@a:s",
                stateKey: "@a:s_A",
                content: { device_id: "A" },
            }),
            join({
                eventId: "$2",
                ts: 2000,
                live: false,
                sender: "@b:s",
                stateKey: "@b:s_B",
                content: { device_id: "B" },
            }),
            leave({
                eventId: "$3",
                ts: 3000,
                sender: "@b:s",
                stateKey: "@b:s_B",
            }),
        ]);
        expect(s.outcome).toBe("ongoing");
        expect(s.endTs).toBeNull();
    });
});

describe("segmentCallSessions", () => {
    it("splits two sequential room-scoped calls", () => {
        const segs = segmentCallSessions([
            join({ eventId: "$1", ts: 1000 }),
            leave({ eventId: "$2", ts: 2000 }),
            join({ eventId: "$3", ts: 100000, stateKey: "@a:s_DEV" }),
            leave({ eventId: "$4", ts: 101000 }),
        ]);
        expect(segs.length).toBe(2);
        expect(segs[0].map((e) => e.eventId)).toEqual(["$1", "$2"]);
        expect(segs[1].map((e) => e.eventId)).toEqual(["$3", "$4"]);
    });
    it("keeps distinct call_id values separate", () => {
        const segs = segmentCallSessions([
            join({
                eventId: "$1",
                ts: 1000,
                content: { call_id: "abc", device_id: "A" },
                stateKey: "@a:s_A",
            }),
            join({
                eventId: "$2",
                ts: 1100,
                content: { call_id: "def", device_id: "B" },
                sender: "@b:s",
                stateKey: "@b:s_B",
            }),
        ]);
        expect(segs.length).toBe(2);
    });
    it("pairs a ring with a join inside the window", () => {
        const segs = segmentCallSessions(
            [
                notify({ eventId: "$0", ts: 1000 }),
                join({ eventId: "$1", ts: 5000 }),
            ],
            { ringPairWindowMs: 60000 },
        );
        expect(segs.length).toBe(1);
        expect(segs[0].map((e) => e.eventId)).toEqual(["$0", "$1"]);
    });
    it("does not pair a ring with a join outside the window", () => {
        const segs = segmentCallSessions(
            [
                notify({ eventId: "$0", ts: 1000 }),
                join({ eventId: "$1", ts: 100000 }),
            ],
            { ringPairWindowMs: 60000 },
        );
        expect(segs.length).toBe(2);
    });
    it("does not throw on a leave with no prior join", () => {
        expect(() =>
            segmentCallSessions([leave({ eventId: "$1", ts: 1000 })]),
        ).not.toThrow();
    });
});

describe("summariseCallEvents / callAnchorEventIds", () => {
    it("summarises a missed then an answered call", () => {
        const summaries = summariseCallEvents([
            notify({ eventId: "$0", ts: 1000 }),
            join({ eventId: "$1", ts: 100000 }),
            leave({ eventId: "$2", ts: 160000 }),
        ]);
        expect(summaries.length).toBe(2);
        expect(summaries[0].outcome).toBe("missed");
        expect(summaries[1].outcome).toBe("answered");
    });
    it("anchor ids are the earliest event per call", () => {
        const ids = callAnchorEventIds([
            join({ eventId: "$1", ts: 1000 }),
            leave({ eventId: "$2", ts: 2000 }),
            join({ eventId: "$3", ts: 100000, stateKey: "@a:s_DEV" }),
            leave({ eventId: "$4", ts: 101000 }),
        ]);
        expect([...ids].sort()).toEqual(["$1", "$3"]);
    });
});
