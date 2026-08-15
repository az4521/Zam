import { describe, it, expect } from "vitest";
import { insertMention } from "./mentionInsert";

// The composer commits a mention by splicing "@label " over the "@query" the
// user was typing. These cases pin the string maths: the remainder of the
// partly-typed word is consumed, and exactly ONE space separates the pill from
// whatever text follows it — never two.
describe("insertMention", () => {
    it("inserts the pill and a trailing space when nothing follows", () => {
        // "@bo" with the caret at the end → "@bob ".
        expect(
            insertMention({
                text: "@bo",
                mentionStart: 0,
                queryLength: 2,
                label: "bob",
            }),
        ).toEqual({ text: "@bob ", caret: 5 });
    });

    it("consumes the rest of a partly-typed name after the caret", () => {
        // Caret sits after "bo" inside "@bobby"; the "bby" tail is the same word
        // and must be replaced, not left dangling.
        expect(
            insertMention({
                text: "@bobby",
                mentionStart: 0,
                queryLength: 2,
                label: "bob",
            }),
        ).toEqual({ text: "@bob ", caret: 5 });
    });

    it("does NOT double the space when text already follows the mention", () => {
        // Editing "@al are you there" and picking "alice": the " are you there"
        // after the caret already starts with a space, so the pill must reuse it
        // rather than add a second — "@alice are…", not "@alice  are…".
        expect(
            insertMention({
                text: "@al are you there",
                mentionStart: 0,
                queryLength: 2,
                label: "alice",
            }),
        ).toEqual({ text: "@alice are you there", caret: 7 });
    });

    it("does not double the space when a partial name is followed by more text", () => {
        // "@alic here" with the caret after "alic": consume "e" AND reuse the
        // existing space before "here".
        expect(
            insertMention({
                text: "@alice here",
                mentionStart: 0,
                queryLength: 4,
                label: "alice",
            }),
        ).toEqual({ text: "@alice here", caret: 7 });
    });

    it("preserves the text before the mention", () => {
        expect(
            insertMention({
                text: "hey @bo",
                mentionStart: 4,
                queryLength: 2,
                label: "bob",
            }),
        ).toEqual({ text: "hey @bob ", caret: 9 });
    });

    it("does not force a space when a newline follows the mention", () => {
        // At the end of a line, the pill should butt against the break, not
        // leave a trailing space before it.
        expect(
            insertMention({
                text: "@al\nmore",
                mentionStart: 0,
                queryLength: 2,
                label: "alice",
            }),
        ).toEqual({ text: "@alice\nmore", caret: 7 });
    });

    it("leaves whitespace the user typed intact and adds none of its own", () => {
        // "@bo  world" (the user typed two spaces): the insert must not add a
        // third, but it also must not "tidy" the user's own spacing away.
        expect(
            insertMention({
                text: "@bo  world",
                mentionStart: 0,
                queryLength: 2,
                label: "bob",
            }),
        ).toEqual({ text: "@bob  world", caret: 5 });
    });
});
