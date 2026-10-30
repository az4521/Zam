// Writes android/app/src/main/assets/shell-hash.json, the fingerprint the
// Android app reports to its web-bundle updater (see shell-hash-lib.mjs). Run
// before Gradle, and before `cap sync` replaces anything, so it is packed into
// every APK. Without it the app never accepts a web bundle and updates through
// the APK as before.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { computeAndroidShellHash } from "./shell-hash-lib.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const hash = computeAndroidShellHash(root);
const dir = fileURLToPath(
    new URL("../android/app/src/main/assets/", import.meta.url),
);
mkdirSync(dir, { recursive: true });
writeFileSync(dir + "shell-hash.json", JSON.stringify({ hash }) + "\n");
console.log(`android shell fingerprint ${hash.slice(0, 12)}`);
