import { lazyModule } from "./lazyModule";
import { containsCodeBlock, type HighlightEngine } from "./codeHighlight";

/** highlight.js is ~40 languages of parser that most sessions never need.
 *  It now arrives in its own chunk, fetched the first time a message that
 *  actually contains a code block is rendered. */
const highlighter = lazyModule(async () => {
    const mod = await import("highlight.js/lib/common");
    return mod.default as unknown as HighlightEngine;
});

let chunkFetchFailed = false;

// $state.raw: deep-proxying an opaque third-party object (highlight.js) is wrong.
// Svelte memoizes a child proxy per property, but there is no global object→proxy
// cache, so one underlying object reached by two different property paths gets two
// distinct proxies — which defeats identity-based cycle detection in serializers and
// diagnostics walking a graph as self-referential as hljs. Use raw instead: the whole
// engine is replaced wholesale.
let engine = $state.raw<HighlightEngine | null>(null);

/**
 * The loaded highlighter, or null while it is still on its way.
 *
 * Reading this inside a component's markup (or a `$effect`) subscribes that
 * consumer to the one state change this module ever makes — null → engine —
 * so a code block painted before the chunk landed is re-rendered coloured.
 * The `.message-body pre` frame does not depend on highlighting, so the
 * upgrade recolours text and moves nothing.
 */
export function highlighterFor(html: string): HighlightEngine | null {
    // Read first and unconditionally: this read IS the subscription.
    const loaded = engine;
    if (loaded) return loaded;
    if (containsCodeBlock(html))
        void highlighter
            .load()
            .then((mod) => {
                engine = mod;
            })
            // A failed chunk fetch leaves code blocks plain rather than
            // breaking the message; lazyModule keeps it retryable, and the
            // next code block rendered tries again. Warn once per session so
            // users with blocked chunk networks know code blocks are degraded.
            .catch(() => {
                if (!chunkFetchFailed) {
                    chunkFetchFailed = true;
                    console.warn(
                        "highlight.js chunk failed to load; code blocks will display without syntax highlighting",
                    );
                }
            });
    return null;
}
