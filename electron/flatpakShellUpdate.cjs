// A release the web bundle cannot carry (a new shell, bundleUpdater.cjs), in
// the Flatpak: install it through the Flatpak portal (portalFlatpakUpdate.cjs)
// and restart into it, with the same statuses the installer path sends, so
// the UI and the "apply when idle" logic treat it like any other update.
//
// The GitHub release says a new shell exists; the Flatpak repo on GitHub Pages
// is published a few minutes after it. So an Update that finds nothing
// ("empty") either came too early, or the update is already installed (a
// software center or `flatpak update` got there first) and only a restart is
// missing. The repo's version.json, published with it, tells the two apart.
//
// Everything outside (the portal, the status channel, the network) comes in
// through `deps`, so the tests drive it without Electron or D-Bus.

const { compareVersions } = require("./bundleUpdater.cjs");

/** Passed to the new version, which waits for this one to let go of the
 *  profile instead of handing its arguments over and quitting. */
const AFTER_UPDATE_FLAG = "--zam-after-update";

/**
 * @param {{
 *   monitor: {
 *     update: (onProgress: (fraction: number) => void) => Promise<"done" | "empty">,
 *     spawnLatest: (argv: string[]) => Promise<void>,
 *   },
 *   runningVersion: string,
 *   sendStatus: (status: object) => void,
 *   isFailed: (version: string) => boolean,
 *   repoVersion: () => Promise<string | null>,
 *   log?: (...a: unknown[]) => void,
 * }} deps
 */
function createFlatpakShellUpdate(deps) {
    const log = deps.log ?? (() => {});
    // An update is installed and only a restart is missing.
    let installed = false;
    let installing = false;
    // The release the last offer was for.
    let version = null;

    const status = (s) => deps.sendStatus({ kind: "shell", version, ...s });

    async function install() {
        if (installing) return;
        installing = true;
        status({ phase: "downloading", percent: 0 });
        let lastSent = 0;
        try {
            const result = await deps.monitor.update((fraction) => {
                const percent = Math.round(fraction * 100);
                if (percent === lastSent) return;
                lastSent = percent;
                status({ phase: "downloading", percent });
            });
            if (result === "done" || (await installedAlready())) {
                installed = true;
                status({ phase: "downloaded" });
                return;
            }
            status({
                phase: "error",
                message: `${version ? `v${version}` : "The update"} is not in the Flatpak repository yet. Try again in a few minutes.`,
            });
        } catch (err) {
            log("update failed:", err?.dbusName, err?.message);
            // New permissions, or the user said no in the portal's dialog:
            // only the system's own tools can install it now.
            if (/NotSupported|AccessDenied/.test(err?.dbusName ?? ""))
                status({ phase: "unsupported", manual: "flatpak" });
            else
                status({
                    phase: "error",
                    message: err?.message ?? String(err),
                });
        } finally {
            installing = false;
        }
    }

    // Nothing to install: is what the repo has already newer than us?
    async function installedAlready() {
        try {
            const repo = await deps.repoVersion();
            return !!repo && compareVersions(repo, deps.runningVersion) > 0;
        } catch (err) {
            log("could not read the repo version:", err?.message ?? err);
            return false;
        }
    }

    return {
        /** The portal saw a newer installed or remote commit. An installed
         *  one only needs a restart. */
        updateAvailable(info) {
            if (info.localCommit && info.localCommit !== info.runningCommit)
                installed = true;
        },

        /**
         * A release needs a new shell. Says so, and installs it right away
         * for a background check with automatic updates on.
         */
        offer(newVersion, { manual, auto }) {
            version = newVersion;
            if (installed) {
                status({ phase: "downloaded" });
                return;
            }
            if (installing) return;
            const installFailed = deps.isFailed(newVersion);
            status({ phase: "available", installFailed });
            if (!manual && auto && !installFailed) void install();
        },

        /** "Download & install" in the UI. */
        install,

        isInstalled: () => installed,

        /** Start the installed update; the caller quits once this resolves. */
        async restart() {
            if (!installed) throw new Error("No Flatpak update is installed");
            await deps.monitor.spawnLatest(["zam", AFTER_UPDATE_FLAG]);
        },
    };
}

module.exports = { createFlatpakShellUpdate, AFTER_UPDATE_FLAG };
