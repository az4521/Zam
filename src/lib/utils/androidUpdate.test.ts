import { describe, it, expect } from "vitest";
import {
    pickApkAsset,
    isTrustedApkUrl,
    versionCodeFromSemver,
    GITHUB_OWNER,
    GITHUB_REPO,
    type ReleaseAsset,
} from "./androidUpdate";

const DL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1.2.3`;

const asset = (name: string): ReleaseAsset => ({
    name,
    browser_download_url: `${DL}/${name}`,
});

describe("pickApkAsset — choose the installable APK from release assets", () => {
    it("returns the url of a single universal apk", () => {
        expect(pickApkAsset([asset("app-universal-release.apk")])).toBe(
            `${DL}/app-universal-release.apk`,
        );
    });

    it("prefers the universal apk over arch-split apks", () => {
        const assets = [
            asset("app-arm64-v8a-release.apk"),
            asset("app-universal-release.apk"),
            asset("app-x86_64-release.apk"),
        ];
        expect(pickApkAsset(assets)).toBe(`${DL}/app-universal-release.apk`);
    });

    it("falls back to the first apk when only arch-split apks exist", () => {
        const assets = [
            asset("app-armeabi-v7a-release.apk"),
            asset("app-arm64-v8a-release.apk"),
        ];
        expect(pickApkAsset(assets)).toBe(`${DL}/app-armeabi-v7a-release.apk`);
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
        expect(pickApkAsset(assets)).toBe(`${DL}/app-universal-release.apk`);
    });

    it("matches .APK case-insensitively", () => {
        expect(pickApkAsset([asset("App-Release.APK")])).toBe(
            `${DL}/App-Release.APK`,
        );
    });
});

const OK = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1.2.3/zam-1.2.3.apk`;

describe("isTrustedApkUrl", () => {
    it("accepts a canonical GitHub release asset URL", () => {
        expect(isTrustedApkUrl(OK)).toBe(true);
    });

    it("accepts the real-world asset name shapes we publish", () => {
        for (const name of [
            "app-universal-release.apk",
            "app-arm64-v8a-release.apk",
            "Zam-0.11.7.APK",
        ]) {
            expect(
                isTrustedApkUrl(
                    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v0.11.7/${name}`,
                ),
            ).toBe(true);
        }
    });

    it("rejects a plain-http URL", () => {
        expect(isTrustedApkUrl(OK.replace("https:", "http:"))).toBe(false);
    });

    it("rejects a look-alike host", () => {
        expect(
            isTrustedApkUrl(
                `https://github.com.evil.example/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects a suffix-match host", () => {
        expect(
            isTrustedApkUrl(
                `https://evilgithub.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects a subdomain of github.com", () => {
        expect(
            isTrustedApkUrl(
                `https://raw.github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects the githubusercontent CDN (native-only allowance)", () => {
        expect(
            isTrustedApkUrl(
                "https://objects.githubusercontent.com/github-production-release-asset/1/a.apk",
            ),
        ).toBe(false);
    });

    it("rejects embedded credentials", () => {
        expect(
            isTrustedApkUrl(
                `https://user:pw@github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects a non-default port", () => {
        expect(
            isTrustedApkUrl(
                `https://github.com:8443/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects another repository's release", () => {
        expect(
            isTrustedApkUrl(
                "https://github.com/someone/else/releases/download/v1/a.apk",
            ),
        ).toBe(false);
    });

    it("rejects an owner whose name merely starts with ours", () => {
        expect(
            isTrustedApkUrl(
                `https://github.com/${GITHUB_OWNER}-evil/${GITHUB_REPO}/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects a path that only contains the prefix later on", () => {
        expect(
            isTrustedApkUrl(
                `https://github.com/evil/repo/blob/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects percent-encoded path traversal out of our repo", () => {
        expect(
            isTrustedApkUrl(
                `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/%2e%2e/%2e%2e/%2e%2e/%2e%2e/evil/repo/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects a non-apk asset", () => {
        expect(
            isTrustedApkUrl(
                `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/notes.txt`,
            ),
        ).toBe(false);
    });

    it("rejects a non-https scheme that still mentions github.com", () => {
        expect(isTrustedApkUrl(`javascript:void("github.com")`)).toBe(false);
        expect(
            isTrustedApkUrl(
                `file:///github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/a.apk`,
            ),
        ).toBe(false);
    });

    it("rejects garbage that is not a URL", () => {
        expect(isTrustedApkUrl("not a url")).toBe(false);
        expect(isTrustedApkUrl("")).toBe(false);
    });
});

describe("versionCodeFromSemver", () => {
    it("uses the same formula as build.gradle", () => {
        expect(versionCodeFromSemver("1.2.3")).toBe(10203);
        expect(versionCodeFromSemver("0.11.7")).toBe(1107);
        expect(versionCodeFromSemver("0.0.1")).toBe(1);
    });

    it("matches major*10000 + minor*100 + patch for a spread of versions", () => {
        const cases: [string, number][] = [
            ["0.0.0", 0],
            ["0.1.0", 100],
            ["1.0.0", 10000],
            ["2.34.56", 23456],
            ["12.0.99", 120099],
        ];
        for (const [v, expected] of cases) {
            expect(versionCodeFromSemver(v)).toBe(expected);
        }
    });

    it("tolerates a leading v and a prerelease suffix", () => {
        expect(versionCodeFromSemver("v0.11.7")).toBe(1107);
        expect(versionCodeFromSemver("0.11.7-beta.1")).toBe(1107);
    });

    it("returns 0 for anything unparseable", () => {
        expect(versionCodeFromSemver("")).toBe(0);
        expect(versionCodeFromSemver("nightly")).toBe(0);
        expect(versionCodeFromSemver("1.2")).toBe(0);
    });

    it("is monotonic across a patch, minor and major bump", () => {
        expect(versionCodeFromSemver("0.11.8")).toBeGreaterThan(
            versionCodeFromSemver("0.11.7"),
        );
        expect(versionCodeFromSemver("0.12.0")).toBeGreaterThan(
            versionCodeFromSemver("0.11.99"),
        );
        expect(versionCodeFromSemver("1.0.0")).toBeGreaterThan(
            versionCodeFromSemver("0.99.99"),
        );
    });
});

describe("pickApkAsset trust filtering", () => {
    it("skips an untrusted URL and picks the trusted one", () => {
        expect(
            pickApkAsset([
                {
                    name: "zam-universal.apk",
                    browser_download_url: "https://evil.example/zam.apk",
                },
                {
                    name: "zam-arm64-v8a.apk",
                    browser_download_url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/zam-arm64-v8a.apk`,
                },
            ]),
        ).toBe(
            `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v1/zam-arm64-v8a.apk`,
        );
    });

    it("returns null when every apk asset is untrusted", () => {
        expect(
            pickApkAsset([
                {
                    name: "zam.apk",
                    browser_download_url: "https://evil.example/zam.apk",
                },
            ]),
        ).toBeNull();
    });

    it("never returns a url that isTrustedApkUrl rejects", () => {
        const url = pickApkAsset([
            asset("app-universal-release.apk"),
            {
                name: "app-arm64-v8a-release.apk",
                browser_download_url:
                    "https://github.com.evil.example/a/b/releases/download/v1/app-arm64-v8a-release.apk",
            },
        ]);
        expect(url).not.toBeNull();
        expect(isTrustedApkUrl(url as string)).toBe(true);
    });
});
