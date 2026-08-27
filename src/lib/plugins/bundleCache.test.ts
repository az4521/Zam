import { describe, it, expect } from "vitest";
import { isCachedBundleUsable, type CachedBundle } from "./bundleCache";

const base: CachedBundle = {
    pluginId: "zam.sample",
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
});
