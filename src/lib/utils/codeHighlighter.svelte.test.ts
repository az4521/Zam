import { describe, it, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { highlightCodeBlocks, type HighlightEngine } from "./codeHighlight";

const CODE = '<pre><code class="language-js">const a = 1;</code></pre>';

let instances = 0;

/**
 * The engine lives in one module-level `$state`, and Vitest runs a file's
 * tests in order against one module instance — so a test that let the engine
 * load would hand the next test an already-loaded highlighter, and "does not
 * load" would assert nothing. A query suffix makes Vite resolve a distinct
 * module id, so each test gets a highlighter that has never loaded.
 *
 * Deliberately NOT `vi.resetModules()`: that also re-instantiates svelte's
 * client runtime, so the fresh module's `$state` lands on a different
 * reactive graph than this file's `$effect` — the effect then never re-runs
 * and the test fails for a reason that has nothing to do with the seam.
 */
async function freshHighlighterFor() {
    const url = `./codeHighlighter.svelte.ts?instance=${instances++}`;
    const mod = (await import(
        /* @vite-ignore */ url
    )) as typeof import("./codeHighlighter.svelte");
    return mod.highlighterFor;
}

describe("highlighterFor", () => {
    it("re-runs a reader when the engine arrives", async () => {
        const highlighterFor = await freshHighlighterFor();
        const seen: (HighlightEngine | null)[] = [];
        const stop = $effect.root(() => {
            $effect(() => {
                seen.push(highlighterFor(CODE));
            });
        });
        flushSync();
        expect(seen).toEqual([null]);

        await vi.waitFor(() => {
            flushSync();
            expect(seen.length).toBe(2);
        });
        expect(seen[1]).not.toBeNull();
        // and it is a real highlighter, not a placeholder object
        expect(highlightCodeBlocks(CODE, seen[1])).toContain("hljs-keyword");
        stop();
    });

    it("does not load the highlighter for html with no code block", async () => {
        const highlighterFor = await freshHighlighterFor();
        const seen: (HighlightEngine | null)[] = [];
        const stop = $effect.root(() => {
            $effect(() => {
                seen.push(highlighterFor("just <b>text</b>"));
            });
        });
        flushSync();
        await new Promise((r) => setTimeout(r, 50));
        flushSync();
        expect(seen).toEqual([null]);
        stop();
    });
});
