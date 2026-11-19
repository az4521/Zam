import { describe, expect, it } from "vitest";
import {
    decodeShareHealth,
    encodeShareHealth,
    SHARE_CAP_FLOOR,
    SHARE_HEALTH_TTL_MS,
    ShareRateCap,
    shareHealthBetween,
    shareHealthCongested,
} from "./shareViewerFeedback";

const ok = { loss: 0, paused: false, freezes: 0 };
const bad = { loss: 0.05, paused: false, freezes: 0 };
const paused = { loss: 0, paused: true, freezes: 0 };

describe("share health reports", () => {
    it("round-trips", () => {
        const h = { loss: 0.0345, paused: true, freezes: 2 };
        expect(decodeShareHealth(encodeShareHealth(h))).toEqual({
            loss: 0.035,
            paused: true,
            freezes: 2,
        });
    });

    it("rejects malformed payloads", () => {
        const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
        expect(
            decodeShareHealth(enc({ loss: "x", paused: false, freezes: 0 })),
        ).toBeNull();
        expect(decodeShareHealth(enc({ loss: 0, freezes: 0 }))).toBeNull();
        expect(decodeShareHealth(enc(null))).toBeNull();
        expect(decodeShareHealth(new TextEncoder().encode("{"))).toBeNull();
        expect(decodeShareHealth(new Uint8Array(300))).toBeNull();
    });

    it("clamps values", () => {
        const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
        expect(
            decodeShareHealth(enc({ loss: 3, paused: false, freezes: -1 })),
        ).toEqual({
            loss: 1,
            paused: false,
            freezes: 0,
        });
    });

    it("counts pauses and loss over 2% as struggling, not freezes", () => {
        expect(shareHealthCongested(ok)).toBe(false);
        expect(shareHealthCongested({ ...ok, loss: 0.019 })).toBe(false);
        expect(shareHealthCongested({ ...ok, loss: 0.02 })).toBe(true);
        expect(shareHealthCongested({ ...ok, paused: true })).toBe(true);
        expect(shareHealthCongested({ ...ok, freezes: 3 })).toBe(false);
    });
});

describe("shareHealthBetween", () => {
    const a = { packetsReceived: 1000, packetsLost: 10, freezeCount: 1 };
    it("needs two readings unless paused", () => {
        expect(shareHealthBetween(null, a, false)).toBeNull();
        expect(shareHealthBetween(null, a, true)).toEqual({
            loss: 0,
            paused: true,
            freezes: 0,
        });
    });
    it("measures loss and freezes over the interval", () => {
        const b = { packetsReceived: 1950, packetsLost: 60, freezeCount: 2 };
        expect(shareHealthBetween(a, b, false)).toEqual({
            loss: 0.05,
            paused: false,
            freezes: 1,
        });
    });
    it("ignores a restarted stream", () => {
        expect(
            shareHealthBetween(
                a,
                { packetsReceived: 5, packetsLost: 0, freezeCount: 0 },
                false,
            ),
        ).toBeNull();
    });
    it("reads an idle interval as clean", () => {
        expect(shareHealthBetween(a, a, false)).toEqual(ok);
    });
});

describe("ShareRateCap", () => {
    const picked = 10_000_000;

    it("stays uncapped while viewers are fine", () => {
        const c = new ShareRateCap();
        c.note("v1", ok, 0);
        expect(c.update(picked, 0)).toBeNull();
    });

    it("cuts by 30% per struggling sample, at most every 4 s", () => {
        const c = new ShareRateCap();
        c.note("v1", paused, 0);
        expect(c.update(picked, 0)).toBe(7_000_000);
        c.note("v1", paused, 3000);
        expect(c.update(picked, 3000)).toBe(7_000_000);
        c.note("v1", paused, 4000);
        expect(c.update(picked, 4000)).toBe(4_900_000);
    });

    it("never cuts below the floor", () => {
        const c = new ShareRateCap();
        let now = 0;
        for (let i = 0; i < 30; i++) {
            c.note("v1", { ...ok, paused: true }, now);
            c.update(picked, now);
            now += 4000;
        }
        expect(c.current()).toBe(SHARE_CAP_FLOOR);
    });

    it("lets one struggling viewer hold the share down", () => {
        const c = new ShareRateCap();
        c.note("good", ok, 0);
        c.note("bad", { ...ok, paused: true }, 0);
        expect(c.update(picked, 0)).toBe(7_000_000);
    });

    it("recovers slowly once everyone is fine, then lifts the cap", () => {
        const c = new ShareRateCap();
        c.note("v1", bad, 0);
        c.update(picked, 0);
        c.note("v1", ok, 3000);
        // Not before 15 s of calm.
        expect(c.update(picked, 14_000)).toBe(7_000_000);
        expect(c.update(picked, 15_000)).toBe(8_050_000);
        expect(c.update(picked, 17_000)).toBe(8_050_000);
        expect(c.update(picked, 20_000)).toBe(9_257_500);
        expect(c.update(picked, 25_000)).toBeNull();
    });

    it("drops stale reports, so a viewer who left can't hold it down", () => {
        const c = new ShareRateCap();
        c.note("v1", bad, 0);
        c.update(picked, 0);
        expect(c.congested(SHARE_HEALTH_TTL_MS + 1)).toBe(false);
    });

    it("follows a lower pick and forgets the cap above it", () => {
        const c = new ShareRateCap();
        c.note("v1", bad, 0);
        expect(c.update(picked, 0)).toBe(7_000_000);
        c.note("v1", ok, 1000);
        expect(c.update(5_000_000, 1000)).toBeNull();
    });

    it("resets for a new share", () => {
        const c = new ShareRateCap();
        c.note("v1", bad, 0);
        c.update(picked, 0);
        c.reset();
        expect(c.update(picked, 1)).toBeNull();
    });
    it("lets loss alone cut to half the pick, a pause further", () => {
        const c = new ShareRateCap();
        let now = 0;
        for (let i = 0; i < 10; i++) {
            c.note("wifi", bad, now);
            c.update(picked, now);
            now += 4000;
        }
        expect(c.current()).toBe(picked / 2);
        c.note("tight", { ...ok, paused: true }, now);
        expect(c.update(picked, now)).toBe(3_500_000);
    });

    it("loss never raises a cap a pause set lower", () => {
        const c = new ShareRateCap();
        let now = 0;
        for (let i = 0; i < 5; i++) {
            c.note("v", { ...ok, paused: true }, now);
            c.update(picked, now);
            now += 4000;
        }
        const low = c.current()!;
        expect(low).toBeLessThan(picked / 2);
        c.note("v", bad, now);
        expect(c.update(picked, now)).toBe(low);
    });
});

describe("heavy loss: a full link", () => {
    const picked = 8_000_000;
    const full = { loss: 0.6, paused: false, freezes: 0, kbps: 1900 };

    it("goes straight under what the viewer receives", () => {
        const c = new ShareRateCap();
        c.note("v", full, 0);
        expect(c.update(picked, 0)).toBe(1_615_000);
    });

    it("is not held at the loss floor (which sat above the share's real rate)", () => {
        const c = new ShareRateCap();
        c.note("v", full, 0);
        expect(c.update(picked, 0)!).toBeLessThan(picked / 2);
    });

    it("uses the slowest viewer", () => {
        const c = new ShareRateCap();
        c.note("a", full, 0);
        c.note("b", { ...full, kbps: 1000 }, 0);
        expect(c.update(picked, 0)).toBe(850_000);
    });

    it("keeps the mild path without a received bitrate (older clients)", () => {
        const c = new ShareRateCap();
        c.note("v", { loss: 0.6, paused: false, freezes: 0 }, 0);
        expect(c.update(picked, 0)).toBe(5_600_000);
    });

    it("recovers only up to the ceiling for two minutes", () => {
        const c = new ShareRateCap();
        c.note("v", full, 0);
        c.update(picked, 0);
        c.note("v", { loss: 0, paused: false, freezes: 0, kbps: 1500 }, 1000);
        let cap = c.current()!;
        for (let t = 15_000; t < 100_000; t += 5000) cap = c.update(picked, t)!;
        expect(cap).toBe(1_615_000);
        // After the ceiling expires it climbs again.
        expect(c.update(picked, 125_000)!).toBeGreaterThan(1_615_000);
    });

    it("carries kbps through the wire format, and older payloads still decode", () => {
        expect(decodeShareHealth(encodeShareHealth(full))).toEqual(full);
        const old = new TextEncoder().encode(
            JSON.stringify({ loss: 0.1, paused: false, freezes: 0 }),
        );
        expect(decodeShareHealth(old)).toEqual({
            loss: 0.1,
            paused: false,
            freezes: 0,
        });
    });

    it("measures received kbps between readings", () => {
        const h = shareHealthBetween(
            {
                packetsReceived: 0,
                packetsLost: 0,
                freezeCount: 0,
                bytesReceived: 0,
            },
            {
                packetsReceived: 100,
                packetsLost: 0,
                freezeCount: 0,
                bytesReceived: 750_000,
            },
            false,
            3,
        );
        expect(h?.kbps).toBe(2000);
    });
});
