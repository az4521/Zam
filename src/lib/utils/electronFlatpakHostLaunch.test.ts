import { describe, it, expect } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const { hostLaunchArgs, HOST_SCRIPT } = require(
    join(__dirname, "../../../electron/flatpakHostLaunch.cjs"),
);

const info = (appPath: string) => `[Application]
name=moe.crafty.matrix
runtime=runtime/org.freedesktop.Platform/x86_64/25.08

[Instance]
instance-id=123
app-path=${appPath}
branch=master
arch=x86_64
flatpak-version=1.14.6
`;

const SYSTEM = "/var/lib/flatpak/app/moe.crafty.matrix/x86_64/master/abc/files";
const USER =
    "/home/someone/.local/share/flatpak/app/moe.crafty.matrix/x86_64/master/abc/files";

describe("hostLaunchArgs", () => {
    it("runs the same app, branch, arch and installation on the host", () => {
        const args = hostLaunchArgs(
            info(SYSTEM),
            {
                WAYLAND_DISPLAY: "wayland-1",
                XDG_SESSION_TYPE: "wayland",
                XDG_CURRENT_DESKTOP: "Hyprland",
            },
            ["--zam-after-update"],
        );
        expect(args).toEqual([
            "--host",
            "sh",
            "-c",
            HOST_SCRIPT,
            "sh",
            "wayland-1",
            "wayland",
            "Hyprland",
            "run",
            "--system",
            "--branch=master",
            "--arch=x86_64",
            "moe.crafty.matrix",
            "--zam-after-update",
        ]);
    });

    it("picks the user installation", () => {
        const args = hostLaunchArgs(info(USER), {}, []);
        expect(args).toContain("--user");
        expect(args).not.toContain("--system");
    });

    it("passes no Wayland name it cannot trust, and empty slots for missing values", () => {
        const args = hostLaunchArgs(
            info(SYSTEM),
            { WAYLAND_DISPLAY: "/run/some/socket" },
            [],
        );
        expect(args.slice(5, 8)).toEqual(["", "", ""]);
    });

    it("gives up without an app name", () => {
        expect(hostLaunchArgs("[Instance]\nbranch=master\n", {}, [])).toBe(
            null,
        );
        expect(
            hostLaunchArgs("[Application]\nname=bad name;rm\n", {}, []),
        ).toBe(null);
    });
});
