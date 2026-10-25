/**
 * Build the Windows per-application audio capture helper
 * (native/app-audio/zam-app-audio.cpp) into native/app-audio/build/, where
 * electron/appAudio.cjs finds it in development and electron-builder copies
 * it from (package.json build.win.extraResources).
 *
 * Uses MSVC when Visual Studio (or its Build Tools) is installed, found with
 * vswhere, otherwise g++ (MinGW). A no-op on other platforms: Linux captures
 * per-app audio through PipeWire (@vencord/venmic) instead.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
    console.log("build-app-audio: not Windows, nothing to build");
    process.exit(0);
}

const root = fileURLToPath(new URL("../", import.meta.url));
const srcDir = join(root, "native", "app-audio");
const src = join(srcDir, "zam-app-audio.cpp");
const outDir = join(srcDir, "build");
const out = join(outDir, "zam-app-audio.exe");
const libs = ["ole32", "uuid", "version", "user32"];
mkdirSync(outDir, { recursive: true });

function findVcvars() {
    const vswhere = join(
        process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)",
        "Microsoft Visual Studio",
        "Installer",
        "vswhere.exe",
    );
    if (!existsSync(vswhere)) return null;
    try {
        const found = execFileSync(
            vswhere,
            [
                "-latest",
                "-products",
                "*",
                "-requires",
                "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
                "-find",
                "VC\\Auxiliary\\Build\\vcvars64.bat",
            ],
            { encoding: "utf8" },
        )
            .trim()
            .split(/\r?\n/)[0];
        return found && existsSync(found) ? found : null;
    } catch {
        return null;
    }
}

const vcvars = findVcvars();
if (vcvars) {
    // Static CRT (/MT) so the exe has no redistributable to install.
    const cl = [
        "cl",
        "/nologo",
        "/O2",
        "/MT",
        "/EHsc",
        "/W3",
        "/std:c++17",
        `"${src}"`,
        `/Fe:"${out}"`,
        `/Fo:"${outDir}\\\\"`,
        "/link",
        ...libs.map((l) => `${l}.lib`),
    ].join(" ");
    execFileSync(
        "cmd.exe",
        ["/d", "/s", "/c", `"call "${vcvars}" >nul && ${cl}"`],
        {
            stdio: "inherit",
            windowsVerbatimArguments: true,
        },
    );
    rmSync(join(outDir, "zam-app-audio.obj"), { force: true });
} else {
    execFileSync(
        "g++",
        [
            "-std=c++17",
            "-O2",
            "-municode",
            "-static",
            "-o",
            out,
            src,
            ...libs.map((l) => `-l${l}`),
        ],
        { stdio: "inherit" },
    );
}
console.log(`build-app-audio: built ${out}`);
