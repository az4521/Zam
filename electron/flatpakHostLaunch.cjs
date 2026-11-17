// Restarting into a Flatpak update by running `flatpak run` on the host
// (flatpak-spawn --host, which the org.freedesktop.Flatpak talk permission
// allows), ahead of the portal's Spawn (portalFlatpakUpdate.cjs).
//
// Why: both the portal and the host command helper are D-Bus activated, and
// their environment often lacks WAYLAND_DISPLAY and DISPLAY (wlroots
// compositors that never export them, or a helper started before they were
// set). `flatpak run` reads WAYLAND_DISPLAY to pick the socket it binds into
// the new sandbox, falling back to wayland-0, so the new version started
// without a display and exited. The portal's Spawn gives us no say in
// `flatpak run`'s own environment before flatpak 1.16; on the host we fill in
// whatever is missing there from what this sandbox has, and keep what the
// host already set. A plain `flatpak run` also picks up a newer runtime,
// which the portal's Spawn keeps at the running one.

const fs = require("fs");
const { execFile } = require("child_process");

// Runs on the host. $1-$3 fill WAYLAND_DISPLAY, XDG_SESSION_TYPE and
// XDG_CURRENT_DESKTOP only where the host has none; DISPLAY, which the
// sandbox only knows as :99, comes from the host's X sockets. The rest is the
// `flatpak` command line. setsid -f so the new version outlives this process.
const HOST_SCRIPT = [
    '[ -n "$WAYLAND_DISPLAY" ] || [ -z "$1" ] || export WAYLAND_DISPLAY="$1"',
    '[ -n "$XDG_SESSION_TYPE" ] || [ -z "$2" ] || export XDG_SESSION_TYPE="$2"',
    '[ -n "$XDG_CURRENT_DESKTOP" ] || [ -z "$3" ] || export XDG_CURRENT_DESKTOP="$3"',
    'if [ -z "$DISPLAY" ]; then',
    "    for s in /tmp/.X11-unix/X*; do",
    '        [ -S "$s" ] && export DISPLAY=":${s#/tmp/.X11-unix/X}" && break',
    "    done",
    "fi",
    "shift 3",
    'exec setsid -f flatpak "$@" >/dev/null 2>&1 </dev/null',
].join("\n");

/** The keys of one group of /.flatpak-info (a key file). */
function readKeyFileGroup(text, group) {
    const out = {};
    let inGroup = false;
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const header = /^\[(.+)\]$/.exec(line);
        if (header) {
            inGroup = header[1] === group;
            continue;
        }
        if (!inGroup) continue;
        const eq = line.indexOf("=");
        if (eq > 0) out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return out;
}

/**
 * The `flatpak-spawn` arguments that start the installed version of this app
 * on the host, or null when /.flatpak-info does not say enough.
 * @param {string} flatpakInfo the text of /.flatpak-info
 * @param {Record<string, string | undefined>} env this process's environment
 * @param {string[]} appArgs arguments for the new version
 */
function hostLaunchArgs(flatpakInfo, env, appArgs) {
    const app = readKeyFileGroup(flatpakInfo, "Application");
    const instance = readKeyFileGroup(flatpakInfo, "Instance");
    const appId = app.name;
    if (!appId || !/^[\w.-]+$/.test(appId)) return null;
    const run = ["run"];
    // The installation this copy runs from, so a user and a system install
    // of the same app cannot mix.
    const appPath = instance["app-path"] ?? "";
    if (appPath.includes("/.local/share/flatpak/app/")) run.push("--user");
    else if (appPath.startsWith("/var/lib/flatpak/app/")) run.push("--system");
    if (/^[\w.-]+$/.test(instance.branch ?? ""))
        run.push(`--branch=${instance.branch}`);
    if (/^[\w.-]+$/.test(instance.arch ?? ""))
        run.push(`--arch=${instance.arch}`);
    run.push(appId, ...appArgs);
    // Inside the sandbox WAYLAND_DISPLAY is the host's name for the socket
    // unless flatpak renamed it to wayland-0 (any other form), which says
    // nothing about the host's.
    const wayland = env.WAYLAND_DISPLAY ?? "";
    return [
        "--host",
        "sh",
        "-c",
        HOST_SCRIPT,
        "sh",
        /^wayland-[\w.-]+$/.test(wayland) ? wayland : "",
        env.XDG_SESSION_TYPE ?? "",
        env.XDG_CURRENT_DESKTOP ?? "",
        ...run,
    ];
}

/**
 * Start the installed version on the host. Rejects when it could not be
 * asked (no flatpak-spawn, no permission for the host); whether the new
 * version really came up is for the caller to see.
 * @param {string[]} appArgs
 */
function launchOnHost(appArgs) {
    return new Promise((resolve, reject) => {
        let info;
        try {
            info = fs.readFileSync("/.flatpak-info", "utf8");
        } catch (err) {
            reject(err);
            return;
        }
        const args = hostLaunchArgs(info, process.env, appArgs);
        if (!args) {
            reject(new Error("/.flatpak-info names no app"));
            return;
        }
        execFile("flatpak-spawn", args, { timeout: 15000 }, (err) =>
            err ? reject(err) : resolve(),
        );
    });
}

module.exports = { hostLaunchArgs, launchOnHost, HOST_SCRIPT };
