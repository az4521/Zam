import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const electron = (name: string) =>
    require(join(__dirname, "../../../electron", name));

const { createSteamDebug, findSteamProcesses } = electron("steamDebug.cjs");

const IFEO =
    "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\steam.exe";
const STEAM_EXE = "c:\\program files (x86)\\steam\\steam.exe";
const FLAG_FILE =
    "c:\\program files (x86)\\steam\\.cef-enable-remote-debugging";
const FALLBACK_EXE = "C:\\Program Files (x86)\\Steam\\steam.exe";
const FALLBACK_FLAG =
    "C:\\Program Files (x86)\\Steam\\.cef-enable-remote-debugging";
// The value an earlier version wrote on steam.exe; a leftover of it is removed.
const LEGACY_VALUE = `"${STEAM_EXE}" -cef-enable-debugging`;

// ── Fake Windows ───────────────────────────────────────────────────────────

interface KeyState {
    values: Record<string, string>;
    subkeys: string[];
}

interface WinOpts {
    /** SteamExe in HKCU; null means the value is missing. */
    steamReg?: string | null;
    /** The elevated call is refused, as when UAC is declined. */
    uac?: boolean;
    /** The flag file is already in Steam's folder. */
    flag?: boolean;
    /** Creating the flag file silently does nothing. */
    flagDrops?: boolean;
    /** Removing the flag file silently does nothing. */
    stuckFlag?: boolean;
    /** Registry view whose removals silently fail (partial change). */
    failView?: string;
    /** Steam exits on -shutdown. */
    shutdownWorks?: boolean;
    /** Process list at the start. */
    running?: boolean;
    /** Initial key state per view ("64" / "32"). */
    keys?: Record<string, KeyState | null>;
}

// Undoes PowerShell's single-quote escaping.
const unq = (s: string) => s.replace(/''/g, "'");

// Wraps an argument the way PowerShell 5.1 does: quotes it when it has spaces,
// without escaping quotes inside.
const psWrap = (s: string) => (/\s/.test(s) ? `"${s}"` : s);

// Parses one argv token the way the MSVCRT does (what reg.exe uses).
function crtArg(s: string): string {
    let out = "";
    let quoted = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "\\") {
            let n = 0;
            while (s[i] === "\\") {
                n++;
                i++;
            }
            if (s[i] === '"') {
                out += "\\".repeat(n >> 1);
                if (n % 2) out += '"';
                else quoted = !quoted;
            } else {
                out += "\\".repeat(n);
                i--;
            }
        } else if (c === '"') {
            quoted = !quoted;
        } else {
            out += c;
        }
    }
    return out;
}

function fakeWindows(opts: WinOpts = {}) {
    const keys: Record<string, KeyState | null> = {
        "64": null,
        "32": null,
        ...(opts.keys ?? {}),
    };
    const files = new Set<string>(opts.flag ? [FLAG_FILE] : []);
    const processes = new Set<string>(
        opts.running === false ? [] : ["steam.exe", "steamwebhelper.exe"],
    );
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const scripts: string[] = [];
    const spawned: Array<{ cmd: string; args: string[] }> = [];
    const sleeps: number[] = [];

    // Only the legacy Debugger value and the empty-key cleanup are ever run.
    const applyScript = (script: string) => {
        for (const line of script.split(/\r?\n/)) {
            let m =
                /^& reg\.exe delete '((?:[^']|'')*)' \/v Debugger \/f \/reg:(\d+)$/.exec(
                    line,
                );
            if (m) {
                const view = m[2];
                if (view === opts.failView) continue;
                const key = keys[view];
                if (key) delete key.values.Debugger;
                continue;
            }
            m = /^Remove-KeyIfEmpty '((?:[^']|'')*)' (\d+)$/.exec(line);
            if (m) {
                const view = m[2];
                if (view === opts.failView) continue;
                const key = keys[view];
                if (
                    key &&
                    Object.keys(key.values).length === 0 &&
                    key.subkeys.length === 0
                )
                    keys[view] = null;
            }
        }
    };

    const run = async (cmd: string, args: string[]): Promise<string> => {
        calls.push({ cmd, args });
        if (cmd === "reg" && args[0] === "query") {
            if (args[1] === "HKCU\\Software\\Valve\\Steam") {
                const v =
                    opts.steamReg === undefined
                        ? "c:/program files (x86)/steam/steam.exe"
                        : opts.steamReg;
                if (v === null)
                    throw new Error(
                        "ERROR: The system was unable to find the specified registry key or value.",
                    );
                return `\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamExe    REG_SZ    ${v}\r\n`;
            }
            const view = /\/reg:(\d+)/.exec(args[args.length - 1])![1];
            const key = keys[view];
            if (!key)
                throw new Error(
                    "ERROR: The system was unable to find the specified registry key or value.",
                );
            const lines = [
                IFEO,
                ...Object.entries(key.values).map(
                    ([k, v]) => `    ${k}    REG_SZ    ${v}`,
                ),
                ...key.subkeys.map((s) => `    ${IFEO}\\${s}`),
            ];
            return lines.join("\r\n") + "\r\n";
        }
        if (cmd === "powershell") {
            const m = /'-EncodedCommand','([A-Za-z0-9+/=]+)'/.exec(
                args[args.length - 1],
            );
            if (!m) throw new Error("unexpected powershell call");
            const script = Buffer.from(m[1], "base64").toString("utf16le");
            scripts.push(script);
            if (opts.uac)
                throw new Error(
                    "Start-Process : The operation was canceled by the user.",
                );
            applyScript(script);
            return "";
        }
        if (cmd === "tasklist") {
            const img = /IMAGENAME eq (\S+)/.exec(args[1])![1];
            return processes.has(img)
                ? `"${img}","4242","Console","1","100,000 K"\r\n`
                : "INFO: No tasks are running which match the specified criteria.\r\n";
        }
        if (cmd === "taskkill") {
            processes.delete(args[args.length - 1]);
            return "";
        }
        if (cmd.endsWith("steam.exe") && args[0] === "-shutdown") {
            if (opts.shutdownWorks) {
                processes.delete("steam.exe");
                processes.delete("steamwebhelper.exe");
            }
            return "";
        }
        throw new Error(`unexpected command: ${cmd} ${args.join(" ")}`);
    };

    const fsOps = {
        exists: (p: string) => files.has(p),
        touch: (p: string) => {
            if (!opts.flagDrops) files.add(p);
        },
        remove: (p: string) => {
            if (!opts.stuckFlag) files.delete(p);
        },
    };

    return {
        run,
        keys,
        files,
        fsOps,
        processes,
        calls,
        scripts,
        spawned,
        sleeps,
        spawnDetached: (cmd: string, args: string[]) => {
            spawned.push({ cmd, args });
            if (cmd.endsWith("steam.exe")) processes.add("steam.exe");
        },
        sleep: async (ms: number) => {
            sleeps.push(ms);
        },
    };
}

const winDebug = (f: ReturnType<typeof fakeWindows>, extra: object = {}) =>
    createSteamDebug({
        platform: "win32",
        env: {},
        exists: (p: string) => p === STEAM_EXE || p === FALLBACK_EXE,
        fsOps: f.fsOps,
        probePort: async () => true,
        run: f.run,
        spawnDetached: f.spawnDetached,
        sleep: f.sleep,
        ...extra,
    });

const legacyKey = (extra: Partial<KeyState> = {}): KeyState => ({
    values: { Debugger: LEGACY_VALUE },
    subkeys: [],
    ...extra,
});

const winPowershellCalls = (f: ReturnType<typeof fakeWindows>) =>
    f.calls.filter((c) => c.cmd === "powershell");

describe("Windows Steam debugging", () => {
    it("status: enabled follows the flag file, legacyIfeo follows the registry", async () => {
        const on = fakeWindows({ flag: true });
        expect(await winDebug(on).status()).toEqual({
            supported: true,
            enabled: true,
            portOpen: true,
            steamRunning: true,
            legacyIfeo: false,
        });

        const legacy = fakeWindows({
            keys: { "64": legacyKey(), "32": null },
        });
        expect(await winDebug(legacy).status()).toEqual({
            supported: true,
            enabled: false,
            portOpen: true,
            steamRunning: true,
            legacyIfeo: true,
        });

        const foreign = fakeWindows({
            keys: {
                "64": { values: { Debugger: '"C:\\other.exe"' }, subkeys: [] },
            },
        });
        expect((await winDebug(foreign).status()).legacyIfeo).toBe(false);
    });

    it("enable creates the flag file in the folder of steam.exe with no elevated call", async () => {
        const f = fakeWindows();
        expect(await winDebug(f).enable()).toEqual({ ok: true });
        expect([...f.files]).toEqual([FLAG_FILE]);
        expect(winPowershellCalls(f)).toHaveLength(0);
        expect((await winDebug(f).status()).enabled).toBe(true);
    });

    it("enable uses the default install folder when SteamExe is missing", async () => {
        const f = fakeWindows({ steamReg: null });
        const debug = createSteamDebug({
            platform: "win32",
            env: {},
            exists: (p: string) => p === FALLBACK_EXE,
            fsOps: f.fsOps,
            probePort: async () => false,
            run: f.run,
            spawnDetached: f.spawnDetached,
            sleep: f.sleep,
        });
        expect(await debug.enable()).toEqual({ ok: true });
        expect([...f.files]).toEqual([FALLBACK_FLAG]);
    });

    it("enable reports the Steam-folder error when nothing is found", async () => {
        const f = fakeWindows();
        const debug = createSteamDebug({
            platform: "win32",
            env: {},
            exists: () => false,
            fsOps: f.fsOps,
            probePort: async () => false,
            run: f.run,
            spawnDetached: f.spawnDetached,
            sleep: f.sleep,
        });
        expect(await debug.enable()).toEqual({
            ok: false,
            error: "Steam's folder wasn't found",
        });
        expect(f.files.size).toBe(0);
        expect(winPowershellCalls(f)).toHaveLength(0);
    });

    it("enable fails when the flag file did not appear", async () => {
        const f = fakeWindows({ flagDrops: true });
        const r = await winDebug(f).enable();
        expect(r.ok).toBe(false);
        expect(r.cancelled).toBeUndefined();
        expect(r.error).toMatch(/flag/);
    });

    it("enable removes a leftover IFEO value with one elevated call, then creates the flag", async () => {
        const f = fakeWindows({
            keys: { "64": legacyKey(), "32": legacyKey() },
        });
        expect(await winDebug(f).enable()).toEqual({ ok: true });
        expect(winPowershellCalls(f)).toHaveLength(1);
        expect(f.keys["64"]).toBeNull();
        expect(f.keys["32"]).toBeNull();
        expect(f.files.has(FLAG_FILE)).toBe(true);
    });

    it("enable returns cancelled when UAC is declined over a leftover", async () => {
        const f = fakeWindows({
            keys: { "64": legacyKey(), "32": null },
            uac: true,
        });
        expect(await winDebug(f).enable()).toEqual({
            ok: false,
            cancelled: true,
            error: "administrator permission was not granted",
        });
        expect(winPowershellCalls(f)).toHaveLength(1);
        expect(f.keys["64"]?.values.Debugger).toBe(LEGACY_VALUE);
        expect(f.files.size).toBe(0);
    });

    it("enable leaves another debugger on steam.exe alone", async () => {
        const f = fakeWindows({
            keys: {
                "64": { values: { Debugger: '"C:\\other.exe"' }, subkeys: [] },
                "32": null,
            },
        });
        expect(await winDebug(f).enable()).toEqual({ ok: true });
        expect(winPowershellCalls(f)).toHaveLength(0);
        expect(f.keys["64"]?.values.Debugger).toBe('"C:\\other.exe"');
    });

    it("disable removes the flag file with no elevated call when there is no leftover", async () => {
        const f = fakeWindows({ flag: true });
        expect(await winDebug(f).disable()).toEqual({ ok: true });
        expect(f.files.size).toBe(0);
        expect(winPowershellCalls(f)).toHaveLength(0);
        expect((await winDebug(f).status()).enabled).toBe(false);
    });

    it("disable removes the flag file and a leftover IFEO value", async () => {
        const f = fakeWindows({
            flag: true,
            keys: { "64": legacyKey(), "32": legacyKey() },
        });
        expect(await winDebug(f).disable()).toEqual({ ok: true });

        expect(f.files.size).toBe(0);
        expect(f.keys["64"]).toBeNull();
        expect(f.keys["32"]).toBeNull();
        expect(winPowershellCalls(f)).toHaveLength(1);
        const script = f.scripts[0];
        expect(script).toContain("/reg:64");
        expect(script).toContain("/reg:32");
        expect(script).toContain("function Remove-KeyIfEmpty");
        expect(script).toContain(
            "Remove-KeyIfEmpty 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Image File Execution Options\\steam.exe' 64",
        );
        const after = await winDebug(f).status();
        expect(after.enabled).toBe(false);
        expect(after.legacyIfeo).toBe(false);
    });

    it("disable keeps the key when other values exist", async () => {
        const f = fakeWindows({
            keys: {
                "64": {
                    values: { Debugger: LEGACY_VALUE, GlobalFlag: "0x200" },
                    subkeys: [],
                },
                "32": {
                    values: { Debugger: LEGACY_VALUE, GlobalFlag: "0x200" },
                    subkeys: [],
                },
            },
        });
        expect(await winDebug(f).disable()).toEqual({ ok: true });
        expect(f.keys["64"]).toEqual({
            values: { GlobalFlag: "0x200" },
            subkeys: [],
        });
        expect(f.keys["32"]).toEqual({
            values: { GlobalFlag: "0x200" },
            subkeys: [],
        });
    });

    it("disable keeps the key when it has subkeys", async () => {
        const f = fakeWindows({
            keys: {
                "64": legacyKey({ subkeys: ["Child"] }),
                "32": legacyKey({ subkeys: ["Child"] }),
            },
        });
        expect(await winDebug(f).disable()).toEqual({ ok: true });
        expect(f.keys["64"]).toEqual({ values: {}, subkeys: ["Child"] });
    });

    it("disable leaves a different debugger on steam.exe alone", async () => {
        const f = fakeWindows({
            keys: {
                "64": { values: { Debugger: '"C:\\other.exe"' }, subkeys: [] },
                "32": null,
            },
        });
        expect(await winDebug(f).disable()).toEqual({ ok: true });
        expect(winPowershellCalls(f)).toHaveLength(0);
        expect(f.keys["64"]?.values.Debugger).toBe('"C:\\other.exe"');
    });

    it("disable returns cancelled when UAC is declined, but still removes the flag", async () => {
        const f = fakeWindows({
            flag: true,
            keys: { "64": legacyKey(), "32": legacyKey() },
            uac: true,
        });
        expect(await winDebug(f).disable()).toEqual({
            ok: false,
            cancelled: true,
            error: "administrator permission was not granted",
        });
        expect(f.keys["64"]?.values.Debugger).toBe(LEGACY_VALUE);
        expect(f.files.size).toBe(0);
    });

    it("disable reports a stuck flag file", async () => {
        const f = fakeWindows({ flag: true, stuckFlag: true });
        const r = await winDebug(f).disable();
        expect(r.ok).toBe(false);
        expect(r.cancelled).toBeUndefined();
        expect(r.error).toMatch(/still in/);
    });

    it("disable reports a partial IFEO removal as a failure", async () => {
        const f = fakeWindows({
            keys: { "64": legacyKey(), "32": legacyKey() },
            failView: "32",
        });
        const r = await winDebug(f).disable();
        expect(r.ok).toBe(false);
        expect(r.cancelled).toBeUndefined();
        expect(r.error).toMatch(/32-bit/);
        expect(f.keys["64"]).toBeNull();
        expect(f.keys["32"]?.values.Debugger).toBe(LEGACY_VALUE);
    });

    it("restart refuses when Steam isn't running", async () => {
        const f = fakeWindows({ running: false });
        expect(await winDebug(f).restartSteam()).toEqual({
            ok: false,
            error: "Steam isn't running",
        });
        expect(f.calls.some((c) => c.args[0] === "-shutdown")).toBe(false);
        expect(f.spawned).toHaveLength(0);
    });

    it("restart shuts Steam down gracefully and starts it again", async () => {
        const f = fakeWindows({ shutdownWorks: true });
        expect(await winDebug(f).restartSteam()).toEqual({ ok: true });
        expect(f.calls.some((c) => c.cmd === "taskkill")).toBe(false);
        expect(
            f.calls.some(
                (c) => c.cmd === STEAM_EXE && c.args[0] === "-shutdown",
            ),
        ).toBe(true);
        expect(f.spawned).toEqual([{ cmd: STEAM_EXE, args: [] }]);
    });

    it("restart force-kills Steam after the wait runs out", async () => {
        const f = fakeWindows({ shutdownWorks: false });
        expect(await winDebug(f).restartSteam()).toEqual({ ok: true });
        const kills = f.calls
            .filter((c) => c.cmd === "taskkill")
            .map((c) => c.args[c.args.length - 1]);
        expect(kills).toEqual(["steam.exe", "steamwebhelper.exe"]);
        expect(
            f.sleeps.filter((ms) => ms === 1000).length,
        ).toBeGreaterThanOrEqual(20);
        expect(f.spawned).toHaveLength(1);
    });
});

// ── Fake Linux, macOS and Flatpak host ─────────────────────────────────────

const HOME = "/home/u";
const NATIVE_ROOT = join(HOME, ".steam", "steam");
const FLATPAK_ROOT = join(
    HOME,
    ".var",
    "app",
    "com.valvesoftware.Steam",
    ".local",
    "share",
    "Steam",
);
const MAC_ROOT = join(HOME, "Library", "Application Support", "Steam");
const FLAG = ".cef-enable-remote-debugging";
const NATIVE_STEAM = "/home/u/.local/share/Steam/ubuntu12_32/steam";

interface UnixOpts {
    dirs?: string[];
    files?: string[];
    procs?: string[];
    flatpakSteam?: boolean;
    shutdownWorks?: boolean;
    /** Paths whose removal silently does nothing. */
    stuck?: string[];
}

function fakeUnix(opts: UnixOpts = {}) {
    const state = {
        dirs: new Set(opts.dirs ?? []),
        files: new Set(opts.files ?? []),
        procs: [...(opts.procs ?? [])],
        flatpakSteam: opts.flatpakSteam ?? false,
    };
    const calls: Array<{ cmd: string; args: string[] }> = [];
    const killed: Array<{ pid: number; sig: string }> = [];
    const spawned: Array<{ cmd: string; args: string[] }> = [];
    const stuck = new Set(opts.stuck ?? []);

    const run = async (cmd: string, args: string[]): Promise<string> => {
        calls.push({ cmd, args });
        if (cmd === "ps") return state.procs.join("\n");
        if (cmd === "flatpak") {
            if (args[0] === "ps")
                return state.flatpakSteam
                    ? "application\ncom.valvesoftware.Steam\n"
                    : "application\n";
            if (args[0] === "kill") {
                state.flatpakSteam = false;
                state.procs = [];
                return "";
            }
        }
        if (cmd === "flatpak-spawn") {
            const inner = args.slice(1);
            if (inner[0] === "sh") {
                const script = inner[2];
                const p = inner[4];
                if (script === 'test -e "$1"') {
                    if (state.dirs.has(p) || state.files.has(p)) return "";
                    throw new Error("not found");
                }
                if (script === 'touch "$1"') {
                    state.files.add(p);
                    return "";
                }
                if (script === 'rm -f "$1"') {
                    if (!stuck.has(p)) state.files.delete(p);
                    return "";
                }
                throw new Error(`unexpected script: ${script}`);
            }
            return run(inner[0], inner.slice(1));
        }
        if (cmd === "kill") return "";
        if (cmd === NATIVE_STEAM && args[0] === "-shutdown") {
            if (opts.shutdownWorks) state.procs = [];
            return "";
        }
        if (cmd === "xdg-open" || cmd === "open" || cmd === "osascript")
            return "";
        throw new Error(`unexpected command: ${cmd} ${args.join(" ")}`);
    };

    const fsOps = {
        exists: (p: string) => state.dirs.has(p) || state.files.has(p),
        touch: (p: string) => {
            state.files.add(p);
        },
        remove: (p: string) => {
            if (!stuck.has(p)) state.files.delete(p);
        },
    };

    return {
        state,
        run,
        fsOps,
        calls,
        killed,
        spawned,
        spawnDetached: (cmd: string, args: string[]) => {
            spawned.push({ cmd, args });
        },
        kill: (pid: number, sig: string) => {
            killed.push({ pid, sig });
            if (sig === "KILL") state.procs = [];
        },
        sleep: async () => {},
    };
}

const unixDebug = (
    platform: string,
    f: ReturnType<typeof fakeUnix>,
    extra: object = {},
) =>
    createSteamDebug({
        platform,
        home: HOME,
        fsOps: f.fsOps,
        run: f.run,
        probePort: async () => false,
        spawnDetached: f.spawnDetached,
        kill: f.kill,
        sleep: f.sleep,
        ...extra,
    });

describe("Linux and macOS Steam debugging", () => {
    it("enable touches the flag in every existing Steam root and disable removes it", async () => {
        const f = fakeUnix({ dirs: [NATIVE_ROOT, FLATPAK_ROOT] });
        const debug = unixDebug("linux", f);
        expect(await debug.enable()).toEqual({ ok: true });
        expect(f.state.files.has(join(NATIVE_ROOT, FLAG))).toBe(true);
        expect(f.state.files.has(join(FLATPAK_ROOT, FLAG))).toBe(true);
        expect((await debug.status()).enabled).toBe(true);

        expect(await debug.disable()).toEqual({ ok: true });
        expect(f.state.files.size).toBe(0);
        expect((await debug.status()).enabled).toBe(false);
    });

    it("enable reports a missing Steam folder", async () => {
        const f = fakeUnix({});
        expect(await unixDebug("linux", f).enable()).toEqual({
            ok: false,
            error: "Steam's folder wasn't found",
        });
    });

    it("macOS uses only the Application Support root", async () => {
        const f = fakeUnix({ dirs: [MAC_ROOT, NATIVE_ROOT] });
        const debug = unixDebug("darwin", f);
        expect(await debug.enable()).toEqual({ ok: true });
        expect(f.state.files).toEqual(new Set([join(MAC_ROOT, FLAG)]));
        expect(await debug.disable()).toEqual({ ok: true });
        expect(f.state.files.size).toBe(0);
    });

    it("disable reports a flag that a root kept", async () => {
        const stuckPath = join(NATIVE_ROOT, FLAG);
        const f = fakeUnix({
            dirs: [NATIVE_ROOT],
            files: [stuckPath],
            stuck: [stuckPath],
        });
        const r = await unixDebug("linux", f).disable();
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/still in/);
    });

    it("status reports Steam running from ps and the port from the probe", async () => {
        const f = fakeUnix({
            dirs: [NATIVE_ROOT],
            procs: [`  4321 ${NATIVE_STEAM} -silent`],
        });
        const debug = unixDebug("linux", f, { probePort: async () => true });
        expect(await debug.status()).toEqual({
            supported: true,
            enabled: false,
            portOpen: true,
            steamRunning: true,
        });
    });

    it("restart shuts down the running copy and starts it with xdg-open", async () => {
        const f = fakeUnix({
            dirs: [NATIVE_ROOT],
            procs: [`  4321 ${NATIVE_STEAM} -silent`],
            shutdownWorks: true,
        });
        expect(await unixDebug("linux", f).restartSteam()).toEqual({
            ok: true,
        });
        expect(
            f.calls.some(
                (c) => c.cmd === NATIVE_STEAM && c.args[0] === "-shutdown",
            ),
        ).toBe(true);
        expect(f.killed).toHaveLength(0);
        expect(f.spawned).toEqual([
            { cmd: "xdg-open", args: ["steam://open/main"] },
        ]);
    });

    it("restart falls back to TERM then KILL when Steam ignores -shutdown", async () => {
        const f = fakeUnix({
            dirs: [NATIVE_ROOT],
            procs: [`  4321 ${NATIVE_STEAM} -silent`],
            shutdownWorks: false,
        });
        expect(await unixDebug("linux", f).restartSteam()).toEqual({
            ok: true,
        });
        expect(f.killed).toEqual([
            { pid: 4321, sig: "TERM" },
            { pid: 4321, sig: "KILL" },
        ]);
        expect(f.spawned).toHaveLength(1);
    });

    it("restart refuses when Steam isn't running", async () => {
        const f = fakeUnix({ dirs: [NATIVE_ROOT] });
        expect(await unixDebug("linux", f).restartSteam()).toEqual({
            ok: false,
            error: "Steam isn't running",
        });
        expect(f.spawned).toHaveLength(0);
    });

    it("restart of a Flatpak Steam uses flatpak kill and flatpak run", async () => {
        const f = fakeUnix({ dirs: [FLATPAK_ROOT], flatpakSteam: true });
        expect(await unixDebug("linux", f).restartSteam()).toEqual({
            ok: true,
        });
        expect(f.calls).toContainEqual({
            cmd: "flatpak",
            args: ["kill", "com.valvesoftware.Steam"],
        });
        expect(f.spawned).toEqual([
            { cmd: "flatpak", args: ["run", "com.valvesoftware.Steam"] },
        ]);
    });

    it("findSteamProcesses keeps the main Steam process only", () => {
        const text = [
            `  1234 ${NATIVE_STEAM} -silent`,
            "  1235 /home/u/.local/share/Steam/ubuntu12_32/steamwebhelper --type=renderer",
            "  1236 xdg-open steam://open/main",
            "  1237 /Applications/Steam.app/Contents/MacOS/steam_osx",
            "  1238 /usr/bin/steam",
            "  1239 steam",
            "  1240 /usr/bin/vim steam.txt",
            "  1241 grep steam",
            "  1242 /usr/lib/steam/steamerrorreporter",
        ].join("\n");
        expect(
            findSteamProcesses(text).map((p: { pid: number }) => p.pid),
        ).toEqual([1234, 1237, 1238, 1239]);
    });
});

describe("Flatpak Zam", () => {
    it("runs the flag file steps on the host with positional arguments", async () => {
        const f = fakeUnix({ dirs: [NATIVE_ROOT] });
        const debug = createSteamDebug({
            platform: "linux",
            inFlatpak: true,
            home: HOME,
            run: f.run,
            hostAllowed: async () => true,
            probePort: async () => false,
            spawnDetached: f.spawnDetached,
            kill: f.kill,
            sleep: f.sleep,
        });
        expect(await debug.enable()).toEqual({ ok: true });
        expect(f.calls).toContainEqual({
            cmd: "flatpak-spawn",
            args: [
                "--host",
                "sh",
                "-c",
                'touch "$1"',
                "sh",
                join(NATIVE_ROOT, FLAG),
            ],
        });
        expect(f.state.files.has(join(NATIVE_ROOT, FLAG))).toBe(true);
        expect(await debug.disable()).toEqual({ ok: true });
        expect(f.state.files.size).toBe(0);
    });

    it("reads Steam's process list through flatpak-spawn --host ps", async () => {
        const f = fakeUnix({ procs: [`  4321 ${NATIVE_STEAM} -silent`] });
        const debug = createSteamDebug({
            platform: "linux",
            inFlatpak: true,
            home: HOME,
            run: f.run,
            hostAllowed: async () => true,
            probePort: async () => false,
            spawnDetached: f.spawnDetached,
            kill: f.kill,
            sleep: f.sleep,
        });
        expect((await debug.status()).steamRunning).toBe(true);
        expect(f.calls).toContainEqual({
            cmd: "flatpak-spawn",
            args: ["--host", "ps", "-axww", "-o", "pid=,args="],
        });
    });

    it("without host access it is unsupported and refuses changes", async () => {
        const f = fakeUnix({ dirs: [NATIVE_ROOT] });
        const debug = createSteamDebug({
            platform: "linux",
            inFlatpak: true,
            home: HOME,
            run: f.run,
            hostAllowed: async () => false,
            probePort: async () => false,
            spawnDetached: f.spawnDetached,
            kill: f.kill,
            sleep: f.sleep,
        });
        expect((await debug.status()).supported).toBe(false);
        const r = await debug.enable();
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/host access/);
        expect((await debug.restartSteam()).ok).toBe(false);
    });
});

describe("unsupported systems", () => {
    it("reports unsupported and refuses changes", async () => {
        const f = fakeUnix({});
        const debug = unixDebug("freebsd", f);
        expect(await debug.status()).toEqual({
            supported: false,
            enabled: false,
            portOpen: false,
            steamRunning: false,
        });
        expect(await debug.enable()).toEqual({
            ok: false,
            error: "not supported on this system",
        });
        expect((await debug.restartSteam()).ok).toBe(false);
    });
});
