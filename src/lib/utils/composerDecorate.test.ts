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
});
