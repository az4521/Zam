import { describe, it, expect } from "vitest";
import {
    STICKY_MAX_DURATION_MS,
    activeStickyEvents,
    emulateStickyMarker,
} from "./stickyEmulation";

const NOW = 10_000_000;
const RTC = "org.matrix.msc4143.rtc.member";

function ev(over: Record<string, unknown> = {}) {
    return {
        type: RTC,
        sender: "@a:example.org",
        origin_server_ts: NOW - 1000,
        content: { msc4354_sticky_key: "m1" } as Record<string, unknown>,
        ...over,
    };
}

describe("emulateStickyMarker", () => {
    it("adds the marker to an event with a sticky key and no marker", () => {
        expect(emulateStickyMarker(ev())).toMatchObject({
            msc4354_sticky: { duration_ms: STICKY_MAX_DURATION_MS },
        });
    });

    it("keeps a marker the server sent", () => {
        const e = emulateStickyMarker(
            ev({ msc4354_sticky: { duration_ms: 5000 } }),
        );
        expect(e).toMatchObject({ msc4354_sticky: { duration_ms: 5000 } });
        const s = emulateStickyMarker(ev({ sticky: { duration_ms: 7000 } }));
        expect(s).not.toHaveProperty("msc4354_sticky");
    });

    it("leaves events without a sticky key alone", () => {
        expect(emulateStickyMarker(ev({ content: {} }))).not.toHaveProperty(
            "msc4354_sticky",
        );
        expect(
            emulateStickyMarker(ev({ content: { msc4354_sticky_key: "" } })),
        ).not.toHaveProperty("msc4354_sticky");
    });
});

describe("activeStickyEvents", () => {
    const mark = (e: ReturnType<typeof ev>) => emulateStickyMarker(e);

    it("keeps the latest event per sender, type and key, oldest first", () => {
        const join = mark(ev({ origin_server_ts: NOW - 5000 }));
        const leave = mark(
            ev({
                origin_server_ts: NOW - 2000,
                content: { msc4354_sticky_key: "m1", membership: "leave" },
            }),
        );
        const other = mark(
            ev({
                sender: "@b:example.org",
                origin_server_ts: NOW - 3000,
            }),
        );
        // History arrives newest first.
        expect(activeStickyEvents([leave, other, join], NOW)).toEqual([
            other,
            leave,
        ]);
    });

    it("drops expired events and events without a marker", () => {
        const old = mark(
            ev({ origin_server_ts: NOW - STICKY_MAX_DURATION_MS - 1 }),
        );
        const short = ev({
            msc4354_sticky: { duration_ms: 500 },
            content: { msc4354_sticky_key: "m2" },
        });
        const plain = ev({ content: { msc4354_sticky_key: "m3" } });
        expect(activeStickyEvents([old, short, plain], NOW)).toEqual([]);
    });

    it("caps a sender's duration at the MSC maximum", () => {
        const e = ev({
            origin_server_ts: NOW - STICKY_MAX_DURATION_MS - 10,
            msc4354_sticky: { duration_ms: STICKY_MAX_DURATION_MS * 10 },
        });
        expect(activeStickyEvents([e], NOW)).toEqual([]);
    });
});
