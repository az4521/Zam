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
 * stale key next to a fresh index, which reads as "nothing active": Left,
 * Right, Home, End and Enter all no-op, and the next ArrowDown -- which tests
 * for -1 and re-enters at index 0 -- bounces the user to the top of the list.
 * Not permanent: any `moveCursor(n >= 0)` re-owns the cursor, because it
 * recomputes the key at the new index. But it is silent, it is invisible to
 * every other test in the suite, and it lands on whoever was mid-navigation.
 * Reading the source is what makes a missed site impossible rather than merely
 * unlikely.
 *
 * CONVENTION THIS GUARD DEPENDS ON: in the three picker files, every prose
 * mention of the cursor variable is backtick-wrapped -- `selectedIndex`, never
 * bare. The matcher below reads the file as TEXT, not as a parse tree, so it
 * cannot tell code from a comment or a string literal: a comment reading
 * "old code did selectedIndex = -1 here", or a `const s = "selectedIndex = 5"`,
 * counts as a write site and trips this test. That is the deliberate trade --
 * it fails LOUDLY, and the fix is to wrap the mention in backticks (or reword
 * it), whereas stripping comments and strings properly would mean carrying a
 * parser in a guard whose whole point is that it is dumb enough to be certain.
 */
const PICKERS = ["EmojiPicker", "StickerPicker", "GifPicker"] as const;

function source(name: string): string {
    return readFileSync(
        fileURLToPath(new URL(`./${name}.svelte`, import.meta.url)),
        "utf8",
    );
}

/**
 * Every syntactic form that WRITES to a bare `selectedIndex`.
 *
 * Built branch-by-branch rather than as one literal, because each branch has to
 * be justified: a form this matcher misses is a write site the guard below
 * waves through while still reporting its comfortable "exactly one". The
 * matcher's own coverage is therefore pinned by fixtures (see the "ASSIGNMENT
 * matcher" describe at the bottom) -- narrowing it silently is not possible.
 *
 * A leading `.` is excluded along with `\w` and `$`: the cursor is a
 * module-level `let` inside a Svelte component, so no object path can ever
 * reach it, while `someSelectEl.selectedIndex = 0` is a real DOM API that could
 * plausibly turn up here one day. Excluding it can hide no real write and
 * removes a whole class of false positive.
 */
const ASSIGNMENT = new RegExp(
    [
        // `selectedIndex = …`, plus every compound form: `+= -= *= /= %= **=`,
        // `<<= >>= >>>=`, `&= |= ^=`, `&&= ||= ??=`. The trailing `(?![=>])`
        // rejects `==`/`===`/`=>`; `!=`, `!==`, `>=` and `<=` never reach that
        // `=` at all, because `!`, `>` and `<` are not in the operator set.
        // (`&&=`/`||=` need their own two-char alternatives ahead of the single
        // char class -- a class that eats one `&` leaves the second one facing
        // the required `=`, which is how they used to slip through.)
        String.raw`(?<![\w.$])selectedIndex\s*(?:\*\*|<<|>>>?|&&|\|\||\?\?|[-+*/%|&^])?=(?![=>])`,
        // `selectedIndex++` / `selectedIndex--` -- the single most likely shape
        // for a future "just nudge the cursor" edit. No line terminator may sit
        // between an operand and its POSTFIX operator, so this branch stays on
        // one line: `[^\S\n]` is "whitespace, but not a newline".
        String.raw`(?<![\w.$])selectedIndex[^\S\n]*(?:\+\+|--)`,
        // `++selectedIndex` / `--selectedIndex`.
        String.raw`(?:\+\+|--)\s*selectedIndex(?![\w$])`,
        // Destructuring targets: `[selectedIndex] = …`, `[a, selectedIndex] = …`,
        // `({ selectedIndex } = o)`, `({ x: selectedIndex } = o)`. Deliberately
        // coarse -- it flags the name appearing inside a bracketed pattern that
        // is being assigned to. `{ selectedIndex: si } = o` is excluded by the
        // `:` in the lookahead, because there the name is the SOURCE property
        // and `si` is the target; a defaulted target (`{ selectedIndex = 5 } =
        // o`) is out of reach of a regex this size and is not defended.
        String.raw`[[{][^\]}=\n]*(?<![\w.$])selectedIndex(?![\w$:])[^\]}=\n]*[\]}]\s*=(?![=>])`,
    ].join("|"),
    "g",
);

function writeSites(src: string): string[] {
    // `String.prototype.match` with a /g/ regex resets lastIndex itself, so the
    // shared matcher stays safe to reuse across every call in this file.
    return src.match(ASSIGNMENT) ?? [];
}

describe.each(PICKERS)("%s cursor funnel", (name) => {
    const src = source(name);

    it("assigns selectedIndex in exactly one place", () => {
        // One declaration (`let selectedIndex = $state(-1)`) + one write
        // (inside `moveCursor`). Anything more is an unfunnelled write site.
        expect(writeSites(src)).toHaveLength(2);
    });

    it("keeps that one write inside moveCursor, at the top level", () => {
        // BOTH ends are anchored to a 4-space indent (.prettierrc pins
        // tabWidth 4 / useTabs false), which is the top level of the <script>
        // block. Anchoring only the closing brace fails in the wrong
        // direction: if `moveCursor` were ever nested inside another function,
        // a lazy `[\s\S]*?` would run past the setter's own closing brace to
        // the ENCLOSING function's column-4 one, and that oversized region
        // would still contain `selectedIndex = next;` -- green while asserting
        // something much weaker. With the opening indent anchored too, a
        // nested setter matches NOTHING and the next line fails loudly.
        const setter = src.match(
            /\n {4}function moveCursor\(next: number\) \{[\s\S]*?\n {4}\}/,
        );
        expect(
            setter,
            "moveCursor(next: number) must be declared at the top level of the <script> block (4-space indent). If it was moved or nested, update this guard deliberately -- do not just loosen the anchors.",
        ).not.toBeNull();
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
        //
        // The delimiter is asserted before it is used: `indexOf` returns -1
        // when it finds nothing, and `slice(-1)` is the file's final character
        // -- a one-char "markup" that trivially contains no `selectedIndex`,
        // so the guard would go green while checking nothing. Svelte permits
        // the <script> block BELOW the markup, so that refactor is legal.
        const scriptEnd = src.indexOf("</script>");
        expect(
            scriptEnd,
            "no </script> found -- the markup scan would be vacuous",
        ).toBeGreaterThan(-1);
        const markup = src.slice(scriptEnd);
        expect(markup).not.toContain("selectedIndex");
    });
});

/**
 * The matcher's own test. Without this, `toHaveLength(2)` above is only as
 * strong as whichever forms the regex happens to recognise, and a write it
 * cannot see is exactly the silently dead cursor the file exists to prevent.
 */
describe("the ASSIGNMENT matcher", () => {
    const WRITES = [
        // Plain assignment, spaced and unspaced.
        "selectedIndex = 0",
        "selectedIndex=0",
        // Arithmetic / bitwise compound assignment.
        "selectedIndex += 1",
        "selectedIndex -= 1",
        "selectedIndex *= 2",
        "selectedIndex /= 2",
        "selectedIndex %= 3",
        "selectedIndex **= 2",
        "selectedIndex <<= 1",
        "selectedIndex >>= 1",
        "selectedIndex >>>= 1",
        "selectedIndex &= 1",
        "selectedIndex |= 1",
        "selectedIndex ^= 1",
        // Logical compound assignment -- the class that used to escape.
        "selectedIndex &&= 1",
        "selectedIndex ||= 1",
        "selectedIndex ??= 1",
        // Increment / decrement, both fixities. `selectedIndex++` inside a key
        // handler is the likeliest shape a future edit takes.
        "selectedIndex++",
        "selectedIndex--",
        "selectedIndex ++",
        "++selectedIndex",
        "--selectedIndex",
        // Destructuring targets. Whether the Svelte compiler even accepts a
        // destructuring assignment into a `$state` variable is not something
        // this guard should have to know: it is defended either way, because
        // the cost of defending it is one regex branch and the cost of being
        // wrong about it is a permanently dead cursor nobody can see.
        "[selectedIndex] = [next]",
        "[selectedIndex, selectedKey] = [next, key]",
        "({ selectedIndex } = o)",
        "const { selectedIndex } = o",
        "({ x: selectedIndex } = o)",
    ];

    const NON_WRITES = [
        // Comparisons. `=>` is in here because a lone-parameter arrow would
        // otherwise read as an assignment.
        "selectedIndex === x",
        "selectedIndex == x",
        "selectedIndex !== x",
        "selectedIndex != x",
        "selectedIndex >= x",
        "selectedIndex <= x",
        "selectedIndex => x",
        // Reads and arithmetic that is not an assignment.
        "x = selectedIndex",
        "selectedIndex + 1",
        "anchoredActiveIndex(selectedIndex, selectedKey, activeKeys)",
        // Other identifiers that merely contain / extend the name.
        "activeSelectedIndex = 1",
        "_selectedIndex = 1",
        "selectedIndexes = []",
        // A property write on some object -- e.g. the real <select> DOM API.
        // It cannot be a write to the component's own `let`.
        "someSelectEl.selectedIndex = 0",
        // The backtick convention documented in the header is what keeps prose
        // out of the count.
        "// the cursor `selectedIndex` -- see moveCursor",
    ];

    it.each(WRITES)("counts %j as a write site", (form) => {
        expect(writeSites(form)).toHaveLength(1);
    });

    it.each(NON_WRITES)("does not count %j", (form) => {
        expect(writeSites(form)).toHaveLength(0);
    });
});
