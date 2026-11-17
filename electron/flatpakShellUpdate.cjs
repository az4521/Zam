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

/** How long the new version has to show it started, per way of starting it,
 *  before this one tries the next or asks the user to reopen Zam. */
const NEW_VERSION_START_MS = 20 * 1000;

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
 *   hostLaunch?: (appArgs: string[]) => Promise<void>,
 *   startTimeoutMs?: number,
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
    // A restart in flight, and the attempt in it waiting for the new version
    // to show up.
    let restarting = null;
    let waiting = null;
    // The portal started the new version but it never showed up.
    let restartFailed = false;

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

    // Start the new version one way and wait for it to show up.
    async function launchAndWait(launch) {
        let timer;
        const started = new Promise((resolve) => {
            waiting = resolve;
            timer = setTimeout(
                () => resolve(false),
                deps.startTimeoutMs ?? NEW_VERSION_START_MS,
            );
        });
        try {
            await launch();
            return await started;
        } finally {
            clearTimeout(timer);
            waiting = null;
        }
    }

    async function tryLaunchers() {
        const args = [AFTER_UPDATE_FLAG];
        const launchers = [
            ...(deps.hostLaunch ? [["host", () => deps.hostLaunch(args)]] : []),
            ["portal", () => deps.monitor.spawnLatest(["zam", ...args])],
        ];
        let launched = false;
        let lastError = null;
        for (const [how, launch] of launchers) {
            try {
                if (await launchAndWait(launch)) return true;
                launched = true;
                log(`${how}: the new version did not start`);
            } catch (err) {
                lastError = err;
                log(`${how}: could not start the new version:`, err?.message);
            }
        }
        if (!launched) throw lastError;
        restartFailed = true;
        return false;
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

        /**
         * Start the installed update. Resolves true once the new version has
         * started (newVersionStarted), and the caller quits; false when it
         * never did, and this one has to stay.
         *
         * Tries `flatpak run` on the host first (flatpakHostLaunch.cjs),
         * which can give the new version the display this one has, then the
         * portal's Spawn. The portal starts it with its own environment
         * before flatpak 1.16, which on many Wayland desktops has no display:
         * the new version then exits at once, and quitting without waiting
         * left the user with no Zam at all.
         */
        restart() {
            if (!installed)
                return Promise.reject(
                    new Error("No Flatpak update is installed"),
                );
            if (!restarting)
                restarting = tryLaunchers().finally(() => {
                    restarting = null;
                });
            return restarting;
        },

        /** The new version asked for the single-instance lock, which it does
         *  only once it is up (main.cjs). */
        newVersionStarted() {
            waiting?.(true);
        },

        /** A restart was tried and the new version never started: only
         *  quitting and reopening Zam by hand will run it. */
        restartFailed: () => restartFailed,
    };
}

module.exports = {
    createFlatpakShellUpdate,
    AFTER_UPDATE_FLAG,
    NEW_VERSION_START_MS,
};
