// Packs build/twemoji/svg/ into build/twemoji/svg.pack after `vite build`
// (see electron/twemojiPack.cjs). The loose files stay: the web and Android
// serve them, and the desktop app packs only the .pack (electron-builder
// `files`, and bundleUpdater skips them when unpacking a web bundle).
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PACK_PATH, packTwemoji } = require("../electron/twemojiPack.cjs");

const build = fileURLToPath(new URL("../build/", import.meta.url));
const pack = packTwemoji(join(build, "twemoji", "svg"));
writeFileSync(join(build, PACK_PATH), pack);
console.log(`pack-twemoji: ${(pack.length / 1e6).toFixed(2)} MB`);
