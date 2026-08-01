import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source-mirrors test for the ModalDialog ADOPTION WIRING.
 *
 * WHY THIS EXISTS
 * ---------------
 * `ModalDialog.test.ts` proves the shell's capabilities (it forwards non-Escape
 * keys to `onKeydown`) and `focusTrap.test.ts` proves `data-autofocus` wins the
 * initial focus. Nothing proved that the dialogs which NEED those capabilities
 * still ask for them. The gap was demonstrated: deleting `{onKeydown}` from
 * QuickActions' `<ModalDialog>` tag AND both search-field `data-autofocus`
 * attributes, all at once, left the entire suite green and `npm run check`
 * clean.
 *
 * Both losses are silent, and both are the kind of thing an attribute-shuffling
 * edit drops:
 *   - drop `onKeydown` and Enter simply stops creating the room/space/DM; the
 *     dialog still opens, still submits by mouse, nothing throws;
 *   - drop `data-autofocus` and the trap falls back to the first focusable in
 *     DOM order, so Ctrl+K → type-to-search puts the caret on the ✕ button and
 *     the user's keystrokes go nowhere.
 *
 * Neither is reachable by a rendering test: all four components here are wired
 * to the live matrix-js-sdk client (`QuickActions` and `RoomDirectory` call
 * into it at module scope), so this repo has no harness that can mount them.
 * Same situation, and therefore the same remedy, as
 * `src/lib/utils/drawerInert.wiring.test.ts` — read the file, assert the text.
 *
 * WHAT THIS CANNOT PROVE — be clear about it
 * ------------------------------------------
 * This is a *textual* guard. It proves the source still says what it said when
 * the behaviour was verified by hand. It does NOT prove that Enter reaches the
 * handler at runtime, that the nominated input is actually focusable, or that
 * the dialogs render at all.
 *
 * Deliberately left unasserted (so nobody mistakes silence for coverage):
 *   - the BODY of QuickActions' `onKeydown` (that it still keys off Enter).
 *     svelte-check already fails if the identifier disappears, and pinning the
 *     body text would go red on a param rename that changes nothing;
 *   - an `onKeydown` on the three adopters that intentionally have no Enter
 *     action of their own: AccountSwitcher, and SpaceSidebar's add-room and
 *     colour-picker dialogs (whose dismissal wiring IS asserted below);
 *   - that `data-autofocus` lands on an element the trap considers focusable —
 *     only that it lands on an `<input>`, which is the same claim in practice.
 */

// Resolve via dirname(fileURLToPath(...)), NOT `new URL("…", import.meta.url)`
// — Vite rewrites that literal pattern into an asset reference and
// fileURLToPath then throws "The URL must be of scheme file". Same landmine
// documented in drawerInert.wiring.test.ts and themeParity.test.ts.
const COMPONENTS = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Drops whole-line `//` comments AND every `<!-- … -->` block.
 *
 * This is NOT cosmetic. These components document their own wiring in prose —
 * SpaceSidebar's colour picker literally carries a comment reading "Nominated
 * as the trap's initial focus" right above the attribute this file counts. A
 * source-mirrors test that can read a component's documentation back to itself
 * as evidence is theatre: delete the attribute, write a comment naming it, stay
 * green. The drawer wiring test was caught doing exactly that before the strip
 * was added, so the same guard is applied here up front — widened to HTML
 * comments because in `.svelte` markup that is the form prose actually takes.
 *
 * Only whole-line `//` comments are removed, so a `//` inside a string literal
 * (a URL, say) is never touched.
 */
function stripComments(src: string): string {
    return src
        .replace(/<!--[\s\S]*?-->/g, "")
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
}

/**
 * Reads a component, proves it actually loaded, and hands back only its code.
 * Without the load guard a moved or emptied file would make the "exactly one
 * `data-autofocus`" counts below fail for the wrong reason and the tag lookups
 * pass vacuously — a source-mirrors test that goes green against a file it
 * failed to read is worse than no test at all.
 */
function readComponent(relative: string): string {
    const src = readFileSync(resolve(COMPONENTS, relative), "utf8");
    expect(src.length, `${relative} looks truncated`).toBeGreaterThan(1000);
    expect(src, `${relative} no longer uses ModalDialog`).toContain(
        "ModalDialog",
    );
    return stripComments(src);
}

/**
 * Collapses whitespace so every assertion survives a Prettier reflow — these
 * tags are all multi-line today, and adding one attribute rewraps the rest.
 */
function normalize(src: string): string {
    return src.replace(/\s+/g, " ");
}

/**
 * Index just past the `>` that closes the tag opening at `start`.
 *
 * A naive `indexOf(">")` cannot work here and the reason is the whole point of
 * this file: the two attributes under test are Svelte expressions containing
 * `>` — `onKeydown={(e) => …}` on SpaceSidebar's create-room dialog, and
 * `oninput={(e) => …}` sitting beside `data-autofocus` on the colour picker's
 * hex field. A naive scan truncates those tags mid-attribute, which quietly
 * shrinks the slice the assertions run against.
 *
 * So: track quotes (at any depth, so an apostrophe inside "What's this room
 * about?" is inert) and brace depth, and only accept a `>` at depth 0 outside a
 * string. That makes every assertion below completely indifferent to attribute
 * ORDER, which matters — a test that reddens on a legal, behaviour-free
 * reshuffle teaches people to distrust it and edit around it.
 */
function tagEnd(text: string, start: number): number {
    let depth = 0;
    let quote: string | null = null;
    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (quote !== null) {
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        else if (ch === ">" && depth === 0) return i + 1;
    }
    return -1;
}

/**
 * The complete opening tag that carries the attribute at index `at`.
 *
 * Whole-file `toContain("data-autofocus")` checks are positionally blind, and
 * that blindness is the specific hazard here: RoomDirectory's dialog holds TWO
 * adjacent text inputs (the room search and the optional server override), so
 * the likeliest slip is not deletion but drift onto the wrong one — which reads
 * identically in a whole-file check and lands the user's first keystroke in the
 * server box.
 */
function enclosingTag(text: string, at: number, label: string): string {
    const start = text.lastIndexOf("<", at);
    expect(start, `no tag opening before ${label}`).toBeGreaterThan(-1);
    // Landed on a real tag, not on a "<" comparison operator inside some
    // preceding expression.
    expect(
        text.slice(start, start + 40),
        `the "<" before ${label} does not open a tag`,
    ).toMatch(/^<[a-zA-Z]/);
    const end = tagEnd(text, start);
    expect(
        end,
        `the tag before ${label} closes before reaching it, so the slice would span two elements`,
    ).toBeGreaterThan(at);
    return text.slice(start, end);
}

/**
 * The `<ModalDialog>` opening tag identified by one of its attributes.
 *
 * `marker` (the dialog's `labelledBy` or `label`, which is also its accessible
 * name) only IDENTIFIES which of the seven ModalDialog call sites this is —
 * QuickActions, RoomDirectory, AccountSwitcher, ForwardMessageDialog and
 * SpaceSidebar's three; asserting the enclosing tag is really `<ModalDialog` is
 * what pins the capability to the SHELL rather than to some inner wrapper that
 * would never forward it.
 *
 * A -1 from `indexOf` would silently slice from the end of the file and make
 * every assertion downstream vacuous, so a missing marker fails loudly.
 */
function modalDialogTag(src: string, marker: string): string {
    const text = normalize(src);
    const at = text.indexOf(marker);
    expect(at, `ModalDialog marker not found: ${marker}`).toBeGreaterThan(-1);
    const tag = enclosingTag(text, at, marker);
    expect(
        tag,
        `${marker} is no longer on a <ModalDialog> tag — found: ${tag.slice(0, 60)}`,
    ).toMatch(/^<ModalDialog[\s>]/);
    return tag;
}

/**
 * A braced attribute's expression, brace-balanced so an arrow-function body
 * survives intact. Asserting on the VALUE rather than on the whole tag keeps
 * the claim honest: "this dialog's key handler calls submitCreateRoom" is a
 * different, weaker statement when the substring may have come from a
 * neighbouring attribute.
 */
function attributeExpression(tag: string, name: string): string {
    const re = new RegExp(`(?<![\\w-])${name}=\\{`);
    const match = re.exec(tag);
    expect(match, `no ${name}={…} on: ${tag.slice(0, 80)}`).not.toBeNull();
    const open = match!.index + match![0].length - 1;
    let depth = 0;
    for (let i = open; i < tag.length; i++) {
        if (tag[i] === "{") depth++;
        else if (tag[i] === "}" && --depth === 0) return tag.slice(open + 1, i);
    }
    throw new Error(`unbalanced ${name}={…} on: ${tag.slice(0, 80)}`);
}

/** Every opening tag in a file that carries `data-autofocus`. */
function autofocusTags(src: string): string[] {
    const text = normalize(src);
    // `(?<![\w-])` / `(?![\w-])` so a future `data-autofocus-delay` or the like
    // is not miscounted as the real thing.
    const re = /(?<![\w-])data-autofocus(?![\w-])/g;
    const tags: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
        tags.push(enclosingTag(text, match.index, "data-autofocus"));
    }
    return tags;
}

const quickActions = () => readComponent("layout/QuickActions.svelte");
const spaceSidebar = () => readComponent("layout/SpaceSidebar.svelte");
const roomDirectory = () => readComponent("layout/RoomDirectory.svelte");
const forwardDialog = () =>
    readComponent("messages/ForwardMessageDialog.svelte");

describe("ModalDialog adoption — Enter handlers reach the shell", () => {
    // QuickActions is the Ctrl+K create-room / create-space / join-room dialog.
    // Its `onKeydown` is the ONLY thing that makes Enter submit; the buttons
    // are plain <button onclick>, not a <form>, so there is no native submit
    // to fall back on.
    //
    // Matches the shorthand `{onKeydown}` or the equivalent longhand, because
    // expanding one into the other changes nothing at runtime and should not
    // redden a test.
    it("QuickActions still forwards its onKeydown to ModalDialog", () => {
        const tag = modalDialogTag(
            quickActions(),
            'labelledBy="quick-actions-title"',
        );
        expect(
            tag,
            "QuickActions' <ModalDialog> no longer receives onKeydown — Enter silently stops submitting the dialog",
        ).toMatch(
            /(?:^|\s)(?:\{onKeydown\}|onKeydown=\{onKeydown\})(?=\s|\/?>)/,
        );
    });

    // SpaceSidebar's create-room dialog passes an inline handler instead of a
    // named function, so it has a second way to rot: the arrow can survive
    // while its body stops calling submitCreateRoom.
    //
    // Asserted as "mentions Enter" + "calls submitCreateRoom" rather than as
    // the exact source text, so renaming the event param or reflowing the body
    // stays green while gutting it does not.
    it("SpaceSidebar's create-room dialog still submits on Enter", () => {
        const tag = modalDialogTag(
            spaceSidebar(),
            'labelledBy="space-create-room-title"',
        );
        const handler = attributeExpression(tag, "onKeydown");
        expect(
            handler,
            "the create-room dialog's onKeydown no longer keys off Enter",
        ).toContain('"Enter"');
        expect(
            handler,
            "the create-room dialog's onKeydown no longer calls submitCreateRoom",
        ).toContain("submitCreateRoom(");
    });
});

describe("ModalDialog adoption — initial focus nomination", () => {
    // Counted, not merely detected. "Exactly one" is the real claim: the trap
    // takes the FIRST focusable carrying `data-autofocus`, so a second one
    // added elsewhere in the same dialog does not error — it just quietly wins
    // or loses on DOM order. Presence-only checks wave that through.
    it("RoomDirectory nominates exactly its room-search field", () => {
        const tags = autofocusTags(roomDirectory());
        expect(
            tags,
            "RoomDirectory must nominate exactly one initial field",
        ).toHaveLength(1);
        expect(tags[0]).toMatch(/^<input[\s/>]/);
        // Anchored to the search box specifically: its neighbour is the
        // optional server-override input, and drifting onto that one is
        // invisible to any whole-file check.
        expect(
            tags[0],
            "RoomDirectory's data-autofocus drifted off the room-search input",
        ).toContain("bind:value={searchInput}");
    });

    it("ForwardMessageDialog nominates exactly its room-search field", () => {
        const tags = autofocusTags(forwardDialog());
        expect(
            tags,
            "ForwardMessageDialog must nominate exactly one initial field",
        ).toHaveLength(1);
        expect(tags[0]).toMatch(/^<input[\s/>]/);
        expect(
            tags[0],
            "ForwardMessageDialog's data-autofocus drifted off the search input",
        ).toContain("bind:value={query}");
    });

    // Two, and only two: the create-room name field, and the colour picker's
    // hex field. The hex one is load-bearing in an unobvious way — the first
    // focusable in that dialog is an unnamed preset swatch whose inline
    // `outline: none` leaves a keyboard user with no visible focus at all, so
    // losing the nomination looks like the dialog opened with focus nowhere.
    it("SpaceSidebar nominates exactly its two initial fields", () => {
        const tags = autofocusTags(spaceSidebar());
        expect(
            tags,
            "SpaceSidebar must nominate exactly two initial fields (create-room name, colour hex)",
        ).toHaveLength(2);
        for (const tag of tags) expect(tag).toMatch(/^<input[\s/>]/);
        expect(
            tags.filter((tag) => tag.includes('id="create-room-name"')),
            "the create-room dialog no longer nominates its name field",
        ).toHaveLength(1);
        expect(
            tags.filter((tag) => tag.includes("value={cpHex}")),
            "the colour picker no longer nominates its hex field",
        ).toHaveLength(1);
    });
});

/**
 * SpaceSidebar's three ModalDialog call sites must hand the shell a REAL
 * dismiss callback.
 *
 * WHY: `onClose` is not one dismissal path among several, it is BOTH of them.
 * The shell's backdrop is `<button onclick={onClose}>`, and the focus trap is
 * given `{ onEscape: onClose }` — so a no-op `onClose` does not degrade a
 * dialog, it makes it UNDISMISSABLE: outside click dead, Escape dead, and the
 * trap is still holding focus inside a panel the user cannot leave. None of
 * these three carries a ✕ of its own to fall back on. It is also silent in
 * every other check: the dialog opens, renders and (for create-room/add-room)
 * still submits, so nothing throws and `npm run check` stays clean.
 *
 * Demonstrated, not assumed: rewriting the add-room dialog's
 * `onClose={closeModal}` to `onClose={() => {}}` left this entire suite green
 * before these three assertions existed.
 *
 * Asserted as "the expression mentions closeModal" rather than as exact source
 * text, so wrapping it (`() => closeModal()`) stays green while gutting it does
 * not.
 */
describe("ModalDialog adoption — the dialogs stay dismissable", () => {
    // Marker per dialog: the colour picker has no visible heading to point at,
    // so it names itself with `label` where the other two use `labelledBy`.
    const DIALOGS: Array<[string, string]> = [
        ["the colour picker", 'label="Folder Color"'],
        ["the create-room dialog", 'labelledBy="space-create-room-title"'],
        ["the add-room dialog", 'labelledBy="space-add-room-title"'],
    ];

    for (const [label, marker] of DIALOGS) {
        it(`${label} still closes through closeModal`, () => {
            const tag = modalDialogTag(spaceSidebar(), marker);
            expect(
                attributeExpression(tag, "onClose"),
                `${label} no longer dismisses through closeModal — backdrop click AND Escape are both dead, so the dialog cannot be closed at all`,
            ).toContain("closeModal");
        });
    }
});

/**
 * The four dialogs SpaceSidebar renders must sit inside its `<Portal>`, not
 * inside its `<nav>`.
 *
 * WHY: on mobile the sidebar lives in AppShell's drawer, which always carries
 * an inline `transform: translateX(…)` — even at 0px. A transform makes that
 * element the containing block for `position: fixed` descendants, so
 * ModalDialog's `fixed inset-0` layer and backdrop cover the 312px drawer
 * instead of the viewport: a tap to the right of the drawer hits the DRAWER's
 * backdrop and dismisses the drawer, while the dialog goes on claiming
 * `aria-modal="true"` over a screen it does not actually cover.
 *
 * Textual, like the rest of this file, and for the same reason: SpaceSidebar
 * calls into the live matrix-js-sdk client at module scope, so nothing in this
 * repo can mount it. `Portal.test.ts` proves what a `<Portal>` DOES; this
 * proves these four still ask for one.
 */
describe("SpaceSidebar dialogs are portaled out of the drawer", () => {
    const OPEN = "<Portal>";
    const CLOSE = "</Portal>";

    /**
     * Every `<Portal>` … `</Portal>` region in the file, in source order.
     *
     * This used to anchor on `lastIndexOf("<Portal>")` and that was wrong in
     * BOTH directions, confirmed by mutating the file:
     *   - a second Portal NESTED around the four dialogs left all four green,
     *     because `lastIndexOf` simply retargeted onto the inner one;
     *   - a second Portal appended as a SIBLING after the existing one turned
     *     all four red, because `lastIndexOf` retargeted onto the new, empty
     *     one — even though the dialogs were still correctly portaled.
     *
     * The second is the one that would actually bite: a sibling Portal is a
     * perfectly legitimate future edit (portaling the touch-drag ghost is an
     * open follow-up), and a suite that goes red on a correct change is a suite
     * people learn to edit around. So the regions are enumerated and the claim
     * becomes "the marker is inside SOME Portal", which is the real behavioural
     * requirement — any Portal re-parents to `<body>` and therefore out of the
     * drawer's transform. Nesting is caught separately, by name, below.
     *
     * `</Portal>` cannot be mistaken for an opening tag (`</P` ≠ `<P`), and
     * `readComponent` has already stripped the comments that talk about it.
     */
    function portalRegions(src: string): string[] {
        const text = normalize(src);
        const regions: string[] = [];
        for (let open = text.indexOf(OPEN); open !== -1; ) {
            const close = text.indexOf(CLOSE, open);
            expect(close, "unclosed <Portal> in SpaceSidebar").toBeGreaterThan(
                open,
            );
            regions.push(text.slice(open, close));
            open = text.indexOf(OPEN, close + CLOSE.length);
        }
        expect(
            regions.length,
            "SpaceSidebar no longer renders a <Portal>",
        ).toBeGreaterThan(0);
        return regions;
    }

    // The hole the enumeration above deliberately leaves open, closed here
    // instead — and closed more precisely than "the file contains exactly one
    // Portal" would, which would have reddened on the legitimate sibling case.
    //
    // Nesting is never intended: `Portal` appends its OWN wrapper <div> to
    // document.body, so a nested pair strands two wrappers there, one of them
    // empty, and nothing throws — the dialogs are still out of the drawer, so
    // no other assertion in this file or in Portal.test.ts would notice.
    it("never nests one <Portal> inside another", () => {
        const tokens = Array.from(
            normalize(spaceSidebar()).matchAll(/<\/?Portal>/g),
        );
        expect(
            tokens.length,
            "SpaceSidebar no longer renders a <Portal>",
        ).toBeGreaterThan(0);
        let depth = 0;
        for (const token of tokens) {
            if (token[0] === OPEN) {
                depth++;
                expect(
                    depth,
                    "SpaceSidebar nests a <Portal> inside another <Portal> — that strands an extra wrapper <div> on <body> and makes the region checks below ambiguous",
                ).toBeLessThanOrEqual(1);
            } else {
                depth--;
                expect(
                    depth,
                    "SpaceSidebar closes a </Portal> it never opened",
                ).toBeGreaterThanOrEqual(0);
            }
        }
        expect(depth, "unclosed <Portal> in SpaceSidebar").toBe(0);
    });

    const MARKERS: Array<[string, string]> = [
        ["the colour picker", "{#if colorPicker}"],
        ["the create-room dialog", "{#if createRoomModal}"],
        ["the add-room dialog", "{#if addRoomModal}"],
        ["the room directory", "{#if exploreOpen}"],
    ];

    for (const [label, marker] of MARKERS) {
        it(`${label} renders inside the Portal`, () => {
            const src = spaceSidebar();
            const text = normalize(src);
            // Guard against a vacuous pass: the marker must exist exactly once,
            // or "found in the portal region" could be true of a copy while the
            // real one stayed in the nav.
            const occurrences = text.split(marker).length - 1;
            expect(occurrences, `${marker} should appear exactly once`).toBe(1);
            // Exactly one region, not "at least one": the marker occurs once
            // and the regions are disjoint by construction, so 1 means inside a
            // Portal and 0 means outside every one of them.
            expect(
                portalRegions(src).filter((region) => region.includes(marker))
                    .length,
                `${label} is outside SpaceSidebar's <Portal> — inside the <nav> its fixed layer is clipped to the mobile drawer and aria-modal lies`,
            ).toBe(1);
        });
    }
});
