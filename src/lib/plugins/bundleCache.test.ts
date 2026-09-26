import { describe, it, expect } from "vitest";
import { isCachedBundleUsable, type CachedBundle } from "./bundleCache";

const base: CachedBundle = {
    pluginId: "zam.slash-fun",
    version: "1.0.0",
    code: "export function onload(){}",
    cachedAt: 0,
};

describe("isCachedBundleUsable", () => {
    it("returns false when there is no cached bundle", () => {
        expect(isCachedBundleUsable(null, "1.0.0")).toBe(false);
        expect(isCachedBundleUsable(undefined, "1.0.0")).toBe(false);
    });
    it("returns true when the cached version matches the wanted version", () => {
        expect(isCachedBundleUsable(base, "1.0.0")).toBe(true);
    });
    it("returns false when the cached version is stale", () => {
        expect(isCachedBundleUsable(base, "1.1.0")).toBe(false);
        expect(
            isCachedBundleUsable({ ...base, version: "0.9.0" }, "1.0.0"),
        ).toBe(false);
    });
    it("returns false when the cached code is empty", () => {
        expect(isCachedBundleUsable({ ...base, code: "" }, "1.0.0")).toBe(
            false,
        );
    });

    it("returns true when sha is given and matches cached sha", () => {
        const sha = "a".repeat(40);
        const withSha = { ...base, sha };
        expect(isCachedBundleUsable(withSha, "1.0.0", sha)).toBe(true);
    });

    it("returns false when sha is given and cached sha differs", () => {
        const cached = { ...base, sha: "a".repeat(40) };
        const wantedSha = "b".repeat(40);
        expect(isCachedBundleUsable(cached, "1.0.0", wantedSha)).toBe(false);
    });

    it("returns true when sha is given but cache has no sha (legacy)", () => {
        // Legacy cache entries with no sha stay usable
        expect(isCachedBundleUsable(base, "1.0.0", "a".repeat(40))).toBe(true);
    });

    it("returns true when no sha given (backward compat)", () => {
        const withSha = { ...base, sha: "a".repeat(40) };
        expect(isCachedBundleUsable(withSha, "1.0.0")).toBe(true);
    });
});
