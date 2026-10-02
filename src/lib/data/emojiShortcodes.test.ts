import { describe, expect, it } from "vitest";
import {
    convertTrailingShortcode,
    emojiForShortcode,
    replaceEmojiShortcodes,
    shortcodesFor,
} from "./emojiShortcodes";

describe("emoji shortcodes", () => {
    it("knows Discord's names, with emoji presentation", () => {
        expect(emojiForShortcode("tm")).toBe("™️");
        expect(emojiForShortcode("thumbsup")).toBe("👍");
        expect(emojiForShortcode("+1")).toBe("👍");
        expect(emojiForShortcode("joy")).toBe("😂");
        expect(emojiForShortcode("slight_smile")).toBe("🙂");
        expect(emojiForShortcode("JOY")).toBe("😂");
        expect(emojiForShortcode("not_an_emoji")).toBeUndefined();
        expect(shortcodesFor("™️")).toContain("tm");
    });

    it("converts a shortcode as its closing colon is typed", () => {
        expect(convertTrailingShortcode("Zam:tm:")).toBe("Zam™️");
        expect(convertTrailingShortcode("nice :thumbsup:")).toBe("nice 👍");
        expect(convertTrailingShortcode("nice :thumbsup")).toBeNull();
        expect(convertTrailingShortcode("time 12:30:")).toBeNull();
        // A custom emote with the same name wins.
        expect(
            convertTrailingShortcode(":joy:", (c) => c === "joy"),
        ).toBeNull();
    });

    it("replaces shortcodes at send, but not inside code", () => {
        expect(replaceEmojiShortcodes("a :tm: b :fire:")).toBe("a ™️ b 🔥");
        expect(replaceEmojiShortcodes("`:tm:` and :tm:")).toBe("`:tm:` and ™️");
        expect(replaceEmojiShortcodes("```\n:tm:\n```")).toBe("```\n:tm:\n```");
        expect(replaceEmojiShortcodes(":blob: :tm:", (c) => c === "blob")).toBe(
            ":blob: ™️",
        );
    });
});
