import { describe, expect, it } from "vitest";
import { decorateComposerText } from "./composerDecorate";

const emojiSrc = (code: string) =>
    code === "blob" ? "https://x/blob.png" : null;

describe("decorateComposerText", () => {
    it("shows a custom emote's image and keeps its token text", () => {
        expect(decorateComposerText("hi :blob: :nope:", { emojiSrc })).toBe(
            'hi <span class="composer-custom-emoji"><img src="https://x/blob.png" alt="" draggable="false" contenteditable="false" />:blob:</span> :nope:',
        );
    });

    it("escapes text and keeps markdown markers", () => {
        expect(decorateComposerText("<b> **x**", { emojiSrc })).toBe(
            "&lt;b&gt; <strong>**x**</strong>",
        );
    });

    it("doesn't take *emote* for a :shortcode:", () => {
        expect(decorateComposerText("*blob*", { emojiSrc })).toBe(
            "<em>*blob*</em>",
        );
    });

    it("highlights mentions only when asked", () => {
        expect(decorateComposerText("@al", { emojiSrc })).toBe("@al");
        expect(
            decorateComposerText("@al", { emojiSrc, isMention: () => true }),
        ).toBe('<span class="composer-mention">@al</span>');
    });

    it("keeps a trailing newline visible", () => {
        expect(decorateComposerText("a\nb\n", { emojiSrc })).toBe(
            "a<br>b<br><br>",
        );
    });

    // These used to rely on a regex lookbehind (Safari < 16.4 can't parse it).
    it("leaves underscores inside a word alone", () => {
        expect(decorateComposerText("snake_case_name", { emojiSrc })).toBe(
            "snake_case_name",
        );
        expect(decorateComposerText("a__b__", { emojiSrc })).toBe("a__b__");
    });

    it("still underlines and italicises at a word boundary", () => {
        expect(decorateComposerText("x __u__ _e_", { emojiSrc })).toBe(
            "x <u>__u__</u> <em>_e_</em>",
        );
    });

    it("finds a token right after an underscore glued to a word", () => {
        expect(decorateComposerText("a_:blob:_", { emojiSrc })).toBe(
            'a_<span class="composer-custom-emoji"><img src="https://x/blob.png" alt="" draggable="false" contenteditable="false" />:blob:</span>_',
        );
    });
});
