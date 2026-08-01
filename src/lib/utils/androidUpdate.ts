// Pure selection of the installable APK from a GitHub release's assets.
// SDK-free and DOM-free so it can be unit-tested; the Android AboutSettings
// branch feeds it `UpdateInfo.assets` (see update.ts) and hands the chosen
// URL to the native downloader (see androidUpdater.ts).

export interface ReleaseAsset {
    name: string;
    browser_download_url: string;
    content_type?: string;
}

// ABI qualifiers a per-arch (split) APK name carries. A universal APK has none.
// Note "x86" is checked as a substring, so it also matches "x86_64" builds —
// both are arch-split and equally disqualified from the "universal" preference.
const ABI_QUALIFIERS = ["arm64-v8a", "armeabi-v7a", "x86_64", "x86"];

function hasAbiQualifier(name: string): boolean {
    const lower = name.toLowerCase();
    return ABI_QUALIFIERS.some((abi) => lower.includes(abi));
}

/** The repository in-app updates are fetched from. `update.ts` imports these
 *  so the release API URL and the download allowlist can never drift apart. */
export const GITHUB_OWNER = "az4521";
export const GITHUB_REPO = "Zam";

const RELEASE_DOWNLOAD_PREFIX = `/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/`;

/**
 * Whether `url` is a release-asset download URL we are willing to hand to the
 * native installer. GitHub release assets always look like
 * `https://github.com/<owner>/<repo>/releases/download/<tag>/<file>`, so this
 * is deliberately strict: exact host, no credentials, default port, our repo's
 * download path, `.apk` extension.
 *
 * This is the renderer half of the check. `ApkUpdaterPlugin.java` re-validates
 * independently (a compromised renderer must not be able to talk the native
 * side into fetching an arbitrary URL) and additionally allows the
 * `*.githubusercontent.com` CDN hosts that GitHub redirects asset downloads to.
 * That looser redirect allowlist is native-only and must NOT be added here.
 */
export function isTrustedApkUrl(url: string): boolean {
    let u: URL;
    try {
        u = new URL(url);
    } catch {
        return false;
    }
    if (u.protocol !== "https:") return false;
    // Exact host, never a suffix/substring match: `github.com.evil.example`
    // and `raw.github.com` are both other people's servers.
    if (u.hostname.toLowerCase() !== "github.com") return false;
    if (u.username !== "" || u.password !== "") return false;
    if (u.port !== "") return false;
    // `new URL()` already resolves literal `../` segments, but it leaves
    // percent-encoded ones alone — and a server that decodes before it routes
    // would then serve a path outside our repo. Refuse encoded separators and
    // dots outright; no real asset name contains them.
    if (/%2e|%2f|%5c/i.test(u.pathname)) return false;
    if (!u.pathname.startsWith(RELEASE_DOWNLOAD_PREFIX)) return false;
    return /\.apk$/i.test(u.pathname);
}

/**
 * Android `versionCode` for a semver string, using the exact formula
 * `android/app/build.gradle` derives the build's own versionCode with:
 * `major * 10000 + minor * 100 + patch`. Returns 0 when the string cannot be
 * parsed — native reads 0 as "no floor supplied", never as a failure.
 */
export function versionCodeFromSemver(version: string): number {
    const m = version
        .trim()
        .replace(/^v/i, "")
        .match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m) return 0;
    return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]);
}

/**
 * Choose the APK to install from a GitHub release's assets.
 *
 * Prefers a *universal* APK — one whose file name carries no ABI qualifier —
 * because a sideloaded build that ships a single universal APK is the
 * supported release shape (see the spec's ⚑ on arch-split APKs). When only
 * arch-split APKs are published we cannot know the device ABI here, so we fall
 * back to the first `.apk` asset as a documented, stable default rather than
 * guessing an ABI.
 *
 * Returns the asset's `browser_download_url`, or `null` when the release has
 * no `.apk` asset from a trusted URL (see `isTrustedApkUrl`) — the UI then
 * falls back to the release page.
 */
export function pickApkAsset(assets: ReleaseAsset[]): string | null {
    const apks = assets.filter(
        (a) =>
            /\.apk$/i.test(a.name) && isTrustedApkUrl(a.browser_download_url),
    );
    if (apks.length === 0) return null;
    const universal = apks.find((a) => !hasAbiQualifier(a.name));
    return (universal ?? apks[0]).browser_download_url;
}
