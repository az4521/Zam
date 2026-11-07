/**
 * Build ungive/mediaremote-adapter's framework and Perl script into
 * native/mediaremote-adapter/, where electron/mediaSession.cjs finds them in
 * development and electron-builder copies them from
 * (package.json build.mac.extraResources).
 *
 * The adapter reads the private MediaRemote framework through /usr/bin/perl,
 * a platform binary that mediaremoted still lets read now playing data. It is
 * the only way to see players that have no scripting dictionary.
 *
 * A no-op on other platforms: macOS is the only one that needs it. Needs git,
 * cmake and the Xcode command line tools. The adapter is BSD-3-Clause; see
 * THIRD_PARTY_NOTICES.md.
 */
import { execFileSync } from "node:child_process";
import {
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "v0.7.7";
const REPO = "https://github.com/ungive/mediaremote-adapter.git";

if (process.platform !== "darwin") {
    console.log("build-mediaremote-adapter: not macOS, nothing to build");
    process.exit(0);
}

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = join(root, "native", "mediaremote-adapter");
const srcDir = join(outDir, "src");
const buildDir = join(outDir, "build");
const framework = join(outDir, "MediaRemoteAdapter.framework");
const script = join(outDir, "mediaremote-adapter.pl");
const versionFile = join(outDir, "VERSION");

// Only a build of this exact tag is reused; a stale one is replaced.
const builtVersion = existsSync(versionFile)
    ? readFileSync(versionFile, "utf8").trim()
    : null;
if (builtVersion === VERSION && existsSync(framework) && existsSync(script)) {
    console.log("build-mediaremote-adapter: already built");
    process.exit(0);
}

rmSync(framework, { recursive: true, force: true });
rmSync(script, { force: true });
rmSync(srcDir, { recursive: true, force: true });
rmSync(buildDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

execFileSync(
    "git",
    ["clone", "--depth", "1", "--branch", VERSION, REPO, srcDir],
    { stdio: "inherit" },
);
execFileSync(
    "cmake",
    ["-S", srcDir, "-B", buildDir, "-DCMAKE_BUILD_TYPE=Release"],
    { stdio: "inherit" },
);
execFileSync(
    "cmake",
    [
        "--build",
        buildDir,
        "--config",
        "Release",
        "--target",
        "MediaRemoteAdapter",
    ],
    { stdio: "inherit" },
);

// Single-config generators put the framework in build/, multi-config ones
// (Xcode) in build/Release/.
const built = [
    join(buildDir, "MediaRemoteAdapter.framework"),
    join(buildDir, "Release", "MediaRemoteAdapter.framework"),
].find((p) => existsSync(p));
if (!built) throw new Error("build-mediaremote-adapter: framework not built");

// Keep the bundle's symlinks (Versions/Current) as they are.
cpSync(built, framework, { recursive: true, dereference: false });
cpSync(join(srcDir, "bin", "mediaremote-adapter.pl"), script);
writeFileSync(versionFile, `${VERSION}\n`);

// Leave no build tree behind for electron-builder to pack.
rmSync(srcDir, { recursive: true, force: true });
rmSync(buildDir, { recursive: true, force: true });
console.log(`build-mediaremote-adapter: built ${framework}`);
