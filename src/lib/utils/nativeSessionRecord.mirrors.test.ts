/**
 * Drift guard for the two HAND-WRITTEN copies of the session record.
 *
 * `static/sw.js` and `MatrixMessagingService.java` cannot import TypeScript, so
 * each re-types the storage key and the record version as its own literal. All
 * three copies must agree or the whole design silently stops working — and it
 * fails in the quietest possible way: the writer stores under one key or stamps
 * one version, the reader looks for another, finds nothing, and reports "this
 * device has no credentials". No error, no log, just push enrichment and
 * active-session suppression that never fire again.
 *
 * Nothing else pinned these together, so this file reads both mirrors off disk
 * and compares their literals against the exported constants. Only the literals
 * whose drift is the actual failure mode are asserted — never comment text or
 * line numbers, which ordinary edits are supposed to change.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    NATIVE_SESSION_KEY,
    NATIVE_SESSION_VERSION,
} from "./nativeSessionRecord";

// Resolve via dirname(), NOT `new URL("…", import.meta.url)` — Vite rewrites
// that literal pattern into an *asset* reference ("http://localhost:3000/…")
// and fileURLToPath then throws "The URL must be of scheme file". Anchored to
// this file rather than to process.cwd() so the test does not depend on where
// vitest was launched from. (Same approach as themeParity.test.ts.)
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const KEEP_IN_STEP =
    "src/lib/utils/nativeSessionRecord.ts, static/sw.js and " +
    "android/app/src/main/java/moe/crafty/matrix/MatrixMessagingService.java " +
    "hand-mirror one another — change one, change all three.";

/** The two copies that cannot import the constants and must re-type them. */
const MIRRORS = [
    { path: "static/sw.js" },
    {
        path: "android/app/src/main/java/moe/crafty/matrix/MatrixMessagingService.java",
    },
] as const;

function readMirror(relPath: string): string {
    try {
        return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
    } catch (err) {
        throw new Error(
            `Could not read the session-record mirror ${relPath} (resolved under ${REPO_ROOT}). ` +
                `If it moved, update this test AND check the copy still matches. ${KEEP_IN_STEP} ` +
                `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
}

describe("session record mirrors", () => {
    for (const { path } of MIRRORS) {
        describe(path, () => {
            it("uses the same storage key as NATIVE_SESSION_KEY", () => {
                const source = readMirror(path);
                expect(
                    source.includes(JSON.stringify(NATIVE_SESSION_KEY)),
                    `${path} does not contain the storage key ${JSON.stringify(NATIVE_SESSION_KEY)} ` +
                        `exported as NATIVE_SESSION_KEY. A reader looking under a different key finds ` +
                        `nothing and reports "no credentials" — silently. ${KEEP_IN_STEP}`,
                ).toBe(true);
            });

            it("uses the same record version as NATIVE_SESSION_VERSION", () => {
                const source = readMirror(path);
                // Both mirrors name the constant SESSION_VERSION; capture
                // whatever they assign to it rather than hunting for a bare
                // "1", which occurs all over both files.
                const match = source.match(/\bSESSION_VERSION\s*=\s*(\d+)/);
                expect(
                    match,
                    `${path} has no \`SESSION_VERSION = <number>\` declaration to compare against ` +
                        `NATIVE_SESSION_VERSION. Either the version literal was dropped or the constant ` +
                        `was renamed; both hide version drift, and a version mismatch makes every stored ` +
                        `record parse as "no credentials". ${KEEP_IN_STEP}`,
                ).not.toBeNull();
                expect(
                    Number(match?.[1]),
                    `${path} declares SESSION_VERSION = ${match?.[1]} but NATIVE_SESSION_VERSION is ` +
                        `${NATIVE_SESSION_VERSION}. Records written by one side will be refused by the ` +
                        `other, silently. ${KEEP_IN_STEP}`,
                ).toBe(NATIVE_SESSION_VERSION);
            });
        });
    }
});
