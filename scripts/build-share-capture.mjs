/**
 * Build the Windows screen-capture + H.264 helper (native/share-capture/zam-share.cpp)
 * into native/share-capture/build/, where the Electron side finds it in development
 * and electron-builder copies it from.
 *
 * Needs MSVC (Visual Studio or Build Tools 2022 with the C++ tools and the Windows
 * SDK), found with vswhere, because the source uses C++/WinRT. A no-op on other
 * platforms: screen capture there does not use this helper.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
    console.log("build-share-capture: not Windows, nothing to build");
    process.exit(0);
}

const root = fileURLToPath(new URL("../", import.meta.url));
const srcDir = join(root, "native", "share-capture");
const src = join(srcDir, "zam-share.cpp");
const outDir = join(srcDir, "build");
const out = join(outDir, "zam-share.exe");
const libs = [
    "windowsapp",
    "d3d11",
    "dxgi",
    "mfplat",
    "mfuuid",
    "mf",
    "ole32",
    "oleaut32",
    "user32",
    "dwmapi",
];
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
        "build-share-capture: MSVC not found (install Visual Studio Build Tools with the C++ tools and a Windows SDK)",
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
    // C++/WinRT includes <experimental/coroutine> under C++17. MSVC 14.5x
    // (Visual Studio 18, the CI runner) turns its deprecation into a hard
    // error; this define keeps it a no-op. /std:c++20 is not the way out:
    // the Windows SDK C++/WinRT that ships with VS 2022 still includes the
    // experimental header there, which C++20 rejects outright.
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
rmSync(join(outDir, "zam-share.obj"), { force: true });
console.log(`build-share-capture: built ${out}`);
