// Turning Steam's CEF remote-debugging port (127.0.0.1:8080) on and off, and
// restarting Steam so a change takes effect. Steam opens the port when it finds
// a flag file named .cef-enable-remote-debugging in its root folder, so
// enabling it means a restart.
//
// Nothing here runs on its own: the settings page asks first, because a
// restart ends a program the user is using. Each platform has an adapter:
//
//   Windows  a flag file next to steam.exe (the folder steamExe() finds). The
//            folder is user-writable, so no registry and no elevation are needed.
//            An earlier version wrote an Image File Execution Options Debugger
//            value on steam.exe instead, and a leftover of that breaks Steam's
//            launch. enable and disable remove such a leftover (removeLegacyIfeo,
//            one elevated call, and only when one is present).
//   Linux    a flag file in ~/.steam/steam (and the Flatpak Steam root)
//   macOS    a flag file in ~/Library/Application Support/Steam
//
// A Flatpak Zam cannot see or end host programs, so the same steps go through
// flatpak-spawn --host when the user granted host access.

const { execFile, spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { cleanEnv } = require("./discordRestart.cjs");
const { hostAccessAllowed } = require("./gameScanner.cjs");

const IFEO_KEY =
    "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\steam.exe";
// The 32-bit view is HKLM\SOFTWARE\WOW6432Node\...; reg.exe reaches it with /reg:32.
const VIEWS = ["64", "32"];
const VIEW_NAME = { 64: "64-bit", 32: "32-bit" };
const WIN_IMAGES = ["steam.exe", "steamwebhelper.exe"];
const FLAG_FILE = ".cef-enable-remote-debugging";
const FLATPAK_STEAM = "com.valvesoftware.Steam";
const SHUTDOWN_POLLS = 20;
const SUPPORTED = new Set(["win32", "linux", "darwin"]);

function runCommand(cmd, args) {
    return new Promise((resolve, reject) => {
        execFile(
            cmd,
            args,
            { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
            (err, stdout, stderr) => {
                if (!err) return resolve(String(stdout));
                // Callers test for failures (a missing registry value exits 1),
                // so reject and let them decide.
                reject(new Error(String(stderr).trim() || err.message));
            },
        );
    });
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function launchDetached(cmd, args) {
    const child = spawn(cmd, args, {
        env: cleanEnv(),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
    });
    child.on("error", () => {});
    child.unref();
}

function probeDebugPort() {
    return new Promise((resolve) => {
        // A plain connect is not enough: some other program on 8080 would pass.
        // CEF answers /json/version with 200 only when remote debugging is on.
        const req = http.get(
            {
                host: "127.0.0.1",
                port: 8080,
                path: "/json/version",
                timeout: 1500,
            },
            (res) => {
                res.resume();
                resolve(res.statusCode === 200);
            },
        );
        req.on("timeout", () => {
            req.destroy();
            resolve(false);
        });
        req.on("error", () => resolve(false));
    });
}

/**
 * Pulls the main Steam processes out of `ps -axww -o pid=,args=` output. The
 * web helpers (steamwebhelper, steamerrorreporter) are left out; they keep
 * running after a restart is asked for and are not what the user runs.
 */
function findSteamProcesses(text) {
    const out = [];
    for (const line of String(text).split("\n")) {
        const m = /^\s*(\d+)\s+(.*)$/.exec(line);
        if (!m) continue;
        const args = m[2].trim();
        if (/steamwebhelper|steamerrorreporter/i.test(args)) continue;
        // The executable is `steam` (Linux, Flatpak) or `steam_osx` (macOS),
        // either as a bare name or after a slash, followed by a space or the end.
        if (!/(^|\/)(steam|steam_osx)(\s|$)/.test(args)) continue;
        out.push({ pid: Number(m[1]), args });
    }
    return out;
}

/** The Windows flag file: Steam's root is the folder that holds steam.exe. */
const winFlagPath = (exe) =>
    path.win32.join(path.win32.dirname(exe), FLAG_FILE);

/** Single-quoted PowerShell string: only ' needs escaping. */
const psq = (s) => `'${s.replace(/'/g, "''")}'`;

const EXIT_CHECK = "if ($LASTEXITCODE -ne 0) { exit 1 }";

// Removes the IFEO subkey only when it has nothing in it. Other values
// (GlobalFlag and the like) or subkeys were written by someone else, so an
// indented line in `reg query` output means the key stays.
const REMOVE_IF_EMPTY_FN = [
    "function Remove-KeyIfEmpty([string]$key, [string]$view) {",
    "    $q = & reg.exe query $key /reg:$view",
    "    if ($LASTEXITCODE -ne 0) { return }",
    "    if (-not ($q | Where-Object { $_ -match '^\\s+\\S' })) {",
    "        & reg.exe delete $key /f /reg:$view",
    "        if ($LASTEXITCODE -ne 0) { exit 1 }",
    "    }",
    "}",
].join("\r\n");

/**
 * Zam's Steam debugging control. Every side effect goes through the injected
 * functions so the logic can be tested without touching the registry, the
 * file system or a Steam process.
 */
function createSteamDebug({
    platform = process.platform,
    inFlatpak = false,
    env = process.env,
    home = require("os").homedir(),
    run = runCommand,
    exists = fs.existsSync,
    probePort = probeDebugPort,
    log = () => {},
    fsOps,
    hostAllowed = hostAccessAllowed,
    spawnDetached = launchDetached,
    kill = (pid, sig) => process.kill(pid, sig),
    sleep = defaultSleep,
} = {}) {
    // Flatpak Zam: the sandbox sees its own copy of the home folder, not the
    // host's, so the flag file and the ps check happen on the host.
    const hostRun = (cmd, args) =>
        inFlatpak
            ? run("flatpak-spawn", ["--host", cmd, ...args])
            : run(cmd, args);
    const ops = fsOps || (inFlatpak ? hostFsOps(run) : realFsOps);

    const safe = async (fn, fallback) => {
        try {
            return await fn();
        } catch (e) {
            log("steam debug:", e);
            return fallback;
        }
    };
    const allowedHost = () => safe(async () => !!(await hostAllowed()), false);

    async function supportedNow() {
        if (!SUPPORTED.has(platform)) return false;
        if (platform === "win32" || !inFlatpak) return true;
        return allowedHost();
    }

    /** null when the platform can do the job, else the error to return. */
    async function gate() {
        if (!SUPPORTED.has(platform))
            return { ok: false, error: "not supported on this system" };
        if (!(await supportedNow()))
            return {
                ok: false,
                error: "Zam needs host access to change Steam's settings",
            };
        return null;
    }

    const cancelled = () => ({
        ok: false,
        cancelled: true,
        error: "administrator permission was not granted",
    });

    // ── Windows ────────────────────────────────────────────────────────────

    /** The steam.exe path, or null when neither the registry nor the default install has one. */
    async function steamExe() {
        let fromReg = null;
        try {
            const out = await run("reg", [
                "query",
                "HKCU\\Software\\Valve\\Steam",
                "/v",
                "SteamExe",
            ]);
            const m = /^\s*SteamExe\s+REG_(?:SZ|EXPAND_SZ)\s+(.*?)\s*$/m.exec(
                out,
            );
            // Steam writes this with forward slashes; the rest of Windows wants backslashes.
            if (m && m[1])
                fromReg = m[1].replace(/^"|"$/g, "").replace(/\//g, "\\");
        } catch {}
        const pf = env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
        const fallback = path.win32.join(pf, "Steam", "steam.exe");
        if (fromReg && exists(fromReg)) return fromReg;
        if (exists(fallback)) return fallback;
        return null;
    }

    /** What is in one registry view of the IFEO key: the Debugger value and whether the key is empty. */
    async function readKey(view) {
        let out;
        try {
            out = await run("reg", ["query", IFEO_KEY, `/reg:${view}`]);
        } catch {
            return { present: false, empty: false, debugger: null };
        }
        const m = /^\s+Debugger\s+REG_(?:SZ|EXPAND_SZ)\s+(.*?)\s*$/m.exec(out);
        // Value and subkey lines are indented; the key's own name is not.
        const children = String(out)
            .split(/\r?\n/)
            .filter((l) => /^\s+\S/.test(l));
        return {
            present: true,
            empty: children.length === 0,
            debugger: m ? m[1] : null,
        };
    }

    async function readViews() {
        const out = {};
        for (const v of VIEWS) out[v] = await readKey(v);
        return out;
    }

    const isOurs = (state) =>
        typeof state.debugger === "string" &&
        /-cef-enable-debugging$/i.test(state.debugger.trim());

    /**
     * Runs the PowerShell in one elevated process. Resolves null when the call
     * returned, or the error when it did not (UAC declined, PowerShell missing).
     * The caller checks the registry afterwards, which is what decides success.
     */
    async function runElevated(lines) {
        const script = ["$ErrorActionPreference = 'Stop'", ...lines].join(
            "\r\n",
        );
        const b64 = Buffer.from(script, "utf16le").toString("base64");
        const outer =
            "Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden " +
            `-ArgumentList '-NoProfile','-EncodedCommand','${b64}'`;
        try {
            await run("powershell", [
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-Command",
                outer,
            ]);
            return null;
        } catch (e) {
            log("steam debug: elevated change failed", e);
            return e;
        }
    }

    /**
     * Removes the Debugger value an earlier version wrote on steam.exe, in both
     * registry views. With no leftover it returns at once and runs no elevated call.
     */
    async function removeLegacyIfeo() {
        const before = await readViews();
        const ours = VIEWS.filter((v) => isOurs(before[v]));
        if (ours.length === 0) return { ok: true };

        // Only our Debugger value goes; a different debugger on steam.exe is someone else's.
        const lines = [REMOVE_IF_EMPTY_FN];
        for (const v of ours) {
            lines.push(
                `& reg.exe delete ${psq(IFEO_KEY)} /v Debugger /f /reg:${v}`,
                EXIT_CHECK,
                `Remove-KeyIfEmpty ${psq(IFEO_KEY)} ${v}`,
            );
        }
        const failure = await runElevated(lines);

        const after = await readViews();
        // An empty key we had written counts as left behind too.
        const remaining = ours.filter(
            (v) => isOurs(after[v]) || (after[v].present && after[v].empty),
        );
        if (remaining.length === 0) return { ok: true };
        if (failure && remaining.length === ours.length) return cancelled();
        return {
            ok: false,
            error: `Steam's debugging setting is still in the ${remaining
                .map((v) => VIEW_NAME[v])
                .join(" and ")} registry view`,
        };
    }

    async function enableWindows() {
        const exe = await steamExe();
        if (!exe) return { ok: false, error: "Steam's folder wasn't found" };
        const legacy = await removeLegacyIfeo();
        if (!legacy.ok) return legacy;
        const flag = winFlagPath(exe);
        await ops.touch(flag);
        if (!(await ops.exists(flag)))
            return {
                ok: false,
                error: "Steam's debugging flag wasn't created",
            };
        return { ok: true };
    }

    async function disableWindows() {
        const exe = await steamExe();
        const flag = exe ? winFlagPath(exe) : null;
        if (flag && (await ops.exists(flag))) await ops.remove(flag);
        const legacy = await removeLegacyIfeo();
        if (!legacy.ok) return legacy;
        // Read back: a flag that stayed must be reported, not hidden.
        if (flag && (await ops.exists(flag)))
            return {
                ok: false,
                error: `Steam's debugging flag is still in ${path.win32.dirname(flag)}`,
            };
        return { ok: true };
    }

    async function imageRunning(image) {
        return safe(async () => {
            const out = await run("tasklist", [
                "/FI",
                `IMAGENAME eq ${image}`,
                "/NH",
            ]);
            return out.toLowerCase().includes(image.toLowerCase());
        }, false);
    }

    async function anyImageRunning() {
        for (const img of WIN_IMAGES) if (await imageRunning(img)) return true;
        return false;
    }

    /** Polls check() until it is false; true when it became false in time. */
    async function waitGone(check, attempts, ms = 1000) {
        for (let i = 0; i < attempts; i++) {
            if (!(await check())) return true;
            await sleep(ms);
        }
        return !(await check());
    }

    async function restartWindows() {
        if (!(await imageRunning("steam.exe")))
            return { ok: false, error: "Steam isn't running" };
        const exe = await steamExe();
        if (!exe) return { ok: false, error: "Steam's folder wasn't found" };

        // Steam's own -shutdown saves its state; the process kill is only a fallback.
        await safe(() => run(exe, ["-shutdown"]), undefined);
        const gone = await waitGone(anyImageRunning, SHUTDOWN_POLLS);
        if (!gone) {
            for (const img of WIN_IMAGES)
                await safe(
                    () => run("taskkill", ["/F", "/T", "/IM", img]),
                    undefined,
                );
            await waitGone(anyImageRunning, 10, 500);
        }
        spawnDetached(exe, []);
        return { ok: true };
    }

    // ── macOS and Linux ────────────────────────────────────────────────────

    async function unixProcesses() {
        return safe(
            async () =>
                findSteamProcesses(
                    await hostRun("ps", ["-axww", "-o", "pid=,args="]),
                ),
            [],
        );
    }

    async function flatpakSteamRunning() {
        if (platform !== "linux") return false;
        return safe(
            async () =>
                (await hostRun("flatpak", ["ps", "--columns=application"]))
                    .split(/\r?\n/)
                    .some((l) => l.trim() === FLATPAK_STEAM),
            false,
        );
    }

    async function steamRunning() {
        if (platform === "win32") return imageRunning("steam.exe");
        return (
            (await unixProcesses()).length > 0 || (await flatpakSteamRunning())
        );
    }

    function steamRoots() {
        if (platform === "darwin")
            return [path.join(home, "Library", "Application Support", "Steam")];
        return [
            path.join(home, ".steam", "steam"),
            path.join(
                home,
                ".var",
                "app",
                FLATPAK_STEAM,
                ".local",
                "share",
                "Steam",
            ),
        ];
    }

    async function flagPresent() {
        for (const root of steamRoots())
            if (await ops.exists(path.join(root, FLAG_FILE))) return true;
        return false;
    }

    async function setUnixFlag(on) {
        const roots = steamRoots();
        if (on) {
            const present = [];
            for (const r of roots) if (await ops.exists(r)) present.push(r);
            if (present.length === 0)
                return { ok: false, error: "Steam's folder wasn't found" };
            for (const r of present) await ops.touch(path.join(r, FLAG_FILE));
            return { ok: true };
        }
        for (const r of roots) {
            const file = path.join(r, FLAG_FILE);
            if (await ops.exists(file)) await ops.remove(file);
        }
        // Read back: a root that refused the removal must be reported, not hidden.
        const remaining = [];
        for (const r of roots)
            if (await ops.exists(path.join(r, FLAG_FILE))) remaining.push(r);
        if (remaining.length === 0) return { ok: true };
        return {
            ok: false,
            error: `Steam's debugging flag is still in ${remaining.join(", ")}`,
        };
    }

    const killPid = (pid, sig) =>
        inFlatpak
            ? hostRun("kill", [`-${sig}`, String(pid)])
            : Promise.resolve(kill(pid, sig));

    // Starts Steam the way the desktop would: detached, so it outlives Zam.
    function startDetached(cmd, args, shellLine) {
        if (inFlatpak)
            spawnDetached("flatpak-spawn", [
                "--host",
                "sh",
                "-c",
                `setsid -f ${shellLine} >/dev/null 2>&1`,
            ]);
        else spawnDetached(cmd, args);
    }

    async function restartUnix() {
        const procs = await unixProcesses();
        const flatpakSteam = await flatpakSteamRunning();
        if (procs.length === 0 && !flatpakSteam)
            return { ok: false, error: "Steam isn't running" };

        if (platform === "darwin") {
            await safe(
                () => hostRun("osascript", ["-e", 'quit app "Steam"']),
                undefined,
            );
        } else if (flatpakSteam) {
            await safe(
                () => hostRun("flatpak", ["kill", FLATPAK_STEAM]),
                undefined,
            );
        } else {
            // Shut down the copy that is running, not whichever `steam` is first on PATH.
            const exe = procs[0].args.split(/\s+/)[0];
            const cmd = exe.startsWith("/") ? exe : "steam";
            await safe(() => hostRun(cmd, ["-shutdown"]), undefined);
        }

        if (!(await waitGone(steamRunning, SHUTDOWN_POLLS))) {
            for (const p of await unixProcesses())
                await safe(() => killPid(p.pid, "TERM"), undefined);
            if (!(await waitGone(steamRunning, 5)))
                for (const p of await unixProcesses())
                    await safe(() => killPid(p.pid, "KILL"), undefined);
        }

        if (platform === "darwin")
            startDetached("open", ["-a", "Steam"], "open -a Steam");
        else if (flatpakSteam)
            startDetached(
                "flatpak",
                ["run", FLATPAK_STEAM],
                `flatpak run ${FLATPAK_STEAM}`,
            );
        else
            startDetached(
                "xdg-open",
                ["steam://open/main"],
                "xdg-open steam://open/main",
            );
        return { ok: true };
    }

    // ── Public API ─────────────────────────────────────────────────────────

    async function status() {
        const supported = await supportedNow();
        const portOpen = await safe(() => probePort(), false);
        if (!supported)
            return { supported, enabled: false, portOpen, steamRunning: false };
        if (platform === "win32") {
            const exe = await steamExe();
            const enabled = !!exe && (await ops.exists(winFlagPath(exe)));
            const views = await readViews();
            return {
                supported,
                enabled,
                portOpen,
                steamRunning: await steamRunning(),
                legacyIfeo: VIEWS.some((v) => isOurs(views[v])),
            };
        }
        return {
            supported,
            enabled: await flagPresent(),
            portOpen,
            steamRunning: await steamRunning(),
        };
    }

    async function attempt(fn) {
        const g = await gate();
        if (g) return g;
        try {
            return await fn();
        } catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    }

    const enable = () =>
        attempt(() =>
            platform === "win32" ? enableWindows() : setUnixFlag(true),
        );
    const disable = () =>
        attempt(() =>
            platform === "win32" ? disableWindows() : setUnixFlag(false),
        );
    const restartSteam = () =>
        attempt(() =>
            platform === "win32" ? restartWindows() : restartUnix(),
        );

    return { status, enable, disable, restartSteam };
}

// The real file system for the Linux and macOS flag file.
const realFsOps = {
    exists: (p) => fs.existsSync(p),
    touch: (p) => fs.writeFileSync(p, "", { flag: "a" }),
    remove: (p) => fs.rmSync(p, { force: true }),
};

// The same operations on the host, for a Flatpak Zam. The path is passed as a
// positional argument so it is never interpolated into the shell script.
function hostFsOps(run) {
    const sh = (script, p) =>
        run("flatpak-spawn", ["--host", "sh", "-c", script, "sh", p]);
    return {
        exists: async (p) => {
            try {
                await sh('test -e "$1"', p);
                return true;
            } catch {
                return false;
            }
        },
        touch: (p) => sh('touch "$1"', p),
        remove: (p) => sh('rm -f "$1"', p),
    };
}

module.exports = { createSteamDebug, findSteamProcesses };
