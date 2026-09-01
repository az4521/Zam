// src/lib/utils/changelog.test.ts
import { describe, it, expect } from "vitest";
import {
    normalizeVersion,
    normalizeRelease,
    pickReleaseForVersion,
    shouldShowWhatsNew,
    type ChangelogRelease,
} from "./changelog";

const rel = (over: Partial<ChangelogRelease>): ChangelogRelease => ({
    tag_name: "v1.0.0",
    name: "1.0.0",
    body: "notes",
    published_at: "2026-01-01T00:00:00Z",
    ...over,
});

describe("normalizeVersion", () => {
    it("strips a single leading v and trims", () => {
        expect(normalizeVersion("v1.5.1")).toBe("1.5.1");
        expect(normalizeVersion("  V2.0.0 ")).toBe("2.0.0");
        expect(normalizeVersion("1.5.1")).toBe("1.5.1");
    });
});

describe("normalizeRelease", () => {
    it("keeps a well-formed release", () => {
        expect(
            normalizeRelease({
                tag_name: "v1.2.3",
                name: "Cool",
                body: "b",
                published_at: "2026-02-02T00:00:00Z",
            }),
        ).toEqual({
            tag_name: "v1.2.3",
            name: "Cool",
            body: "b",
            published_at: "2026-02-02T00:00:00Z",
        });
    });
    it("returns null without a tag", () => {
        expect(normalizeRelease({ name: "x", body: "y" })).toBeNull();
        expect(normalizeRelease(null)).toBeNull();
        expect(normalizeRelease("nope")).toBeNull();
    });
    it("defaults a missing body to empty and name to the tag", () => {
        expect(normalizeRelease({ tag_name: "v9" })).toEqual({
            tag_name: "v9",
            name: "v9",
            body: "",
            published_at: "",
        });
    });
});

describe("pickReleaseForVersion", () => {
    it("matches by tag ignoring a leading v (both directions)", () => {
        const list = [rel({ tag_name: "v1.5.1" }), rel({ tag_name: "1.4.0" })];
        expect(pickReleaseForVersion(list, "1.5.1")?.tag_name).toBe("v1.5.1");
        expect(pickReleaseForVersion(list, "v1.4.0")?.tag_name).toBe("1.4.0");
    });
    it("falls back to the newest by published_at when no tag matches", () => {
        const list = [
            rel({ tag_name: "v1.0.0", published_at: "2026-01-01T00:00:00Z" }),
            rel({ tag_name: "v2.0.0", published_at: "2026-03-01T00:00:00Z" }),
            rel({ tag_name: "v1.5.0", published_at: "2026-02-01T00:00:00Z" }),
        ];
        expect(pickReleaseForVersion(list, "9.9.9")?.tag_name).toBe("v2.0.0");
    });
    it("returns null for an empty list", () => {
        expect(pickReleaseForVersion([], "1.0.0")).toBeNull();
    });
});

describe("shouldShowWhatsNew", () => {
    it("is false on a first-ever launch (null)", () => {
        expect(shouldShowWhatsNew(null, "1.5.1")).toBe(false);
    });
    it("is false when unchanged (v-normalized)", () => {
        expect(shouldShowWhatsNew("1.5.1", "1.5.1")).toBe(false);
        expect(shouldShowWhatsNew("v1.5.1", "1.5.1")).toBe(false);
    });
    it("is true on a real version change", () => {
        expect(shouldShowWhatsNew("1.5.0", "1.5.1")).toBe(true);
    });
});
