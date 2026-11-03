#!/usr/bin/env node
/**
 * List the English strings each translation is missing. Catalogues are typed
 * `Partial`, so a missing string compiles and falls back to English at
 * runtime; this is how a translator finds them.
 *
 *   npm run i18n:missing          counts per language, then every missing key
 *   npm run i18n:missing -- ja    one language only
 *
 * Exits 0 either way: an incomplete translation is not an error.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src", "lib", "i18n");

// Every catalogue is one flat object literal with a key per line, indented
// four spaces (prettier keeps it that way).
function keysOf(file) {
    const keys = [];
    for (const m of readFileSync(file, "utf8").matchAll(/^ {4}"([^"]+)":/gm))
        keys.push(m[1]);
    return keys;
}

const english = keysOf(join(DIR, "en.ts"));
const only = process.argv[2];
const codes = readdirSync(join(DIR, "locales"))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.slice(0, -3))
    .filter((code) => !only || code === only);

if (only && codes.length === 0) {
    console.error(`No catalogue for "${only}" in src/lib/i18n/locales.`);
    process.exit(1);
}

for (const code of codes) {
    const have = new Set(keysOf(join(DIR, "locales", `${code}.ts`)));
    const missing = english.filter((k) => !have.has(k));
    console.log(`${code}: ${missing.length} of ${english.length} missing`);
    for (const key of missing) console.log(`    ${key}`);
}
