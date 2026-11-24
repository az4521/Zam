import { describe, expect, it } from "vitest";
import {
    delayUntil,
    fromDateTimeLocal,
    MIN_SCHEDULE_DELAY_MS,
    prunePreviews,
    schedulePresets,
    toDateTimeLocal,
    toScheduledMessages,
    type DelayedEventItem,
} from "./scheduledMessages";

const item = (over: Partial<DelayedEventItem>): DelayedEventItem => ({
    delayId: "d1",
    roomId: "!r:x",
    type: "m.room.message",
    content: { msgtype: "m.text", body: "hi" },
    delay: 1000,
    runningSince: 5000,
    ...over,
});

describe("toScheduledMessages", () => {
    it("keeps timeline messages, soonest first, with send time", () => {
        const out = toScheduledMessages(
            [
                item({ delayId: "late", delay: 9000 }),
                item({ delayId: "soon", delay: 100 }),
            ],
            {},
        );
        expect(out.map((m) => [m.delayId, m.sendAt])).toEqual([
            ["soon", 5100],
            ["late", 14000],
        ]);
        expect(out[0].body).toBe("hi");
        expect(out[0].encrypted).toBe(false);
    });

    it("drops delayed state events and other event types", () => {
        const out = toScheduledMessages(
            [
                item({
                    delayId: "call",
                    type: "org.matrix.msc3401.call.member",
                    stateKey: "_@me:x",
                }),
                item({ delayId: "widget", type: "com.example.widget" }),
                item({ delayId: "msg" }),
            ],
            {},
        );
        expect(out.map((m) => m.delayId)).toEqual(["msg"]);
    });

    it("previews encrypted messages from this device's record only", () => {
        const enc = item({
            delayId: "e",
            type: "m.room.encrypted",
            content: { algorithm: "m.megolm.v1.aes-sha2", ciphertext: "x" },
        });
        expect(toScheduledMessages([enc], {})[0].body).toBeNull();
        expect(
            toScheduledMessages([enc], { e: { body: "secret" } })[0],
        ).toMatchObject({ encrypted: true, body: "secret" });
    });
});

describe("prunePreviews", () => {
    it("keeps only previews of messages still scheduled", () => {
        const live = toScheduledMessages([item({ delayId: "a" })], {});
        expect(
            prunePreviews({ a: { body: "1" }, gone: { body: "2" } }, live),
        ).toEqual({ a: { body: "1" } });
    });
});

describe("delayUntil", () => {
    it("never asks for less than the minimum", () => {
        expect(delayUntil(1000, 5000)).toBe(MIN_SCHEDULE_DELAY_MS);
        expect(delayUntil(100_000, 0)).toBe(100_000);
    });
});

describe("schedulePresets", () => {
    // 2026-11-24 is a Tuesday.
    it("offers evening, tomorrow and Monday on a Tuesday afternoon", () => {
        const now = new Date(2026, 10, 24, 14, 30);
        const p = schedulePresets(now);
        expect(p.map((x) => x.key)).toEqual([
            "inOneHour",
            "thisEvening",
            "tomorrowMorning",
            "mondayMorning",
        ]);
        expect(new Date(p[1].at).getHours()).toBe(18);
        expect(new Date(p[2].at).getDate()).toBe(25);
        const monday = new Date(p[3].at);
        expect([monday.getDay(), monday.getDate(), monday.getHours()]).toEqual([
            1, 30, 9,
        ]);
    });

    it("skips this evening after 17:00 and Monday on a Sunday", () => {
        const sunday = new Date(2026, 10, 29, 20, 0);
        expect(schedulePresets(sunday).map((x) => x.key)).toEqual([
            "inOneHour",
            "tomorrowMorning",
        ]);
    });

    it("on a Monday, next Monday is a week away", () => {
        const monday = new Date(2026, 10, 30, 10, 0);
        const p = schedulePresets(monday).find(
            (x) => x.key === "mondayMorning",
        )!;
        expect(new Date(p.at).getDate()).toBe(7);
    });
});

describe("datetime-local round trip", () => {
    it("formats and parses local time", () => {
        const ms = new Date(2026, 0, 5, 7, 9).getTime();
        expect(toDateTimeLocal(ms)).toBe("2026-01-05T07:09");
        expect(fromDateTimeLocal("2026-01-05T07:09")).toBe(ms);
        expect(fromDateTimeLocal("")).toBeNull();
    });
});
