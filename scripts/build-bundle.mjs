// Packs build/ into a signed web bundle for the release (the desktop app's
// no-reinstall update; see electron/bundleUpdater.cjs). Writes to dist-bundle/:
//   zam-bundle-<version>.zbundle   the archive
//   zam-bundle.json                manifest: version, shell fingerprint, hash,
//                                  and the ECDSA P-256 signature over all of it
// Needs ZAM_BUNDLE_SIGNING_KEY (base64 PKCS8 DER). Without it nothing is
// written and the release ships installers only, which every app still takes.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
    computeAndroidShellHash,
    computeShellHash,
} from "./shell-hash-lib.mjs";

const require = createRequire(import.meta.url);
const { packBundle, signManifest } = require("../electron/bundleFormat.cjs");

const root = fileURLToPath(new URL("../", import.meta.url));
const key = process.env.ZAM_BUNDLE_SIGNING_KEY;
if (!key) {
    console.warn("ZAM_BUNDLE_SIGNING_KEY is not set: no web bundle written.");
    process.exit(0);
}

const { version } = JSON.parse(readFileSync(root + "package.json", "utf8"));
const archive = await packBundle(root + "build");
const file = `zam-bundle-${version}.zbundle`;
const manifest = {
    version,
    shellHash: computeShellHash(root),
    androidShellHash: computeAndroidShellHash(root),
    file,
    sha512: createHash("sha512").update(archive).digest("base64"),
    size: archive.length,
};
manifest.signature = signManifest(manifest, key);

mkdirSync(root + "dist-bundle", { recursive: true });
writeFileSync(root + "dist-bundle/" + file, archive);
writeFileSync(
    root + "dist-bundle/zam-bundle.json",
    JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
    `web bundle ${version}: ${(archive.length / 1e6).toFixed(1)} MB, shell ${manifest.shellHash.slice(0, 12)}`,
);
