// Restarting the Discord desktop app so Zam can hold the first discord-ipc
// slot. Apps report to the lowest slot that answers; when Discord starts before
// Zam it owns slot 0 and the apps never reach us. Closing Discord, letting Zam
// take slot 0 and then starting Discord again puts it on a later slot, where
// discordRpc.cjs passes the apps' activity on to it.
//
// It ends a program the user is using, so the settings page asks first;
// nothing here runs on its own. Each platform has an adapter that finds the
// running Discord (stable, PTB or Canary), stops it and starts it again:
//
//   Windows  tasklist / taskkill, started through the install's Update.exe
//   macOS    ps / SIGTERM, started with `open -a`
//   Linux    ps / SIGTERM, started from the executable it was running
//
// A Flatpak or Snap Discord keeps its socket in its own folder, so it never
// takes our slot and is left alone.

const { execFile, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const VARIANTS = ["Discord", "DiscordPTB", "DiscordCanary"];

function run(cmd, args) {
    return new Promise((resolve) => {
        execFile(
            cmd,
            args,
            { windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
            (err, stdout) => resolve(err ? "" : String(stdout)),
        );
    });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Zam's environment without what marks it as Zam. Discord inherits it, and
 * Chromium's CHROME_DESKTOP / GIO_LAUNCHED_DESKTOP_FILE would make it present
 * itself (tray icon included) as Zam's desktop entry.
 */
function cleanEnv(env = process.env) {
    const out = {};
    for (const [k, v] of Object.entries(env)) {
        if (
            /^(ELECTRON_|CHROME_|GIO_LAUNCHED_DESKTOP_FILE|NODE_OPTIONS$)/.test(
                k,
            )
        )
            continue;
        out[k] = v;
    }
    if (out.ORIGINAL_XDG_CURRENT_DESKTOP !== undefined) {
        out.XDG_CURRENT_DESKTOP = out.ORIGINAL_XDG_CURRENT_DESKTOP;
        delete out.ORIGINAL_XDG_CURRENT_DESKTOP;
    }
    return out;
}

function launch(cmd, args) {
    const child = spawn(cmd, args, {
        env: cleanEnv(),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
    });
    child.on("error", () => {});
    child.unref();
}

// ── Windows ────────────────────────────────────────────────────────────────

/** The Discord variants that are running and have an install we can start. */
async function runningInstalls({
    env = process.env,
    exists = fs.existsSync,
    tasklist = () => run("tasklist", ["/FO", "CSV", "/NH"]),
} = {}) {
    const out = (await tasklist()).toLowerCase();
    const root = env.LOCALAPPDATA;
    if (!root) return [];
    const found = [];
    for (const name of VARIANTS) {
        if (!out.includes(`"${name.toLowerCase()}.exe"`)) continue;
        const update = path.join(root, name, "Update.exe");
        if (exists(update)) found.push({ name, update });
    }
    return found;
}

// A killed program leaves its notification-area icon behind until the mouse
// passes over it, and the ghost can keep the next Discord's own icon from
// showing. Sweeping the mouse over every icon makes Explorer drop dead ones.
const PURGE_TRAY = `
Add-Type -Namespace Z -Name T -MemberDefinition '
[DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string w);
[DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr a, string c, string w);
[DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
[DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
public struct RECT { public int L, T, R, B; }'
function Sweep($bar) {
    if ($bar -eq [IntPtr]::Zero) { return }
    $r = New-Object Z.T+RECT
    [void][Z.T]::GetClientRect($bar, [ref]$r)
    for ($x = 0; $x -lt $r.R; $x += 4) {
        [void][Z.T]::SendMessage($bar, 0x200, [IntPtr]::Zero, [IntPtr](($r.B / 2) * 65536 + $x))
    }
}
$tray = [Z.T]::FindWindow('Shell_TrayWnd', $null)
$notify = [Z.T]::FindWindowEx($tray, [IntPtr]::Zero, 'TrayNotifyWnd', $null)
$pager = [Z.T]::FindWindowEx($notify, [IntPtr]::Zero, 'SysPager', $null)
Sweep ([Z.T]::FindWindowEx($pager, [IntPtr]::Zero, 'ToolbarWindow32', $null))
$over = [Z.T]::FindWindow('NotifyIconOverflowWindow', $null)
Sweep ([Z.T]::FindWindowEx($over, [IntPtr]::Zero, 'ToolbarWindow32', $null))
`;

const purgeTrayGhosts = () =>
    run("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        PURGE_TRAY,
    ]);

const windowsAdapter = {
    find: () => runningInstalls(),
    stop: async ({ name }) => {
        await run("taskkill", ["/F", "/T", "/IM", `${name}.exe`]);
        await sleep(500);
        await purgeTrayGhosts();
    },
    alive: async ({ name }) =>
        (await run("tasklist", ["/FI", `IMAGENAME eq ${name}.exe`, "/NH"]))
            .toLowerCase()
            .includes(`${name.toLowerCase()}.exe`),
    start: ({ name, update }) =>
        launch(update, ["--processStart", `${name}.exe`]),
};

// ── macOS and Linux ────────────────────────────────────────────────────────

/**
 * The main Discord processes in `ps -axww -o pid=,args=` output (not the
 * helpers, which carry --type=). On Linux each has `exe`, the program to start
 * again; on macOS `app`, the name for `open -a`. A Flatpak (/app/...) or Snap
 * (/snap/...) Discord is left out.
 */
function parseUnixProcesses(text, platform) {
    const out = [];
    for (const line of String(text).split("\n")) {
        const m = /^\s*(\d+)\s+(.*)$/.exec(line);
        if (!m) continue;
        const pid = Number(m[1]);
        const args = m[2];
        if (/\s--type=/.test(args)) continue;
        if (platform === "darwin") {
            const a =
                /\/(Discord(?: PTB| Canary)?)\.app\/Contents\/MacOS\/Discord(?: PTB| Canary)?(?:\s|$)/.exec(
                    args,
                );
            if (a) out.push({ name: a[1], pid, app: a[1] });
        } else {
            const a = /^(\S*\/)?(discord(?:ptb|canary)?)(?:\s|$)/i.exec(args);
            if (!a) continue;
            const exe = `${a[1] ?? ""}${a[2]}`;
            if (/^\/(app|snap)\//.test(exe) || !path.isAbsolute(exe)) continue;
            out.push({ name: a[2], pid, exe });
        }
    }
    return out;
}

function pidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return e.code === "EPERM";
    }
}

function unixAdapter(platform) {
    return {
        find: async () =>
            parseUnixProcesses(
                await run("ps", ["-axww", "-o", "pid=,args="]),
                platform,
            ),
        stop: async ({ pid }) => {
            try {
                process.kill(pid, "SIGTERM");
            } catch {}
            // Ask nicely first; Discord can take a moment to close.
            for (let i = 0; i < 20 && pidAlive(pid); i++) await sleep(250);
            try {
                if (pidAlive(pid)) process.kill(pid, "SIGKILL");
            } catch {}
        },
        alive: async ({ pid }) => pidAlive(pid),
        start: (d) =>
            d.app ? launch("open", ["-a", d.app]) : launch(d.exe, []),
    };
}

// ── Flatpak Discord, from inside a Flatpak Zam ─────────────────────────────

const FLATPAK_DISCORD = "com.discordapp.Discord";

/** Runs on the host; works only if the user granted org.freedesktop.Flatpak. */
const onHost = (cmd, args) => run("flatpak-spawn", ["--host", cmd, ...args]);

/**
 * The Flatpak Discord, which shares its discord-ipc folder with a Flatpak Zam
 * (see ipcBase in discordRpc.cjs). The sandbox cannot see or end host
 * programs, so each step goes through flatpak-spawn.
 */
const flatpakAdapter = {
    find: async () =>
        (await onHost("flatpak", ["ps", "--columns=application"]))
            .split(/\r?\n/)
            .some((l) => l.trim() === FLATPAK_DISCORD)
            ? [{ name: FLATPAK_DISCORD }]
            : [],
    stop: () => onHost("flatpak", ["kill", FLATPAK_DISCORD]),
    alive: async () => (await flatpakAdapter.find()).length > 0,
    // setsid so it outlives flatpak-spawn, and so Zam quitting does not close it.
    start: () =>
        launch("flatpak-spawn", [
            "--host",
            "sh",
            "-c",
            `setsid -f flatpak run ${FLATPAK_DISCORD} >/dev/null 2>&1`,
        ]),
};

function adapterFor(platform) {
    if (platform === "win32") return windowsAdapter;
    if (platform === "darwin" || platform === "linux")
        return unixAdapter(platform);
    return null;
}

/**
 * Close Discord, call `rebind()` (which must make Zam take the first slot) and
 * start Discord again. Resolves { ok: true } or { ok: false, error }.
 */
async function restartDiscord({
    rebind,
    platform = process.platform,
    inFlatpak = false,
    adapter = inFlatpak ? flatpakAdapter : adapterFor(platform),
    log = () => {},
} = {}) {
    if (!adapter) return { ok: false, error: "not supported on this system" };
    const list = await adapter.find();
    if (list.length === 0)
        return { ok: false, error: "no running Discord found" };

    for (const d of list) await adapter.stop(d);
    // Wait for it to be gone: its socket goes with the process.
    for (let i = 0; i < 20; i++) {
        let any = false;
        for (const d of list) any = any || (await adapter.alive(d));
        if (!any) break;
        await sleep(250);
    }
    try {
        await rebind();
    } catch (e) {
        // Still start Discord again: the user should not be left without it.
        log("rebind failed", e);
        for (const d of list) adapter.start(d);
        return { ok: false, error: String(e?.message || e) };
    }
    for (const d of list) adapter.start(d);
    return { ok: true };
}

module.exports = {
    restartDiscord,
    runningInstalls,
    parseUnixProcesses,
    cleanEnv,
    flatpakAdapter,
};
