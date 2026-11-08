// Keeps an installer update that does not take from looping unattended.
//
// Before an installer is started, a marker records which version is being
// installed over which. The app quits and the installer runs; if it did not
// take, the next launch still reports the old version and finds the marker. A
// launch that finds the marker with the version unchanged records the target as
// failed. A failed version is never downloaded or applied automatically again
// (the user can still install it by hand), and an update that was applied
// automatically once is not applied automatically a second time either.

const fs = require("fs");
const path = require("path");

const PENDING_FILE = "pending-install.json";
const STATE_FILE = "update-state.json";

/** Numeric major.minor.patch comparison; >0 if a > b, <0 if a < b, 0 if equal. */
function compareVersions(a, b) {
    const parse = (v) => {
        const m = String(v ?? "")
            .trim()
            .replace(/^v/i, "")
            .match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
        return m
            ? [Number(m[1]), Number(m[2] || 0), Number(m[3] || 0)]
            : [0, 0, 0];
    };
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return null;
    }
}

function writeJson(file, value) {
    try {
        fs.writeFileSync(file, JSON.stringify(value));
    } catch {
        // Best-effort: losing the record only means one more manual attempt.
    }
}

function createUpdateGuard({ userDataDir, currentVersion, log = () => {} }) {
    const pendingFile = path.join(userDataDir, PENDING_FILE);
    const stateFile = path.join(userDataDir, STATE_FILE);
    let state = { failedVersion: null, failedAt: null };
    // The version an installer was last started for in this run. Not persisted:
    // if the install took, the next launch is on the new version; if it did not,
    // the marker turns it into a failed version on that launch.
    let attemptedVersion = null;

    const loaded = readJson(stateFile);
    if (loaded && typeof loaded.failedVersion === "string") {
        state = {
            failedVersion: loaded.failedVersion,
            failedAt: Number(loaded.failedAt) || null,
        };
    }

    function save() {
        writeJson(stateFile, state);
    }

    /**
     * Once per launch, before any check. Returns `{ pendingFailed }`, true when
     * the last installer did not take; the caller then clears the downloaded
     * installer so it is not re-announced.
     */
    function reconcile() {
        let pendingFailed = false;
        const pending = readJson(pendingFile);
        if (pending) {
            try {
                fs.rmSync(pendingFile, { force: true });
            } catch {
                // Left behind: the next launch sees the same versions and
                // reaches the same conclusion, so nothing is lost.
            }
            const to =
                typeof pending.toVersion === "string"
                    ? pending.toVersion
                    : null;
            if (to && compareVersions(currentVersion, to) >= 0) {
                log(
                    "info",
                    `installed ${currentVersion} (update to ${to} took)`,
                );
            } else if (to && pending.fromVersion === currentVersion) {
                pendingFailed = true;
                state = { failedVersion: to, failedAt: Date.now() };
                save();
                log(
                    "error",
                    `update to ${to} did not install: still running ${currentVersion}`,
                );
            } else {
                log(
                    "warn",
                    `ignored install marker ${JSON.stringify(pending)}`,
                );
            }
        }
        if (
            state.failedVersion &&
            compareVersions(currentVersion, state.failedVersion) >= 0
        ) {
            // Running that version or newer: the failure is history now.
            state = { failedVersion: null, failedAt: null };
            save();
        }
        return { pendingFailed };
    }

    /** Called right before an installer is started for `toVersion`. */
    function beginInstall(toVersion) {
        attemptedVersion = toVersion;
        writeJson(pendingFile, {
            toVersion,
            fromVersion: currentVersion,
            ts: Date.now(),
        });
        log("info", `installing ${toVersion} over ${currentVersion}`);
    }

    function failedVersion() {
        return state.failedVersion;
    }

    /** The version failed to install on an earlier launch. */
    function isFailed(version) {
        return !!version && version === state.failedVersion;
    }

    /** Automatic apply must not happen: failed before, or already attempted. */
    function isBlocked(version) {
        return !!version && (isFailed(version) || version === attemptedVersion);
    }

    return {
        reconcile,
        beginInstall,
        failedVersion,
        isFailed,
        isBlocked,
    };
}

module.exports = { createUpdateGuard, compareVersions };
