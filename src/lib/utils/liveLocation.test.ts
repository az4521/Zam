import { describe, it, expect } from "vitest";
import {
    isBeaconInfoEventType,
    isBeaconEventType,
    parseBeaconInfo,
    beaconGeo,
    remainingLabel,
    updatedAgoLabel,
    shouldSendUpdate,
    shouldWriteStopBeacon,
    LIVE_SHARE_DURATIONS,
    type ParsedBeaconInfo,
} from "./liveLocation";

describe("isBeaconInfoEventType", () => {
    it("matches the stable + unstable base types", () => {
        expect(isBeaconInfoEventType("m.beacon_info")).toBe(true);
        expect(isBeaconInfoEventType("org.matrix.msc3672.beacon_info")).toBe(
            true,
        );
    });
    it("tolerates a per-owner suffix after a dot", () => {
        expect(isBeaconInfoEventType("m.beacon_info.@bob:hs")).toBe(true);
        expect(
            isBeaconInfoEventType("org.matrix.msc3672.beacon_info.@bob:hs"),
        ).toBe(true);
    });
    it("rejects near-misses and other types", () => {
        expect(isBeaconInfoEventType("m.beacon")).toBe(false);
        expect(isBeaconInfoEventType("m.beacon_information")).toBe(false);
        expect(isBeaconInfoEventType("m.beacon_info@bob")).toBe(false);
        expect(isBeaconInfoEventType("m.room.message")).toBe(false);
    });
    it("returns false for non-string input", () => {
        expect(isBeaconInfoEventType(42 as unknown)).toBe(false);
        expect(isBeaconInfoEventType(null as unknown)).toBe(false);
        expect(isBeaconInfoEventType(undefined as unknown)).toBe(false);
        expect(isBeaconInfoEventType({} as unknown)).toBe(false);
    });
});

describe("isBeaconEventType", () => {
    it("matches the stable + unstable types exactly", () => {
        expect(isBeaconEventType("m.beacon")).toBe(true);
        expect(isBeaconEventType("org.matrix.msc3672.beacon")).toBe(true);
    });
    it("rejects suffixed or unrelated types", () => {
        expect(isBeaconEventType("m.beacon.@bob:hs")).toBe(false);
        expect(isBeaconEventType("m.beacon_info")).toBe(false);
        expect(isBeaconEventType("m.room.message")).toBe(false);
    });
    it("returns false for non-string input", () => {
        expect(isBeaconEventType(42 as unknown)).toBe(false);
        expect(isBeaconEventType(null as unknown)).toBe(false);
        expect(isBeaconEventType({} as unknown)).toBe(false);
    });
});

describe("parseBeaconInfo", () => {
    it("parses valid full content", () => {
        const parsed = parseBeaconInfo(
            {
                description: "Walking home",
                timeout: 600000,
                live: true,
                "org.matrix.msc3488.ts": 1000,
            },
            5000,
        );
        expect(parsed).toEqual<ParsedBeaconInfo>({
            description: "Walking home",
            timeoutMs: 600000,
            live: true,
            startTs: 1000,
            expiresAt: 601000,
        });
    });
    it("returns null for null / non-object content", () => {
        expect(parseBeaconInfo(null, 0)).toBeNull();
        expect(parseBeaconInfo(undefined, 0)).toBeNull();
        expect(parseBeaconInfo(42 as unknown, 0)).toBeNull();
        expect(parseBeaconInfo("nope" as unknown, 0)).toBeNull();
    });
    it("returns null when timeout is missing", () => {
        expect(parseBeaconInfo({ live: true }, 0)).toBeNull();
    });
    it("returns null when timeout is <= 0 or non-number", () => {
        expect(parseBeaconInfo({ timeout: 0, live: true }, 0)).toBeNull();
        expect(parseBeaconInfo({ timeout: -5, live: true }, 0)).toBeNull();
        expect(
            parseBeaconInfo({ timeout: "600000", live: true }, 0),
        ).toBeNull();
        expect(parseBeaconInfo({ timeout: NaN, live: true }, 0)).toBeNull();
        expect(
            parseBeaconInfo({ timeout: Infinity, live: true }, 0),
        ).toBeNull();
    });
    it("returns null when live is not a strict boolean", () => {
        expect(parseBeaconInfo({ timeout: 1000 }, 0)).toBeNull();
        expect(parseBeaconInfo({ timeout: 1000, live: "true" }, 0)).toBeNull();
        expect(parseBeaconInfo({ timeout: 1000, live: 1 }, 0)).toBeNull();
        expect(parseBeaconInfo({ timeout: 1000, live: null }, 0)).toBeNull();
    });
    it("omits description when it is not a string", () => {
        const parsed = parseBeaconInfo(
            { timeout: 1000, live: false, description: 42 },
            0,
        );
        expect(parsed).not.toBeNull();
        expect(parsed!.description).toBeUndefined();
        expect("description" in parsed!).toBe(false);
    });
    it("uses org.matrix.msc3488.ts as startTs when it is a finite number", () => {
        const parsed = parseBeaconInfo(
            { timeout: 1000, live: true, "org.matrix.msc3488.ts": 7777 },
            123,
        );
        expect(parsed!.startTs).toBe(7777);
        expect(parsed!.expiresAt).toBe(8777);
    });
    it("falls back to eventTs when the msc3488.ts is absent or non-finite", () => {
        const a = parseBeaconInfo({ timeout: 1000, live: true }, 500);
        expect(a!.startTs).toBe(500);
        expect(a!.expiresAt).toBe(1500);

        const b = parseBeaconInfo(
            { timeout: 1000, live: true, "org.matrix.msc3488.ts": "nope" },
            500,
        );
        expect(b!.startTs).toBe(500);

        const c = parseBeaconInfo(
            { timeout: 1000, live: true, "org.matrix.msc3488.ts": Infinity },
            500,
        );
        expect(c!.startTs).toBe(500);
    });
});

describe("beaconGeo", () => {
    it("parses a valid uri", () => {
        expect(beaconGeo({ uri: "geo:1.5,-2.5" })).toEqual({
            lat: 1.5,
            lon: -2.5,
        });
    });
    it("returns null when uri is missing", () => {
        expect(beaconGeo({})).toBeNull();
    });
    it("returns null for a malformed uri", () => {
        expect(beaconGeo({ uri: "not-a-geo" })).toBeNull();
        expect(beaconGeo({ uri: 42 })).toBeNull();
    });
    it("returns null for null / non-object input", () => {
        expect(beaconGeo(null)).toBeNull();
        expect(beaconGeo(undefined)).toBeNull();
        expect(beaconGeo("geo:1,2" as unknown)).toBeNull();
        expect(beaconGeo(42 as unknown)).toBeNull();
    });
});

describe("remainingLabel", () => {
    it("reports Expired at or past the deadline", () => {
        expect(remainingLabel(1000, 1000)).toBe("Expired");
        expect(remainingLabel(1000, 2000)).toBe("Expired");
    });
    it("reports less than a minute for tiny remainders", () => {
        expect(remainingLabel(20000, 0)).toBe("less than a minute left");
    });
    it("reports whole minutes under an hour", () => {
        expect(remainingLabel(5 * 60000, 0)).toBe("5 min left");
        expect(remainingLabel(59 * 60000, 0)).toBe("59 min left");
    });
    it("reports hours with no remainder minutes", () => {
        expect(remainingLabel(60 * 60000, 0)).toBe("1 h left");
        expect(remainingLabel(2 * 60 * 60000, 0)).toBe("2 h left");
    });
    it("reports hours with remainder minutes", () => {
        expect(remainingLabel((60 + 30) * 60000, 0)).toBe("1 h 30 min left");
        expect(remainingLabel((2 * 60 + 5) * 60000, 0)).toBe("2 h 5 min left");
    });
});

describe("updatedAgoLabel", () => {
    it("reports just now under 10s and for negative diffs", () => {
        expect(updatedAgoLabel(0, 0)).toBe("just now");
        expect(updatedAgoLabel(0, 9999)).toBe("just now");
        expect(updatedAgoLabel(1000, 0)).toBe("just now");
    });
    it("reports seconds under a minute", () => {
        expect(updatedAgoLabel(0, 10000)).toBe("10 s ago");
        expect(updatedAgoLabel(0, 59000)).toBe("59 s ago");
    });
    it("reports minutes under an hour", () => {
        expect(updatedAgoLabel(0, 60000)).toBe("1 min ago");
        expect(updatedAgoLabel(0, 59 * 60000)).toBe("59 min ago");
    });
    it("reports hours beyond an hour", () => {
        expect(updatedAgoLabel(0, 3600000)).toBe("1 h ago");
        expect(updatedAgoLabel(0, 5 * 3600000)).toBe("5 h ago");
    });
});

describe("shouldSendUpdate", () => {
    it("always sends when nothing has been sent yet", () => {
        expect(shouldSendUpdate(null, 0)).toBe(true);
        expect(shouldSendUpdate(null, 999999)).toBe(true);
    });
    it("suppresses below the interval and sends at/above it", () => {
        expect(shouldSendUpdate(1000, 1000 + 4999)).toBe(false);
        expect(shouldSendUpdate(1000, 1000 + 5000)).toBe(true);
        expect(shouldSendUpdate(1000, 1000 + 6000)).toBe(true);
    });
    it("honours a custom interval", () => {
        expect(shouldSendUpdate(0, 999, 1000)).toBe(false);
        expect(shouldSendUpdate(0, 1000, 1000)).toBe(true);
    });
});

describe("shouldWriteStopBeacon", () => {
    it("writes when an own live beacon is present in room state", () => {
        expect(shouldWriteStopBeacon(true, null)).toBe(true);
        expect(shouldWriteStopBeacon(true, undefined)).toBe(true);
        expect(shouldWriteStopBeacon(true, "$beacon")).toBe(true);
    });
    it("still writes when state has no own beacon but a share id is known (sync race)", () => {
        // The share was just started; its beacon_info has not landed in
        // currentState yet. We must still stop it or it broadcasts to timeout.
        expect(shouldWriteStopBeacon(false, "$beacon")).toBe(true);
    });
    it("is a no-op when we neither have an own live beacon nor a known share id", () => {
        expect(shouldWriteStopBeacon(false, null)).toBe(false);
        expect(shouldWriteStopBeacon(false, undefined)).toBe(false);
    });
    it("treats an empty-string id as no known share (no-op)", () => {
        expect(shouldWriteStopBeacon(false, "")).toBe(false);
    });
});

describe("LIVE_SHARE_DURATIONS", () => {
    it("has exactly the three canonical durations", () => {
        expect(LIVE_SHARE_DURATIONS).toEqual([
            { label: "15 minutes", ms: 900000 },
            { label: "1 hour", ms: 3600000 },
            { label: "8 hours", ms: 28800000 },
        ]);
    });
});
