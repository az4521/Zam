// Writes electron/shell-hash.json, the fingerprint this shell reports to the
// web-bundle updater (see shell-hash-lib.mjs). Run before electron-builder, so
// it is packed into every desktop build. Without the file the app never
// accepts a web bundle and updates through the installer as before.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeShellHash } from "./shell-hash-lib.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = computeShellHash(root);
writeFileSync(
    fileURLToPath(new URL("../electron/shell-hash.json", import.meta.url)),
    JSON.stringify({ hash }) + "\n",
);
console.log(`shell fingerprint ${hash.slice(0, 12)}`);
