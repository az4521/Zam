import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source-mirrors test for the `isOffCanvasClosed` WIRING (audit A11Y-02).
 *
 * WHY THIS READS SOURCE TEXT INSTEAD OF RENDERING ANYTHING
 * -------------------------------------------------------
 * `drawerInert.test.ts` proves the predicate. Nothing proves the three call
 * sites pass it the right arguments, and that gap is dangerous in a specific
 * way: the left drawer parks at a NEGATIVE offset (`-DRAWER_WIDTH`) while the
 * two right-hand drawers park at POSITIVE ones (`+PINNED_WIDTH` /
 * `+MEMBER_WIDTH`). Flip one sign and the drawer becomes `inert` while it is
 * OPEN — a total keyboard lockout. That mutation type-checks, builds, and
 * passes every other test in the suite, because:
 *
 *   - `inert={boolean}` is valid either way, so svelte-check cannot see it;
 *   - the three drawers only exist inside `{#if isMobile}` / `{:else}`
 *     branches, and this repo has no harness that mounts `AppShell.svelte` or
 *     `MessageArea.svelte` (both are ~1.4k/1.8k-line components wired to the
 *     live matrix-js-sdk client), so no rendering test can reach them;
 *   - the failure is silent — nothing throws, nothing looks wrong, the drawer
 *     simply stops accepting focus.
 *
 * So the invariant is pinned the same way this repo already pins hand-copied
 * constants elsewhere: read the file, assert the text.
 *
 * WHAT THIS CANNOT PROVE — be clear about it
 * ------------------------------------------
 * This is a *textual* guard, not a behavioural one. It proves the source still
 * says what it said when the polarity was verified by hand.
 *
 * It DOES pin, per element: that each drawer's `inert`/`aria-hidden` sits in
 * the opening tag of the element carrying that drawer's own
 * `transform: translateX(<var>px)`, bound to that drawer's own derived and no
 * other; and that the derived comes from a correctly-signed call. So an
 * attribute swapped between the two right-hand drawers, or hoisted off the
 * translated element onto its `fixed inset-0` ancestor (which would kill the
 * edge-swipe-open gesture), now fails here.
 *
 * It still does NOT prove:
 *   - that `inert` actually removes the subtree from the tab order at runtime;
 *   - that the mobile branch is the one being rendered;
 *   - that the drawers behave correctly mid-drag;
 *   - that no OTHER element in these files wrongly gained an `inert` — the
 *     per-element assertions are scoped to the three known drawers.
 * Those still need the live keyboard/gesture pass recorded in the task report.
 * A green run here means "nobody silently inverted or crossed the wiring".
 */

// Resolve via dirname(fileURLToPath(...)), NOT `new URL("…", import.meta.url)`
// — Vite rewrites that literal pattern into an asset reference and
// fileURLToPath then throws "The URL must be of scheme file". Same landmine
// documented in themeParity.test.ts.
const COMPONENTS = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../components/layout",
);

/**
 * Drops whole-line `//` comments.
 *
 * This is NOT cosmetic. The components explain the polarity in prose, and those
 * comments quote the very expressions asserted below — e.g. AppShell says
 * "Same notion as the box-shadow gate below it (`drawerTranslate <=
 * -DRAWER_WIDTH`)". Without this strip, the box-shadow assertions matched the
 * COMMENT and stayed green while the real comparison was mutated from `<=` to
 * `<`. Caught by mutation-checking; a source-mirrors test that reads its own
 * documentation back to itself is pure theatre.
 *
 * Only whole-line comments are removed, so a `//` inside a string literal (a
 * URL, say) is never touched.
 */
function stripComments(src: string): string {
    return src
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
}

/**
 * Reads a component, proves it actually loaded, and hands back only its code.
 * Without the load guard an empty or moved file would make every
 * `not.toContain` assertion below pass — a source-mirrors test that goes green
 * against a file it failed to read is worse than no test at all.
 */
function readComponent(name: string): string {
    const src = readFileSync(resolve(COMPONENTS, name), "utf8");
    expect(src.length).toBeGreaterThan(1000);
    expect(src).toContain("isOffCanvasClosed");
    return stripComments(src);
}

/**
 * Collapses whitespace so the assertions survive a Prettier reflow — the call
 * currently fits on one line, but renaming a variable could wrap it.
 */
function normalize(src: string): string {
    return src.replace(/\s+/g, " ");
}

/**
 * Every `isOffCanvasClosed(a, b)` call in the file, as [translate, closed]
 * pairs. Extracting them ALL and asserting the complete set matters: a
 * substring check for the correct call still passes when someone adds a second,
 * wrongly-signed one next to it.
 */
function closedCalls(src: string): string[] {
    const pairs: string[] = [];
    const re = /isOffCanvasClosed\(\s*([^,()\s]+)\s*,\s*([^,()\s]+)\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(normalize(src))) !== null) {
        pairs.push(`${match[1]}, ${match[2]}`);
    }
    return pairs.sort();
}

/**
 * The remainder of a drawer's OPENING TAG, sliced out of the file.
 *
 * Whole-file `toContain("inert={…}")` checks are positionally blind, and this
 * file is the worst possible place for that: `MessageArea.svelte` holds two
 * right-hand drawers that are both 280px wide with near-identical markup, so
 * swapping their bindings is the likeliest copy-paste error here — and it is a
 * lockout, not a cosmetic slip (with the member list open, `showRightPanel` is
 * false, so `rightPanelClosed` is true, so the member drawer would be inert
 * while open). A whole-file assertion passes happily through that swap.
 *
 * `landmark` is the element's `transform: translateX(<var>px)` — i.e. the slice
 * is anchored to the very element whose translate polarity was verified, which
 * is what makes "the attribute is on the right element" a real claim rather
 * than "the attribute is somewhere in the file". `firstChild` terminates the
 * slice at the drawer's first child, so it covers exactly the rest of that
 * element's attributes and nothing below it.
 */
function drawerOpeningTag(
    src: string,
    landmark: string,
    firstChild: string,
): string {
    const text = normalize(src);
    const start = text.indexOf(landmark);
    // Not found means the markup moved. Fail loudly — a silent -1 would slice
    // from the end of the file and make every assertion below vacuous.
    expect(start, `landmark not found: ${landmark}`).toBeGreaterThan(-1);
    const end = text.indexOf(firstChild, start);
    expect(
        end,
        `first child not found after ${landmark}: ${firstChild}`,
    ).toBeGreaterThan(start);
    return text.slice(start, end);
}

/** Every drawer derived in the codebase, so each block can exclude the others. */
const DRAWER_DERIVEDS = [
    "leftDrawerClosed",
    "rightPanelClosed",
    "memberDrawerClosed",
];

const appShell = () => readComponent("AppShell.svelte");
const messageArea = () => readComponent("MessageArea.svelte");

const leftDrawerTag = () =>
    drawerOpeningTag(
        appShell(),
        "transform: translateX({drawerTranslate}px)",
        "<SpaceSidebar",
    );
const rightPanelTag = () =>
    drawerOpeningTag(
        messageArea(),
        "transform: translateX({pinnedTranslate}px)",
        "{#if showNotificationsPanel}",
    );
const memberDrawerTag = () =>
    drawerOpeningTag(
        messageArea(),
        "transform: translateX({memberTranslate}px)",
        "<MemberList",
    );

/**
 * Asserts a drawer element carries its OWN derived on both `inert` and
 * `aria-hidden`, and carries no other drawer's derived.
 */
function expectBoundTo(tag: string, own: string) {
    expect(tag).toContain(`inert={${own}}`);
    expect(tag).toContain(`aria-hidden={${own} ? "true" : undefined}`);
    for (const other of DRAWER_DERIVEDS.filter((name) => name !== own)) {
        expect(tag).not.toContain(other);
    }
}

describe("drawer inert wiring — polarity", () => {
    // The left drawer opens at 0 and closes at -DRAWER_WIDTH, so the closed
    // offset it is compared against MUST carry the minus sign.
    it("pairs the left drawer with a NEGATIVE closed offset, and nothing else", () => {
        expect(closedCalls(appShell())).toEqual([
            "drawerTranslate, -DRAWER_WIDTH",
        ]);
    });

    it("never compares the left drawer against a positive DRAWER_WIDTH", () => {
        // `-DRAWER_WIDTH` does not contain the substring ", DRAWER_WIDTH)", so
        // this fires only on a genuinely dropped sign.
        expect(normalize(appShell())).not.toContain(
            "isOffCanvasClosed(drawerTranslate, DRAWER_WIDTH)",
        );
    });

    // Both right-hand drawers open at 0 and close at +WIDTH — no minus sign.
    it("pairs both right-hand drawers with POSITIVE closed offsets, and nothing else", () => {
        expect(closedCalls(messageArea())).toEqual([
            "memberTranslate, MEMBER_WIDTH",
            "pinnedTranslate, PINNED_WIDTH",
        ]);
    });

    it("never compares a right-hand drawer against a negated width", () => {
        const src = normalize(messageArea());
        expect(src).not.toContain(
            "isOffCanvasClosed(pinnedTranslate, -PINNED_WIDTH)",
        );
        expect(src).not.toContain(
            "isOffCanvasClosed(memberTranslate, -MEMBER_WIDTH)",
        );
    });

    // Link 1 of 2: derived NAME ↔ correctly-signed call. Without this someone
    // could keep the names and re-sign the call underneath them.
    it("declares each derived from its own correctly-signed call", () => {
        expect(normalize(appShell())).toContain(
            "const leftDrawerClosed = $derived( isOffCanvasClosed(drawerTranslate, -DRAWER_WIDTH), );",
        );
        const area = normalize(messageArea());
        expect(area).toContain(
            "const rightPanelClosed = $derived( isOffCanvasClosed(pinnedTranslate, PINNED_WIDTH), );",
        );
        expect(area).toContain(
            "const memberDrawerClosed = $derived( isOffCanvasClosed(memberTranslate, MEMBER_WIDTH), );",
        );
    });

    // Link 2 of 2: ELEMENT ↔ derived name. Together with link 1 this chains
    // element → name → sign, which is the property that actually matters.
    //
    // Asserted per element, not per file. The two right-hand drawers are
    // interchangeable-looking 280px blocks; swapping their bindings puts the
    // member list inert while it is OPEN, and a whole-file assertion sails
    // straight past that. The left drawer gets the same treatment even though
    // AppShell has only one drawer today — a second one added later is exactly
    // how this gap would reopen.
    it("puts each drawer's inert and aria-hidden on its own element", () => {
        expectBoundTo(leftDrawerTag(), "leftDrawerClosed");
        expectBoundTo(rightPanelTag(), "rightPanelClosed");
        expectBoundTo(memberDrawerTag(), "memberDrawerClosed");
    });
});

describe("drawer inert wiring — agreement with the box-shadow gates", () => {
    // Each drawer ALREADY computed "fully closed" inline to drop its
    // box-shadow, and those expressions were deliberately left in place rather
    // than refactored into the new deriveds. That only stays safe while the two
    // notions of "closed" agree; if someone later changes one comparison and
    // not the other, the drawer's shadow and its keyboard reachability start
    // disagreeing about when it is off screen. These assertions are what makes
    // leaving the duplication defensible.
    // The `{… ? '' : 'box-shadow:` tail anchors these to the real style
    // expression. Asserting the bare comparison is not enough — see
    // stripComments() above for how that let a mutation slip through.
    it("keeps the left drawer's inline gate identical to the predicate's branch", () => {
        expect(normalize(appShell())).toContain(
            "{drawerTranslate <= -DRAWER_WIDTH ? '' : 'box-shadow:",
        );
    });

    it("keeps both right-hand inline gates identical to the predicate's branch", () => {
        const src = normalize(messageArea());
        expect(src).toContain(
            "{pinnedTranslate >= PINNED_WIDTH ? '' : 'box-shadow:",
        );
        expect(src).toContain(
            "{memberTranslate >= MEMBER_WIDTH ? '' : 'box-shadow:",
        );
    });
});

describe("drawer inert wiring — aria-hidden polarity", () => {
    // `aria-hidden="false"` is not the same as omitting the attribute: it
    // explicitly forces the subtree back into the accessibility tree and, on
    // some AT, overrides the `inert` state we just set. The correct idiom is
    // `cond ? "true" : undefined`, which Svelte renders as no attribute at all.
    it("never renders aria-hidden as the string false", () => {
        for (const src of [appShell(), messageArea()]) {
            const values = normalize(src).match(/aria-hidden=\{[^}]*\}/g) ?? [];
            expect(values.length).toBeGreaterThan(0);
            for (const value of values) {
                expect(value).not.toContain('"false"');
                expect(value).toContain("undefined");
            }
        }
    });
});

describe("drawer inert wiring — closed-offset constants", () => {
    // The polarity above was hand-verified against these exact numbers, and the
    // task report's open/closed table quotes them. Pin them so that table
    // cannot silently go stale, and so a width change is a deliberate act that
    // re-opens the polarity question rather than a drive-by edit.
    it("still declares DRAWER_WIDTH as 312", () => {
        expect(appShell()).toContain("const DRAWER_WIDTH = 312;");
    });

    it("still declares PINNED_WIDTH and MEMBER_WIDTH as 280", () => {
        const src = messageArea();
        expect(src).toContain("const PINNED_WIDTH = 280;");
        expect(src).toContain("const MEMBER_WIDTH = 280;");
    });
});
