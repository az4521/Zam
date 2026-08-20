#!/usr/bin/env node
/**
 * Permanent guard: fail the build if the active-session constants drift out
 * of sync across their three hand-mirrored locations.
 *
 * MAX_FUTURE_SKEW_MS and MAX_GRACE_MS live in src/lib/utils/activeSession.ts
 * and are hand-mirrored in static/sw.js and
 * android/app/src/main/java/moe/crafty/matrix/MatrixMessagingService.java
 * (the service worker and Android service can't import TypeScript). This
 * guard asserts they stay equal. Any drift breaks active-session push
 * suppression silently, which is worse than a build failure.
 *
 * Wired into `npm run build`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkActiveSessionSync } from "../src/lib/utils/checkActiveSessionConstants.ts";

const ROOT = process.cwd();

const FILES = {
    "activeSession.ts": join(ROOT, "src/lib/utils/activeSession.ts"),
    "sw.js": join(ROOT, "static/sw.js"),
    "MatrixMessagingService.java": join(
        ROOT,
        "android/app/src/main/java/moe/crafty/matrix/MatrixMessagingService.java",
    ),
};

const sources = {};
for (const [key, path] of Object.entries(FILES)) {
    try {
        sources[key] = readFileSync(path, "utf8");
    } catch (err) {
        console.error(`Failed to read ${path}: ${err.message}`);
        process.exit(1);
    }
}

const result = checkActiveSessionSync(sources);

if (!result.ok) {
    console.error("Active-session constants are out of sync:");
    for (const m of result.mismatches) {
        console.error(`\n  ${m.constant}:`);
        for (const [file, value] of Object.entries(m.values)) {
            const display = value === undefined ? "MISSING" : value;
            console.error(`    ${file}: ${display}`);
        }
    }
    console.error(
        "\nThese constants must be identical across all three files.",
    );
    console.error("See ARCHITECTURE.md:316-320 for context.");
    process.exit(1);
}

console.log("check-active-session-sync: constants in sync.");
