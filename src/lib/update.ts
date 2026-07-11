// Update checking against the GitHub Releases of this repo.
//
// Compares the current build version (injected from package.json at build time)
// against the latest published GitHub release and reports whether a newer
// version is available. "Updating" opens the release page in the browser /
// system browser (on Electron the window-open handler routes external URLs to
// the OS browser), where the user can grab the new installer/APK.

import { Capacitor } from "@capacitor/core";

/** Current build version (from package.json via the Vite `define`). */
export const APP_VERSION: string =
    typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "0.0.0";

/**
 * Whether this build can actually install an update by downloading a new
 * build (packaged desktop/native apps). The web build always serves the
 * latest version on reload, so there's nothing to download — the Update
 * button is disabled there.
 */
export const CAN_INSTALL_UPDATE: boolean =
    Capacitor.isNativePlatform() ||
    (typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent));

// GitHub repo to check for releases. Change if the project moves.
const GITHUB_OWNER = "az4521";
const GITHUB_REPO = "svelte_matrix_client";

const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

export interface UpdateInfo {
    current: string;
    latest: string;
    updateAvailable: boolean;
    /** GitHub release page URL. */
    url: string;
}

/** Parse "v1.2.3" / "1.2.3-beta" → [1, 2, 3]; missing parts default to 0. */
function parseVersion(v: string): number[] {
    const m = v.trim().replace(/^v/i, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) return [0, 0, 0];
    return [Number(m[1] || 0), Number(m[2] || 0), Number(m[3] || 0)];
}

/** Returns >0 if a > b, <0 if a < b, 0 if equal (compares major.minor.patch). */
export function compareVersions(a: string, b: string): number {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}

/**
 * Fetch the latest GitHub release and compare it to the current build.
 * Throws on network / API errors (e.g. no releases yet → 404).
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
    const res = await fetch(LATEST_RELEASE_API, {
        headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) {
        throw new Error(
            res.status === 404
                ? "No releases found yet."
                : `GitHub API error (${res.status}).`,
        );
    }
    const data = await res.json();
    const latest: string = (data.tag_name ?? data.name ?? "").toString();
    if (!latest) throw new Error("Could not read the latest version.");

    return {
        current: APP_VERSION,
        latest: latest.replace(/^v/i, ""),
        updateAvailable: compareVersions(latest, APP_VERSION) > 0,
        url:
            data.html_url ??
            `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
    };
}

/** Open the release page so the user can download the new build. */
export function openReleasePage(url: string): void {
    window.open(url, "_blank", "noopener");
}

/**
 * Force this tab/PWA to pick up a newly deployed build. Web/PWA installs have
 * no installer to run — "updating" means making sure a stale service worker
 * or HTTP-cached HTML/JS bundle isn't still being served, then reloading.
 *
 * A plain `location.reload()` isn't reliable here: an installed PWA has no
 * address bar to hard-refresh from, and a normal reload still respects the
 * HTTP cache, which can keep serving the old `index.html` (and therefore the
 * old hashed JS bundle) indefinitely depending on how the static build is
 * hosted.
 */
export async function reloadToLatest(): Promise<void> {
    if ("serviceWorker" in navigator) {
        try {
            const reg = await navigator.serviceWorker.getRegistration();
            await reg?.update();
        } catch {
            // Ignore — still attempt the reload below regardless.
        }
    }
    try {
        // Bypass the HTTP cache so a stale cached document doesn't just get
        // handed straight back to us by the reload() call that follows.
        await fetch(location.href, { cache: "reload" });
    } catch {
        // Offline or blocked — fall through and reload anyway.
    }
    location.reload();
}
