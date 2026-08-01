import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hasStaticImport } from "./staticImportGuard";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const CLIENT = "../matrix/client.ts";
const CODE_HIGHLIGHT = "./codeHighlight.ts";
const CODE_HIGHLIGHTER = "./codeHighlighter.svelte.ts";
const MESSAGE_ITEM = "../components/messages/MessageItem.svelte";
const VIDEO_TRACK = "../actions/videoTrack.ts";
const VIDEO_TILE = "../components/layout/VideoTile.svelte";

describe("heavy dependencies stay out of the core chunk", () => {
    it("client.ts does not statically import livekit-client", () => {
        expect(hasStaticImport(read(CLIENT), "livekit-client")).toBe(false);
    });

    it("client.ts still reaches livekit through a dynamic import", () => {
        expect(read(CLIENT)).toContain('import("livekit-client")');
    });

    it("codeHighlight.ts does not statically import highlight.js", () => {
        expect(hasStaticImport(read(CODE_HIGHLIGHT), "highlight.js")).toBe(
            false,
        );
    });

    it("codeHighlighter reaches highlight.js through a dynamic import", () => {
        expect(read(CODE_HIGHLIGHTER)).toContain(
            'import("highlight.js/lib/common")',
        );
    });

    it("MessageItem does not statically import highlight.js", () => {
        expect(hasStaticImport(read(MESSAGE_ITEM), "highlight.js")).toBe(false);
    });

    it("codeHighlighter does not statically import highlight.js either", () => {
        expect(hasStaticImport(read(CODE_HIGHLIGHTER), "highlight.js")).toBe(
            false,
        );
    });

    // These two hold a `Track` type only. They are correct as they stand and
    // are pinned so that a future reader "fixing" them into value imports —
    // which is all it takes to drag the 520 KB chunk back into the core —
    // trips a test instead of a bundle nobody re-measures.
    it("videoTrack.ts keeps its livekit Track import type-only", () => {
        expect(read(VIDEO_TRACK)).toContain(
            'import type { Track } from "livekit-client"',
        );
        expect(hasStaticImport(read(VIDEO_TRACK), "livekit-client")).toBe(
            false,
        );
    });

    it("VideoTile.svelte keeps its livekit Track import type-only", () => {
        expect(read(VIDEO_TILE)).toContain(
            'import type { Track } from "livekit-client"',
        );
        expect(hasStaticImport(read(VIDEO_TILE), "livekit-client")).toBe(false);
    });
});

describe("the guard is actually reading these files", () => {
    // Without these, every assertion above would still pass if `read` silently
    // returned "" or the matcher regressed to always-false. Each names a
    // static import the file genuinely has today.
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
