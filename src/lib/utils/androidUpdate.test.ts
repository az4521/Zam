import { describe, it, expect } from "vitest";
import { pickApkAsset, type ReleaseAsset } from "./androidUpdate";

const asset = (name: string): ReleaseAsset => ({
    name,
    browser_download_url: `https://example.com/${name}`,
});

describe("pickApkAsset — choose the installable APK from release assets", () => {
    it("returns the url of a single universal apk", () => {
        expect(pickApkAsset([asset("app-universal-release.apk")])).toBe(
            "https://example.com/app-universal-release.apk",
        );
    });

    it("prefers the universal apk over arch-split apks", () => {
        const assets = [
            asset("app-arm64-v8a-release.apk"),
            asset("app-universal-release.apk"),
            asset("app-x86_64-release.apk"),
        ];
        expect(pickApkAsset(assets)).toBe(
            "https://example.com/app-universal-release.apk",
        );
    });

    it("falls back to the first apk when only arch-split apks exist", () => {
        const assets = [
            asset("app-armeabi-v7a-release.apk"),
            asset("app-arm64-v8a-release.apk"),
        ];
        expect(pickApkAsset(assets)).toBe(
            "https://example.com/app-armeabi-v7a-release.apk",
        );
    });

    it("returns null when the release has no apk asset", () => {
        const assets = [asset("latest.yml"), asset("app.exe")];
        expect(pickApkAsset(assets)).toBeNull();
    });

    it("returns null for an empty asset list", () => {
        expect(pickApkAsset([])).toBeNull();
    });

    it("ignores non-apk assets when picking", () => {
        const assets = [
            asset("checksums.txt"),
            asset("app-universal-release.apk"),
            asset("release-notes.md"),
        ];
        expect(pickApkAsset(assets)).toBe(
            "https://example.com/app-universal-release.apk",
        );
    });

    it("matches .APK case-insensitively", () => {
        expect(pickApkAsset([asset("App-Release.APK")])).toBe(
            "https://example.com/App-Release.APK",
        );
    });
});
