// A fingerprint of the desktop shell: everything a web bundle can depend on
// that a web bundle cannot carry. The main process, preload, native helper
// sources, the Electron version, runtime dependencies and the packaging
// config. A bundle built on shell X runs on a shell with the same fingerprint
// and nothing else; any other shell takes the full installer update.
//
// Computed from sources, never from build output, so the Windows installer,
// the AppImage, the Flatpak and the release job's bundle all agree. Text files
// are hashed with CR removed so a CRLF checkout hashes like an LF one.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const TEXT_EXT = new Set([".cjs", ".js", ".mjs", ".json", ".md", ".txt"]);
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
    return TEXT_EXT.has(extname(file)) || NATIVE_EXT.has(extname(file))
        ? Buffer.from(buf.toString("latin1").replace(/\r/g, ""), "latin1")
        : buf;
}

export function computeShellHash(root) {
    const h = createHash("sha256");
    const add = (label, buf) => {
        h.update(`${label}\0${buf.length}\0`);
        h.update(buf);
    };

    const files = [
        ...walk(join(root, "electron"), (n) => n !== OUTPUT_FILE),
        ...(existsSync(join(root, "native"))
            ? walk(join(root, "native"), (n) => NATIVE_EXT.has(extname(n)))
            : []),
    ];
    for (const file of files) {
        const label = relative(root, file).split(sep).join("/");
        add(label, normalized(file, readFileSync(file)));
    }

    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const electronPkg = join(root, "node_modules", "electron", "package.json");
    const electronVersion = existsSync(electronPkg)
        ? JSON.parse(readFileSync(electronPkg, "utf8")).version
        : (pkg.devDependencies?.electron ?? "");
    add(
        "package",
        Buffer.from(
            JSON.stringify({
                electron: electronVersion,
                dependencies: pkg.dependencies ?? {},
                build: pkg.build ?? {},
            }),
        ),
    );
    return h.digest("hex");
}
