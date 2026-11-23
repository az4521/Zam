import { beforeAll, describe, expect, it } from "vitest";
import type { CustomEmoji } from "$lib/matrix/client";
import { loadEmojiData, type EmojiEntry } from "$lib/data/emojis";
import {
    applyEmojiCandidate,
    findEmojiQuery,
    rankEmojiCandidates,
} from "./emojiAutocomplete";

const emote = (shortcode: string): CustomEmoji => ({
    shortcode,
    mxcUrl: `mxc://x/${shortcode}`,
    url: `https://x/${shortcode}`,
});

describe("emoji autocomplete", () => {
    let ALL: readonly EmojiEntry[] = [];
    beforeAll(async () => {
        ALL = (await loadEmojiData()).all;
    });

    it("finds the open :query at the caret", () => {
        expect(findEmojiQuery("hi :smi", 7)).toEqual({
            query: "smi",
            start: 3,
        });
        expect(findEmojiQuery(":smi rest", 4)).toEqual({
            query: "smi",
            start: 0,
        });
        expect(findEmojiQuery("hi :smi", 6)).toEqual({ query: "sm", start: 3 });
        expect(findEmojiQuery("hi :", 4)).toBeNull();
        expect(findEmojiQuery("hi :smile: ", 11)).toBeNull();
        expect(findEmojiQuery("no colon", 8)).toBeNull();
    });

    it("needs two characters before suggesting", () => {
        expect(rankEmojiCandidates("s", [], ALL)).toEqual([]);
        expect(rankEmojiCandidates("sm", [], ALL).length).toBeGreaterThan(0);
    });

    it("ranks an exact shortcode first and caps the list at 8", () => {
        const list = rankEmojiCandidates("tm", [], ALL);
        expect(list[0]).toMatchObject({ kind: "unicode", name: "tm" });
        expect(rankEmojiCandidates("a", [], ALL).length).toBe(0);
        expect(rankEmojiCandidates("an", [], ALL).length).toBe(8);
    });

    it("puts custom emotes first, at most 5", () => {
        const customs = [
            "smile1",
            "smile2",
            "smile3",
            "smile4",
            "smile5",
            "smile6",
        ].map(emote);
        const list = rankEmojiCandidates("smile", customs, ALL);
        expect(list.slice(0, 5).every((c) => c.kind === "custom")).toBe(true);
        expect(list.filter((c) => c.kind === "custom").length).toBe(5);
        expect(list.length).toBe(8);
    });

    it("splices a pick in with a trailing space", () => {
        const q = { query: "smi", start: 3 };
        expect(
            applyEmojiCandidate("hi :smi", q, {
                kind: "unicode",
                emoji: "😄",
                name: "smile",
            }),
        ).toEqual({ text: "hi 😄 ", caret: 3 + "😄".length + 1 });
        // The rest of the word after the caret goes; later text stays.
        expect(
            applyEmojiCandidate("hi :smixx there", q, {
                kind: "custom",
                shortcode: "blob",
                url: "",
            }),
        ).toEqual({ text: "hi :blob:  there", caret: 10 });
    });
});
