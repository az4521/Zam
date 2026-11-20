/**
 * Build the Windows now-playing helper (native/media-session/zam-media.cpp)
 * into native/media-session/build/, where electron/mediaSession.cjs finds it in development
 * and electron-builder copies it from.
 *
 * Needs MSVC (Visual Studio or Build Tools 2022 with the C++ tools and the Windows
 * SDK), found with vswhere, because the source uses C++/WinRT. A no-op on other
 * platforms: Linux reads MPRIS and macOS MediaRemote instead.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
    console.log("build-media-session: not Windows, nothing to build");
    process.exit(0);
}

const root = fileURLToPath(new URL("../", import.meta.url));
const srcDir = join(root, "native", "media-session");
const src = join(srcDir, "zam-media.cpp");
const outDir = join(srcDir, "build");
const out = join(outDir, "zam-media.exe");
const libs = ["windowsapp"];
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
if (!vcvars) {
    console.error(
        "build-media-session: MSVC not found (install Visual Studio Build Tools with the C++ tools and a Windows SDK)",
    );
    process.exit(1);
}

// Static CRT (/MT) so the exe has no redistributable to install.
const cl = [
    "cl",
    "/nologo",
    "/O2",
    "/MT",
    "/EHsc",
    "/W3",
    "/std:c++17",
    // C++/WinRT includes <experimental/coroutine> under C++17, which MSVC
    // 14.5x (Visual Studio 18, the CI runner) rejects unless silenced. Same
    // fix as build-share-capture.mjs, which explains why not /std:c++20.
    "/D_SILENCE_EXPERIMENTAL_COROUTINE_DEPRECATION_WARNINGS",
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
rmSync(join(outDir, "zam-media.obj"), { force: true });
console.log(`build-media-session: built ${out}`);
