import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hasStaticImport } from "./staticImportGuard";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const CLIENT = "../matrix/client.ts";
const CODE_HIGHLIGHT = "./codeHighlight.ts";
const CODE_HIGHLIGHTER = "./codeHighlighter.svelte.ts";
const MESSAGE_ITEM = "../components/messages/MessageItem.svelte";
const VIDEO_TRACK = "../actions/videoTrack.ts";
const VIDEO_TILE = "../components/layout/VideoTile.svelte";

const HEAVY_DEPS = ["livekit-client", "highlight.js"];

// The whole `src/` tree, walked once. An enumerated list of "the files that
// import these today" is blind to the file that does not exist yet — and the
// realistic regression is a NEW call-UI component reading `Track`/`RoomEvent`
// as values, which drags the 520 KB chunk back into the core with every
// existing test still green. So the negative is asserted over every source
// file instead of a hand-written six.
//
// Derived with `dirname`, NOT with `new URL("../../", import.meta.url)`:
// Vite rewrites that literal shape at transform time as an asset URL, and
// under Vitest it evaluates to `http://localhost:3000/src` — not a file URL,
// so `readdirSync` would throw. (`read()` above survives only because its
// path argument is a variable, which the transform skips.)
const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// `readdirSync(…, {recursive:true})` yields paths with the PLATFORM separator
// (`lib\matrix\client.ts` on Windows). Normalise to `/` so the pins below and
// the generated test names read identically everywhere; `path.join` accepts
// forward slashes on Windows.
const entries = readdirSync(SRC_DIR, { recursive: true, encoding: "utf8" }).map(
    (f) => f.replace(/\\/g, "/"),
);
const isSourceFile = (f: string) => /\.(ts|svelte)$/.test(f);
const isTestFile = (f: string) => /\.(test|spec)\.ts$/.test(f);

const SOURCE_FILES = entries.filter((f) => isSourceFile(f) && !isTestFile(f));
const TEST_FILES = entries.filter((f) => isSourceFile(f) && isTestFile(f));

const readSource = (f: string) => readFileSync(join(SRC_DIR, f), "utf8");

describe("no source file under src/ statically imports a heavy dependency", () => {
    // Without this, an empty or mis-joined file list would turn the whole
    // sweep into zero silently-passing tests — the exact failure mode the
    // sweep exists to close.
    it("the sweep enumerates the real source tree", () => {
        expect(SOURCE_FILES.length).toBeGreaterThan(100);
        expect(SOURCE_FILES).toContain("lib/matrix/client.ts");
        expect(SOURCE_FILES).toContain("lib/utils/codeHighlight.ts");
        expect(SOURCE_FILES).toContain(
            "lib/components/layout/VideoTile.svelte",
        );
        // …and the sweep's own path join reads real bytes, not an empty file.
        expect(
            hasStaticImport(
                readSource("lib/matrix/client.ts"),
                "matrix-js-sdk",
            ),
        ).toBe(true);
    });

    // Excluding `*.test.ts` is required, not cosmetic: staticImportGuard's own
    // fixtures are literal static imports of livekit-client. Pinned here so a
    // future widening of the sweep to test files fails loudly with a reason.
    it("excludes test files, which hold static-import fixtures", () => {
        expect(TEST_FILES).toContain("lib/utils/staticImportGuard.test.ts");
        expect(SOURCE_FILES).not.toContain(
            "lib/utils/staticImportGuard.test.ts",
        );
        expect(
            hasStaticImport(
                readSource("lib/utils/staticImportGuard.test.ts"),
                "livekit-client",
            ),
        ).toBe(true);
    });

    it.each(SOURCE_FILES.map((f) => [f]))(
        "%s statically imports neither heavy dep",
        (file) => {
            const source = readSource(file);
            for (const dep of HEAVY_DEPS) {
                expect(hasStaticImport(source, dep)).toBe(false);
            }
        },
    );
});

describe("the heavy dependencies are still reachable, lazily", () => {
    it("client.ts still reaches livekit through a dynamic import", () => {
        expect(read(CLIENT)).toContain('import("livekit-client")');
    });

    it("codeHighlighter reaches highlight.js through a dynamic import", () => {
        expect(read(CODE_HIGHLIGHTER)).toContain(
            'import("highlight.js/lib/common")',
        );
    });

    // These two hold a `Track` type only. They are correct as they stand and
    // are pinned so that a future reader "fixing" them into value imports —
    // which is all it takes to drag the 520 KB chunk back into the core —
    // trips a test instead of a bundle nobody re-measures. (The sweep above
    // catches that too; this names the file and the expected form.)
    it("videoTrack.ts keeps its livekit Track import type-only", () => {
        expect(read(VIDEO_TRACK)).toContain(
            'import type { Track } from "livekit-client"',
        );
    });

    it("VideoTile.svelte keeps its livekit Track import type-only", () => {
        expect(read(VIDEO_TILE)).toContain(
            'import type { Track } from "livekit-client"',
        );
    });
});

describe("the guard is actually reading these files", () => {
    // Without these, every negative assertion above would still pass if `read`
    // silently returned "" or the matcher regressed to always-false. Each
    // names a static import the file genuinely has today.
    it.each([
        [CLIENT, "matrix-js-sdk"],
        [CODE_HIGHLIGHTER, "./lazyModule"],
        [MESSAGE_ITEM, "lucide-svelte"],
        [VIDEO_TILE, "lucide-svelte"],
    ])("%s statically imports %s", (path, specifier) => {
        expect(hasStaticImport(read(path), specifier)).toBe(true);
    });

    // codeHighlight.ts has no static imports at all, so its control is that
    // the module name is present in prose while the matcher still says no —
    // which also proves the matcher is not a substring search.
    it("codeHighlight.ts names highlight.js in prose without importing it", () => {
        expect(read(CODE_HIGHLIGHT)).toContain("highlight.js");
        expect(hasStaticImport(read(CODE_HIGHLIGHT), "highlight.js")).toBe(
            false,
        );
    });
});
