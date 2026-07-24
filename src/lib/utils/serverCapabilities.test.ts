import { describe, it, expect } from "vitest";
import {
    specAtLeast,
    serverSupports,
    labelUnstableFeature,
    hasUnstableFeature,
} from "./serverCapabilities";

describe("specAtLeast", () => {
    it("compares spec versions numerically, not lexically", () => {
        expect(specAtLeast(["v1.1", "v1.11"], "v1.4")).toBe(true); // 1.11 ≥ 1.4
        expect(specAtLeast(["v1.1", "v1.3"], "v1.4")).toBe(false);
        expect(specAtLeast(["v1.4"], "v1.4")).toBe(true);
        expect(specAtLeast([], "v1.4")).toBe(false);
    });
});

describe("serverSupports", () => {
    it("defaults to supported when the capability is unlisted", () => {
        // Per spec, an absent capability means the operation is available.
        expect(serverSupports("changePassword", {})).toBe(true);
        expect(serverSupports("setDisplayName", {})).toBe(true);
    });

    it("returns false only when the server explicitly disables it", () => {
        expect(
            serverSupports("changePassword", {
                "m.change_password": { enabled: false },
            }),
        ).toBe(false);
        expect(
            serverSupports("setAvatarUrl", {
                "m.set_avatar_url": { enabled: false },
            }),
        ).toBe(false);
        expect(
            serverSupports("change3pid", {
                "m.3pid_changes": { enabled: true },
            }),
        ).toBe(true);
    });
});

describe("labelUnstableFeature", () => {
    it("gives a friendly label for known MSCs", () => {
        expect(
            labelUnstableFeature("uk.half-shot.msc2666.query_mutual_rooms"),
        ).toMatch(/shared rooms/i);
        expect(labelUnstableFeature("org.matrix.msc2285.stable")).toMatch(
            /private read receipts/i,
        );
    });

    it("falls back to the raw key for unknown flags", () => {
        expect(labelUnstableFeature("org.example.msc9999")).toBe(
            "org.example.msc9999",
        );
    });
});

describe("hasUnstableFeature", () => {
    it("reports an enabled unstable feature as present", () => {
        expect(
            hasUnstableFeature(
                { "org.matrix.msc4140": true },
                "org.matrix.msc4140",
            ),
        ).toBe(true);
    });

    it("returns false when the flag is absent, disabled, or the map is empty", () => {
        expect(hasUnstableFeature({}, "org.matrix.msc4140")).toBe(false);
        expect(
            hasUnstableFeature(
                { "org.matrix.msc4140": false },
                "org.matrix.msc4140",
            ),
        ).toBe(false);
        // An unrelated enabled flag must not satisfy the query.
        expect(
            hasUnstableFeature(
                { "org.matrix.msc3952_intentional_mentions": true },
                "org.matrix.msc4140",
            ),
        ).toBe(false);
        expect(hasUnstableFeature(undefined, "org.matrix.msc4140")).toBe(false);
    });
});
