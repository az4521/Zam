"use strict";

// How this copy of the app was installed. The updater needs it: an installer
// swapped in underneath a package manager leaves the manager's records (and its
// next upgrade) disagreeing with what is on disk, so a package-managed copy is
// told about new releases and left to the manager.
//
// Format-based sources are detected from the environment. Package managers
// cannot be told apart that way (winget runs the very same installer as a
// download does), so whatever installs the app marks it: an `install-source`
// file holding the manager's name, in the resources folder or next to the
// executable, or ZAM_INSTALL_SOURCE in the environment.

const fs = require("node:fs");
const path = require("node:path");

// Marker value → how it is shown. Anything else in a marker is ignored, so a
// stray file cannot put arbitrary text into the UI or switch updates off.
const MANAGERS = {
    winget: "winget",
    scoop: "Scoop",
    chocolatey: "Chocolatey",
    homebrew: "Homebrew",
    nix: "Nix",
    aur: "the AUR",
    apt: "apt",
    dnf: "dnf",
    fdroid: "F-Droid",
};

const MARKER_FILE = "install-source";

function readMarker(dirs, readFile) {
    for (const dir of dirs) {
        if (!dir) continue;
        try {
            const text = readFile(path.join(dir, MARKER_FILE), "utf8");
            const id = String(text).trim().toLowerCase();
            if (MANAGERS[id]) return id;
        } catch {
            // No marker here.
        }
    }
    return null;
}

/**
 * @returns {{ id: string, managed: boolean, manager?: string }}
 *   `id` is flatpak | portable | appimage | installer | dmg | unpackaged, or a
 *   key of MANAGERS; `managed` is true for the latter, with `manager` its name.
 */
function detectInstallSource({
    env = process.env,
    platform = process.platform,
    resourcesDir = process.resourcesPath,
    exeDir = null,
    readFile = fs.readFileSync,
} = {}) {
    if (env.FLATPAK_ID) return { id: "flatpak", managed: false };
    const fromEnv = String(env.ZAM_INSTALL_SOURCE ?? "")
        .trim()
        .toLowerCase();
    const id = MANAGERS[fromEnv]
        ? fromEnv
        : readMarker([resourcesDir, exeDir], readFile);
    if (id) return { id, managed: true, manager: MANAGERS[id] };
    if (env.PORTABLE_EXECUTABLE_FILE) return { id: "portable", managed: false };
    if (env.APPIMAGE) return { id: "appimage", managed: false };
    if (platform === "darwin") return { id: "dmg", managed: false };
    return { id: "installer", managed: false };
}

module.exports = { detectInstallSource, MANAGERS, MARKER_FILE };
