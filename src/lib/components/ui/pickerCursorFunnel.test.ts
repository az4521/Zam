// @vitest-environment node
// Reads the picker sources off disk; under the default jsdom environment
// `import.meta.url` is not this file's real file:// URL, so the relative
// resolve below lands outside the repo. Same reason themeContrast.test.ts
// pins the node environment.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The three composer pickers keep an ARIA listbox cursor anchored to the option
 * it was placed on: `selectedIndex` says WHERE, and a key says WHICH, and
 * `anchoredActiveIndex` refuses to report anything active when they disagree.
 *
 * That invariant is only as good as the discipline that every cursor move
 * records both. An assignment to `selectedIndex` that skips the setter leaves a
 * stale key next to a fresh index, which reads as "nothing active" FOREVER --
 * a silently dead cursor, worse than the bug the anchor removes, and invisible
 * to every other test in the suite. Reading the source is what makes a missed
 * site impossible rather than merely unlikely.
 */
const PICKERS = ["EmojiPicker", "StickerPicker", "GifPicker"] as const;

function source(name: string): string {
    return readFileSync(
        fileURLToPath(new URL(`./${name}.svelte`, import.meta.url)),
        "utf8",
    );
}

// `selectedIndex = …` but not `===`/`==`/`!=`, and not a `$state` declaration.
const ASSIGNMENT =
    /(?<!\w)selectedIndex\s*(?:[-+*/|&^]|\?\?|<<|>>>?)?=(?![=>])/g;

describe.each(PICKERS)("%s cursor funnel", (name) => {
    const src = source(name);

    it("assigns selectedIndex in exactly one place", () => {
        const hits = src.match(ASSIGNMENT) ?? [];
        // One declaration (`let selectedIndex = $state(-1)`) + one write
        // (inside `moveCursor`). Anything more is an unfunnelled write site.
        expect(hits).toHaveLength(2);
    });

    it("keeps that one write inside moveCursor", () => {
        const setter = src.match(
            /function moveCursor\(next: number\) \{[\s\S]*?\n {4}\}/,
        );
        expect(setter, "moveCursor(next: number) must exist").not.toBeNull();
        expect(setter![0]).toContain("selectedIndex = next;");
    });

    it("declares the cursor and its anchor as separate state", () => {
        expect(src).toMatch(/let selectedIndex = \$state\(-1\);/);
        expect(src).toMatch(
            /let selected(?:Key|Url) = \$state<string \| null>\(null\);/,
        );
    });

    it("derives the active index through the anchor, not a bare clamp", () => {
        expect(src).toContain("anchoredActiveIndex(");
        expect(src).not.toContain("clampActiveIndex(selectedIndex");
    });

    it("never drives aria-selected or the focus ring from the raw index", () => {
        // The markup must compare against the ANCHORED index. Reading the raw
        // one is how aria-selected and aria-activedescendant drift apart:
        // the descendant id goes absent while the ring stays on a stranger.
        const markup = src.slice(src.indexOf("</script>"));
        expect(markup).not.toContain("selectedIndex");
    });
});
