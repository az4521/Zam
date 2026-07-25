import { describe, it, expect } from "vitest";
import { parseReleaseAssets } from "./update";

describe("parseReleaseAssets — normalize a GitHub release's assets array", () => {
    it("maps well-formed assets, keeping name/url/content_type", () => {
        const raw = [
            {
                name: "app-universal-release.apk",
                browser_download_url: "https://example.com/app.apk",
                content_type: "application/vnd.android.package-archive",
            },
        ];
        expect(parseReleaseAssets(raw)).toEqual([
            {
                name: "app-universal-release.apk",
                browser_download_url: "https://example.com/app.apk",
                content_type: "application/vnd.android.package-archive",
            },
        ]);
    });

    it("returns [] for a non-array input", () => {
        expect(parseReleaseAssets(undefined)).toEqual([]);
        expect(parseReleaseAssets(null)).toEqual([]);
        expect(parseReleaseAssets({})).toEqual([]);
    });

    it("drops entries missing name or browser_download_url", () => {
        const raw = [
            { name: "ok.apk", browser_download_url: "https://e/ok.apk" },
            { name: "no-url.apk" },
            { browser_download_url: "https://e/no-name.apk" },
            null,
            "nope",
        ];
        expect(parseReleaseAssets(raw)).toEqual([
            {
                name: "ok.apk",
                browser_download_url: "https://e/ok.apk",
                content_type: undefined,
            },
        ]);
    });

    it("coerces a non-string content_type to undefined", () => {
        const raw = [
            {
                name: "a.apk",
                browser_download_url: "https://e/a.apk",
                content_type: 42,
            },
        ];
        expect(parseReleaseAssets(raw)[0].content_type).toBeUndefined();
    });
});
