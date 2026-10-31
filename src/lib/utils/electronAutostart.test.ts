import { describe, it, expect, vi, afterEach } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { writeFileSync } from "fs";
import { tmpdir } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { createAutostart, quoteExecArg } = require(
    join(__dirname, "../../../electron/autostart.cjs"),
);

const dirs: string[] = [];
function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "zam-autostart-"));
    dirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true });
});

function fakeApp(extra: Record<string, unknown> = {}) {
    const userData = tempDir();
    return {
        isPackaged: true,
        getPath: (name: string) =>
            name === "userData" ? userData : "/opt/Zam/zam",
        ...extra,
    };
}

describe("quoteExecArg", () => {
    it("quotes for the Exec field and then as a desktop entry string", () => {
        expect(quoteExecArg("/home/me/Apps/Zam 1.0.AppImage")).toBe(
            '"/home/me/Apps/Zam 1.0.AppImage"',
        );
        expect(quoteExecArg('/a"b')).toBe('"/a\\\\"b"');
        expect(quoteExecArg("/a$b")).toBe('"/a\\\\$b"');
        expect(quoteExecArg("/100%")).toBe('"/100%%"');
    });
});

describe("autostart", () => {
    it("is not offered in an unpacked build", async () => {
        const setLoginItemSettings = vi.fn();
        const autostart = createAutostart({
            app: fakeApp({ isPackaged: false, setLoginItemSettings }),
            inFlatpak: false,
            platform: "win32",
        });
        expect(autostart.info()).toEqual({ available: false, enabled: false });
        await autostart.set(true);
        expect(setLoginItemSettings).not.toHaveBeenCalled();
    });

    it("registers the portable .exe, not the temporary one, on Windows", async () => {
        const setLoginItemSettings = vi.fn();
        const autostart = createAutostart({
            app: fakeApp({
                setLoginItemSettings,
                getLoginItemSettings: () => ({
                    openAtLogin: true,
                    executableWillLaunchAtLogin: false,
                }),
            }),
            inFlatpak: false,
            platform: "win32",
            env: { PORTABLE_EXECUTABLE_FILE: "D:\\Zam-Portable.exe" },
        });
        const info = await autostart.set(true);
        expect(setLoginItemSettings).toHaveBeenCalledWith({
            path: "D:\\Zam-Portable.exe",
            name: "Zam",
            openAtLogin: true,
        });
        // Registered, but switched off in Task Manager.
        expect(info.enabled).toBe(false);
    });

    describe("on Linux", () => {
        function linux(env: Record<string, string> = {}) {
            const config = tempDir();
            const file = join(config, "autostart/moe.crafty.matrix.desktop");
            const options = {
                app: fakeApp(),
                inFlatpak: false,
                platform: "linux",
            };
            const make = (more: Record<string, string> = {}) =>
                createAutostart({
                    ...options,
                    env: { XDG_CONFIG_HOME: config, ...env, ...more },
                });
            return { file, make };
        }

        it("writes and removes an autostart entry for the AppImage", async () => {
            const { file, make } = linux({ APPIMAGE: "/apps/Zam-1.AppImage" });
            const autostart = make();
            expect(autostart.info().enabled).toBe(false);
            expect((await autostart.set(true)).enabled).toBe(true);
            expect(readFileSync(file, "utf8")).toContain(
                'Exec="/apps/Zam-1.AppImage"',
            );
            expect((await autostart.set(false)).enabled).toBe(false);
            expect(existsSync(file)).toBe(false);
        });

        it("treats an entry the desktop hid as off", async () => {
            const { file, make } = linux();
            const autostart = make();
            await autostart.set(true);
            writeFileSync(file, `${readFileSync(file, "utf8")}Hidden=true\n`);
            expect(autostart.info().enabled).toBe(false);
        });

        it("follows an AppImage that moved, but adds nothing when off", async () => {
            const { file, make } = linux({ APPIMAGE: "/apps/Zam-1.AppImage" });
            make().refresh();
            expect(existsSync(file)).toBe(false);
            await make().set(true);
            make({ APPIMAGE: "/apps/Zam-2.AppImage" }).refresh();
            expect(readFileSync(file, "utf8")).toContain(
                'Exec="/apps/Zam-2.AppImage"',
            );
        });
    });

    describe("in Flatpak", () => {
        it("asks the portal and remembers its answer", async () => {
            const app = fakeApp();
            const requestPortal = vi.fn(async (on: boolean) => on);
            const autostart = createAutostart({
                app,
                inFlatpak: true,
                platform: "linux",
                requestPortal,
            });
            expect(autostart.info()).toEqual({
                available: true,
                enabled: false,
            });
            expect((await autostart.set(true)).enabled).toBe(true);
            expect(requestPortal).toHaveBeenCalledWith(true);
            // A portal can't be asked, so a later launch reads the file.
            expect(
                createAutostart({
                    app,
                    inFlatpak: true,
                    platform: "linux",
                }).info().enabled,
            ).toBe(true);
        });

        it("stays off when the desktop refuses", async () => {
            const autostart = createAutostart({
                app: fakeApp(),
                inFlatpak: true,
                platform: "linux",
                requestPortal: async () => false,
            });
            expect((await autostart.set(true)).enabled).toBe(false);
        });

        it("keeps the old state when the portal fails", async () => {
            const autostart = createAutostart({
                app: fakeApp(),
                inFlatpak: true,
                platform: "linux",
                requestPortal: async () => {
                    throw new Error("no portal");
                },
            });
            await expect(autostart.set(true)).rejects.toThrow("no portal");
            expect(autostart.info().enabled).toBe(false);
        });
    });
});
