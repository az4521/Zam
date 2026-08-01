import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
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

/**
 * Drift guard for the HAND-WRITTEN copy of the versionCode formula.
 *
 * `versionCodeFromSemver` re-implements, in TypeScript, the expression
 * `android/app/build.gradle` uses to derive the build's own versionCode. The
 * gradle file cannot import TypeScript and the renderer cannot read Groovy, so
 * the two are only ever kept in step by hand — and nothing pinned them.
 *
 * Drift is quiet and one-directional: the renderer sends native a
 * `minVersionCode` floor computed the old way, native compares it against a
 * versionCode the build computed the new way, and legitimate updates start
 * being refused as "older than the offered release" (or, worse, a floor that
 * is too low stops blocking a downgrade). No crash, no log.
 *
 * So this reads the real gradle file off disk and pins the multipliers. Only
 * the numbers whose drift is the actual failure mode are asserted — never
 * comment text or line numbers, which ordinary edits are supposed to change.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const GRADLE_PATH = "android/app/build.gradle";

const KEEP_IN_STEP =
    `${GRADLE_PATH} and versionCodeFromSemver() in src/lib/utils/androidUpdate.ts ` +
    `hand-mirror one another — change one, change both.`;

/** The `def pkgVersionCode = …` assignment, as written in the gradle file. */
function versionCodeExpression(): string {
    let source: string;
    try {
        // Resolve via dirname(), NOT `new URL("…", import.meta.url)` — Vite
        // rewrites that literal pattern into an *asset* reference and
        // fileURLToPath then throws. Anchored to this file rather than to
        // process.cwd() so the test does not care where vitest was launched
        // from. (Same approach as themeParity.test.ts.)
        source = readFileSync(resolve(REPO_ROOT, GRADLE_PATH), "utf8");
    } catch (err) {
        throw new Error(
            `Could not read ${GRADLE_PATH} (resolved under ${REPO_ROOT}). If it moved, update ` +
                `this test AND check the formula still matches. ${KEEP_IN_STEP} ` +
                `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
    const match = source.match(
        /\bdef\s+pkgVersionCode\s*=([\s\S]*?)(?=\n[ \t]*\n|\nandroid\b)/,
    );
    if (!match) {
        throw new Error(
            `${GRADLE_PATH} has no \`def pkgVersionCode = …\` assignment to read the versionCode ` +
                `formula from. It was renamed or restructured, which hides formula drift. ${KEEP_IN_STEP}`,
        );
    }
    return match[1];
}

describe(`versionCodeFromSemver mirrors ${GRADLE_PATH}`, () => {
    it("uses the multipliers the gradle formula uses", () => {
        const expr = versionCodeExpression();
        const multipliers = [...expr.matchAll(/\*\s*(\d+)/g)].map((m) =>
            Number(m[1]),
        );
        expect(
            multipliers,
            `${GRADLE_PATH} derives pkgVersionCode with the multipliers [${multipliers.join(", ")}], ` +
                `but versionCodeFromSemver() uses major*10000 + minor*100 + patch. The renderer would ` +
                `send native a minVersionCode floor on a different scale from the versionCode the build ` +
                `stamps, and updates would be refused (or a downgrade let through) with no error at all. ` +
                `${KEEP_IN_STEP} Gradle expression read: ${JSON.stringify(expr.trim())}`,
        ).toEqual([10000, 100]);
    });

    it("computes the same versionCode as the gradle formula does", () => {
        const expr = versionCodeExpression();
        const [major, minor] = [...expr.matchAll(/\*\s*(\d+)/g)].map((m) =>
            Number(m[1]),
        );
        for (const [v, maj, min, patch] of [
            ["1.2.3", 1, 2, 3],
            ["0.11.7", 0, 11, 7],
            ["12.0.99", 12, 0, 99],
        ] as [string, number, number, number][]) {
            expect(
                versionCodeFromSemver(v),
                `versionCodeFromSemver(${JSON.stringify(v)}) disagrees with the formula in ` +
                    `${GRADLE_PATH}. ${KEEP_IN_STEP}`,
            ).toBe(maj * major + min * minor + patch);
        }
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
