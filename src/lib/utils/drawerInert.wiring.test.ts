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
 * `transform: translateX(<var>px)` — whatever that element's tag name and
 * whatever order its attributes are in — bound to that drawer's own derived and
 * no other; that the derived comes from a correctly-signed call; and, as a
 * complete set, that no other occurrence of `inert` or `aria-hidden` — valued
 * OR bare — appears anywhere in either file. So an attribute swapped between
 * the two right-hand drawers, hoisted off the translated element onto its
 * `fixed inset-0` ancestor or its sibling backdrop (either would kill the
 * edge-swipe-open gesture or the containment), or added to some fourth element,
 * all fail here.
 *
 * It still does NOT prove:
 *   - that `inert` actually removes the subtree from the tab order at runtime;
 *   - that the mobile branch is the one being rendered;
 *   - that the drawers behave correctly mid-drag.
 *
 * Three further escapes are KNOWN and deliberately left unasserted, because
 * each needs structural parsing this file should not grow — listed so nobody
 * mistakes silence for coverage:
 *   - `inert` moved onto an inner CHILD of a drawer rather than the drawer
 *     itself (the slice stops at the drawer's first child);
 *   - the imported `isOffCanvasClosed` shadowed by a local wrapper that inverts
 *     it (the call text would still read correctly);
 *   - a FOURTH drawer added with no binding at all (nothing here enumerates
 *     translated elements, only the three known ones).
 *
 * All of the above still need the live keyboard/gesture pass recorded in the
 * task report. A green run here means "nobody silently inverted, crossed or
 * added wiring on the three known drawers", nothing more.
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
 * A drawer's WHOLE OPENING TAG, sliced out of the file.
 *
 * Whole-file `toContain("inert={…}")` checks are positionally blind, and this
 * file is the worst possible place for that: `MessageArea.svelte` holds two
 * right-hand drawers that are both 280px wide with near-identical markup, so
 * swapping their bindings is the likeliest copy-paste error here — and it is a
 * lockout, not a cosmetic slip (with the member list open, `showRightPanel` is
 * false, so `rightPanelClosed` is true, so the member drawer would be inert
 * while open). A whole-file assertion passes happily through that swap.
 *
 * `landmark` — the element's `transform: translateX(<var>px)` — only IDENTIFIES
 * which drawer this tag belongs to; it ties the slice to the very element whose
 * translate polarity was verified. The slice itself runs from that element's
 * `<div` back-scanned from the landmark, through to `firstChild`, so it covers
 * the tag's attributes in ANY order. Slicing forward from the landmark instead
 * would go red on a legal, behaviour-free attribute reorder (moving `inert`
 * above `style`) — a false alarm that trains people to distrust the test.
 */
function drawerOpeningTag(
    src: string,
    landmark: string,
    firstChild: string,
): string {
    const text = normalize(src);
    const at = text.indexOf(landmark);
    // Not found means the markup moved. Fail loudly — a silent -1 would slice
    // from the end of the file and make every assertion below vacuous.
    expect(at, `landmark not found: ${landmark}`).toBeGreaterThan(-1);

    // Back-scan to the start of the tag holding the landmark. Scanning FORWARD
    // for ">" cannot work: the style attribute contains ">=" in the box-shadow
    // gate.
    //
    // Scan for a generic "<", never a hardcoded "<div". Pinning the tag name
    // was a real hole: switch a drawer to <aside> — a reasonable a11y
    // improvement for a navigation drawer — and the scan walks straight past it
    // onto the PREVIOUS element (the backdrop), widening the slice to span two
    // elements, so bindings hoisted onto the backdrop still look like they are
    // on the drawer. The drawer is then tabbable while closed, which is the
    // whole defect this file exists to prevent.
    const start = text.lastIndexOf("<", at);
    expect(start, `no tag opening before: ${landmark}`).toBeGreaterThan(-1);

    const between = text.slice(start, at);
    // Landed on a real tag, not on a "<" comparison operator inside an
    // expression.
    expect(
        between.slice(0, 40),
        `the "<" before "${landmark}" does not open a tag`,
    ).toMatch(/^<[a-zA-Z]/);
    // ...and that tag has not already closed before reaching the landmark,
    // which is what "the slice spans two elements" looks like.
    expect(
        between,
        `the tag before "${landmark}" closes before reaching it, so the slice would span two elements — found: ${between.slice(0, 80)}`,
    ).not.toContain(">");

    const end = text.indexOf(firstChild, at);
    expect(
        end,
        `first child not found after ${landmark}: ${firstChild}`,
    ).toBeGreaterThan(at);
    return text.slice(start, end);
}

/**
 * Every `inert={…}` binding in a file, so the expected set can be asserted
 * EXHAUSTIVELY rather than by presence.
 *
 * Presence-only checks are blind to a stray `inert` on a non-drawer element,
 * and that blindness is load-bearing here: the plan's own out-of-scope list
 * names "the app content behind an OPEN mobile drawer is not inert" as future
 * work, and implementing it means adding an `inert` to a non-drawer element in
 * exactly these two files. Get its polarity backwards — `inert={!leftDrawerClosed}`
 * on `<main>` — and the whole app is inert whenever the drawer is closed, i.e.
 * essentially always. A presence-only test waves that through.
 *
 * A legitimate future addition is SUPPOSED to fail this assertion. Updating the
 * expected set is the deliberate act that forces its author to state the new
 * binding's polarity out loud.
 */
function attributeOccurrences(
    src: string,
    name: "inert" | "aria-hidden",
): string[] {
    // Matches the attribute with a braced value, a quoted value, or NO value at
    // all. The bare form matters: `inert` on its own is valid HTML, is a
    // plausible debugging leftover, permanently locks the keyboard out of
    // whatever it lands on, and passes both Prettier and svelte-check. A
    // `name=\{…\}`-only pattern cannot see it, which made this assertion's
    // promise wider than what it actually checked.
    const re = new RegExp(
        `(?<![\\w-])${name}(?:=(?:\\{[^}]*\\}|"[^"]*"))?(?![\\w-])`,
        "g",
    );
    return (normalize(src).match(re) ?? []).sort();
}

function inertBindings(src: string): string[] {
    return attributeOccurrences(src, "inert");
}

/** Same exhaustive treatment for `aria-hidden`, which shadows `inert` here. */
function ariaHiddenBindings(src: string): string[] {
    return attributeOccurrences(src, "aria-hidden");
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

    // Link 3: nothing ELSE in these files is inert. The two tests above pin the
    // three drawers, but they say nothing about a fourth element — and the next
    // planned change in this area (inerting the app behind an OPEN drawer) adds
    // exactly that. An inverted one, e.g. `inert={!leftDrawerClosed}` on
    // `<main>`, locks the keyboard out of the entire app whenever the drawer is
    // closed. See inertBindings() for why this is asserted as a complete set.
    it("has no inert bindings beyond the three drawers", () => {
        expect(inertBindings(appShell())).toEqual(["inert={leftDrawerClosed}"]);
        expect(inertBindings(messageArea())).toEqual([
            "inert={memberDrawerClosed}",
            "inert={rightPanelClosed}",
        ]);
    });

    it("has no aria-hidden bindings beyond the three drawers", () => {
        expect(ariaHiddenBindings(appShell())).toEqual([
            'aria-hidden={leftDrawerClosed ? "true" : undefined}',
        ]);
        expect(ariaHiddenBindings(messageArea())).toEqual([
            'aria-hidden={memberDrawerClosed ? "true" : undefined}',
            'aria-hidden={rightPanelClosed ? "true" : undefined}',
        ]);
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
