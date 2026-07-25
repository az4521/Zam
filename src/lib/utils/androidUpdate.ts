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
 * no `.apk` asset at all (the UI then falls back to the release page).
 */
export function pickApkAsset(assets: ReleaseAsset[]): string | null {
    const apks = assets.filter((a) => /\.apk$/i.test(a.name));
    if (apks.length === 0) return null;
    const universal = apks.find((a) => !hasAbiQualifier(a.name));
    return (universal ?? apks[0]).browser_download_url;
}
