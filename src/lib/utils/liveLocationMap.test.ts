import { describe, it, expect } from "vitest";
import { beaconMarkers, type BeaconMarkerSource } from "./liveLocationMap";

function locEvent(sender: string): { getSender(): string } {
    return { getSender: () => sender };
}

function beacon(over: Partial<BeaconMarkerSource> = {}): BeaconMarkerSource {
    const owner = over.beaconInfoOwner ?? "@alice:hs";
    return {
        beaconInfoId: "$b1",
        beaconInfoOwner: owner,
        isLive: true,
        latestLocationState: { uri: "geo:50.36,7.59", timestamp: 1000 },
        // By default the latest fix is sent by the beacon's own owner (a
        // legitimate update); forgery tests override latestLocationEvent.
        latestLocationEvent: locEvent(owner),
        ...over,
    };
}

describe("beaconMarkers — beacons → map marker view models", () => {
    it("maps a live beacon with a fix to a marker", () => {
        expect(beaconMarkers([beacon()], "@me:hs")).toEqual([
            {
                id: "$b1",
                owner: "@alice:hs",
                isSelf: false,
                lat: 50.36,
                lon: 7.59,
                updatedTs: 1000,
                description: null,
            },
        ]);
    });

    it("drops non-live beacons and beacons without a parseable fix", () => {
        const dead = beacon({ beaconInfoId: "$dead", isLive: false });
        const noFix = beacon({
            beaconInfoId: "$nofix",
            latestLocationState: undefined,
        });
        const junk = beacon({
            beaconInfoId: "$junk",
            latestLocationState: { uri: "geo:junk" },
        });
        expect(beaconMarkers([dead, noFix, junk], "@me:hs")).toEqual([]);
    });

    it("flags the own beacon and sorts it first", () => {
        const other = beacon();
        const mine = beacon({
            beaconInfoId: "$mine",
            beaconInfoOwner: "@me:hs",
        });
        const out = beaconMarkers([other, mine], "@me:hs");
        expect(out.map((m) => m.id)).toEqual(["$mine", "$b1"]);
        expect(out[0].isSelf).toBe(true);
        expect(out[1].isSelf).toBe(false);
    });

    it("dedupes multiple live beacons per owner, keeping the freshest fix", () => {
        const stale = beacon({
            beaconInfoId: "$old",
            latestLocationState: { uri: "geo:1,1", timestamp: 500 },
        });
        const fresh = beacon({
            beaconInfoId: "$new",
            latestLocationState: { uri: "geo:2,2", timestamp: 2000 },
        });
        const out = beaconMarkers([stale, fresh], "@me:hs");
        expect(out).toHaveLength(1);
        expect(out[0].id).toBe("$new");
        expect(out[0].lat).toBe(2);
    });

    it("passes through description and tolerates a missing timestamp", () => {
        const b = beacon({
            latestLocationState: { uri: "geo:3,4", description: "on my way" },
        });
        expect(beaconMarkers([b], "@me:hs")[0]).toMatchObject({
            description: "on my way",
            updatedTs: null,
        });
    });

    it("hides a beacon whose latest fix was forged by a non-owner", () => {
        // beacon_info is owned by alice, but the newest m.beacon location was
        // sent by mallory — a spoof. The SDK caches only the newest fix, so the
        // fail-safe is to drop the marker rather than show a spoofed position.
        const forged = beacon({
            beaconInfoOwner: "@alice:hs",
            latestLocationEvent: locEvent("@mallory:hs"),
        });
        expect(beaconMarkers([forged], "@me:hs")).toEqual([]);
    });

    it("keeps the owner's own legitimate fix", () => {
        // Explicit sanity check: an owner-sent latest fix still yields a marker.
        const legit = beacon({
            beaconInfoOwner: "@alice:hs",
            latestLocationEvent: locEvent("@alice:hs"),
        });
        expect(beaconMarkers([legit], "@me:hs")).toHaveLength(1);
    });

    it("keeps distinct owners as distinct markers", () => {
        const a = beacon();
        const b = beacon({
            beaconInfoId: "$b2",
            beaconInfoOwner: "@bob:hs",
            latestLocationState: { uri: "geo:9,9", timestamp: 900 },
        });
        expect(beaconMarkers([a, b], "@me:hs")).toHaveLength(2);
    });
});
