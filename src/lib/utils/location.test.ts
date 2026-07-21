import { describe, it, expect } from "vitest";
import {
    parseGeoUri,
    formatCoords,
    mapLinkFor,
    buildLocationContent,
} from "./location";

describe("parseGeoUri", () => {
    it("parses lat,lon", () => {
        expect(parseGeoUri("geo:51.5,-0.12")).toEqual({
            lat: 51.5,
            lon: -0.12,
        });
    });
    it("ignores an uncertainty suffix", () => {
        expect(parseGeoUri("geo:51.5,-0.12;u=35")).toEqual({
            lat: 51.5,
            lon: -0.12,
        });
    });
    it("ignores an altitude component", () => {
        expect(parseGeoUri("geo:51.5,-0.12,100")).toEqual({
            lat: 51.5,
            lon: -0.12,
        });
    });
    it("returns null for malformed input", () => {
        expect(parseGeoUri("geo:abc")).toBeNull();
        expect(parseGeoUri("51.5,-0.12")).toBeNull();
        expect(parseGeoUri("")).toBeNull();
    });
});

describe("formatCoords", () => {
    it("formats with up to 5 decimals, no forced trailing zeros", () => {
        expect(formatCoords(51.5074, -0.1278)).toBe("51.5074, -0.1278");
    });
    it("handles negatives and integers", () => {
        expect(formatCoords(-33, 18)).toBe("-33, 18");
    });
});

describe("mapLinkFor", () => {
    it("builds an OpenStreetMap link with the coords", () => {
        const link = mapLinkFor(51.5, -0.12);
        expect(link).toContain("openstreetmap.org");
        expect(link).toContain("mlat=51.5");
        expect(link).toContain("mlon=-0.12");
    });
});

describe("buildLocationContent", () => {
    it("emits m.location with geo_uri + MSC3488 blocks + fallback body", () => {
        const c = buildLocationContent({
            lat: 51.5,
            lon: -0.12,
            description: "Home",
        });
        expect(c.msgtype).toBe("m.location");
        expect(c.geo_uri).toBe("geo:51.5,-0.12");
        expect((c as any)["org.matrix.msc3488.location"].uri).toBe(
            "geo:51.5,-0.12",
        );
        expect((c as any)["org.matrix.msc3488.location"].description).toBe(
            "Home",
        );
        expect((c as any)["org.matrix.msc3488.asset"].type).toBe("m.self");
        expect(typeof c.body).toBe("string");
    });
});
