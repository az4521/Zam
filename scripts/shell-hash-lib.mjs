// A fingerprint of the app shell: everything a web bundle can depend on that a
// web bundle cannot carry. A bundle built on shell X runs on a shell with the
// same fingerprint and nothing else; any other shell takes the full installer
// (or APK) update.
//
// Desktop: the main process, preload, native helper sources, the Electron
// version, runtime dependencies and the packaging config. Android: the Java,
// resources, manifest and build files, plus the dependencies that become
// Capacitor plugins.
//
// Computed from sources, never from build output, so the Windows installer,
// the AppImage, the Flatpak, the APK and the release job's bundle all agree.
// Text files are hashed with CR removed so a CRLF checkout hashes like an LF
// one.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const TEXT_EXT = new Set([
    ".cjs",
    ".js",
    ".mjs",
    ".json",
    ".md",
    ".txt",
    ".java",
    ".xml",
    ".gradle",
    ".properties",
    ".ts",
]);
const NATIVE_EXT = new Set([".cpp", ".h", ".hpp", ".c"]);
// Written into electron/ by gen-shell-hash.mjs, so it cannot be an input.
const OUTPUT_FILE = "shell-hash.json";

function walk(dir, keep, out = []) {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) walk(full, keep, out);
        else if (e.isFile() && keep(e.name)) out.push(full);
    }
    return out;
}

function normalized(file, buf) {
    const ext = extname(file);
    return TEXT_EXT.has(ext) || NATIVE_EXT.has(ext)
        ? Buffer.from(buf.toString("latin1").replace(/\r/g, ""), "latin1")
        : buf;
}

function hashFiles(root, files, extra) {
    const h = createHash("sha256");
    const add = (label, buf) => {
        h.update(`${label}\0${buf.length}\0`);
        h.update(buf);
    };
    for (const file of files) {
        const label = relative(root, file).split(sep).join("/");
        add(label, normalized(file, readFileSync(file)));
    }
    for (const [label, value] of Object.entries(extra))
        add(label, Buffer.from(JSON.stringify(value)));
    return h.digest("hex");
}

export function computeShellHash(root) {
    const files = [
        ...walk(join(root, "electron"), (n) => n !== OUTPUT_FILE),
        ...(existsSync(join(root, "native"))
            ? walk(join(root, "native"), (n) => NATIVE_EXT.has(extname(n)))
            : []),
    ];
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const electronPkg = join(root, "node_modules", "electron", "package.json");
    const electronVersion = existsSync(electronPkg)
        ? JSON.parse(readFileSync(electronPkg, "utf8")).version
        : (pkg.devDependencies?.electron ?? "");
    return hashFiles(root, files, {
        package: {
            electron: electronVersion,
            dependencies: pkg.dependencies ?? {},
            build: pkg.build ?? {},
        },
    });
}

// Committed sources only. The generated Gradle files (cap sync rewrites them
// from package.json), assets (including the web build itself) and
// google-services.json are left out, so the release's bundle job and the
// Android job agree whether or not they have run cap sync yet.
const ANDROID_FILES = [
    "android/app/src/main/AndroidManifest.xml",
    "android/app/build.gradle",
    "android/build.gradle",
    "android/variables.gradle",
    "android/settings.gradle",
    "android/gradle.properties",
    "android/gradle/wrapper/gradle-wrapper.properties",
    "capacitor.config.ts",
];
const ANDROID_DIRS = ["android/app/src/main/java", "android/app/src/main/res"];

export function computeAndroidShellHash(root) {
    const files = [
        ...ANDROID_FILES.map((f) => join(root, f)).filter((f) => existsSync(f)),
        ...ANDROID_DIRS.flatMap((d) => walk(join(root, d), () => true)),
    ].sort();
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return hashFiles(root, files, {
        package: { dependencies: pkg.dependencies ?? {} },
    });
}
