import { describe, it, expect } from "vitest";
import {
    shouldClearComposerAfterSend,
    shouldClearStoredDraft,
} from "./composerClear";

describe("shouldClearComposerAfterSend", () => {
    it("clears when the user is still in the target room and has not typed since", () => {
        expect(
            shouldClearComposerAfterSend({
                currentRoomId: "!a:example.org",
                targetRoomId: "!a:example.org",
                currentText: "hi",
                textAtSend: "hi",
            }),
        ).toBe(true);
    });

    it("does not clear after a room switch — the composer now holds another room's draft", () => {
        expect(
            shouldClearComposerAfterSend({
                currentRoomId: "!b:example.org",
                targetRoomId: "!a:example.org",
                currentText: "hi",
                textAtSend: "hi",
            }),
        ).toBe(false);
    });

    it("does not clear when the text changed — that is new typing, not the caption we sent", () => {
        expect(
            shouldClearComposerAfterSend({
                currentRoomId: "!a:example.org",
                targetRoomId: "!a:example.org",
                currentText: "something else entirely",
                textAtSend: "hi",
            }),
        ).toBe(false);
    });

    it("does not clear when the user only appended to the caption while it uploaded", () => {
        expect(
            shouldClearComposerAfterSend({
                currentRoomId: "!a:example.org",
                targetRoomId: "!a:example.org",
                currentText: "hi and more",
                textAtSend: "hi",
            }),
        ).toBe(false);
    });

    it("does not clear when the only change is surrounding whitespace", () => {
        // The send used the trimmed text, but the composer still holds what the
        // user actually typed — a whitespace-only edit is still an edit.
        expect(
            shouldClearComposerAfterSend({
                currentRoomId: "!a:example.org",
                targetRoomId: "!a:example.org",
                currentText: "hi ",
                textAtSend: "hi",
            }),
        ).toBe(false);
    });

    it("does not clear when both the room and the text changed", () => {
        expect(
            shouldClearComposerAfterSend({
                currentRoomId: "!b:example.org",
                targetRoomId: "!a:example.org",
                currentText: "a different draft",
                textAtSend: "hi",
            }),
        ).toBe(false);
    });

    it("clears for an identical empty composer (a file-only send)", () => {
        expect(
            shouldClearComposerAfterSend({
                currentRoomId: "!a:example.org",
                targetRoomId: "!a:example.org",
                currentText: "",
                textAtSend: "",
            }),
        ).toBe(true);
    });
});

describe("shouldClearStoredDraft", () => {
    it("clears when there is no stored draft at all", () => {
        expect(
            shouldClearStoredDraft({ storedText: null, textAtSend: "hi" }),
        ).toBe(true);
    });

    it("clears when the stored draft is exactly the text we just sent", () => {
        expect(
            shouldClearStoredDraft({ storedText: "hi", textAtSend: "hi" }),
        ).toBe(true);
    });

    it("keeps a stored draft the user extended after pressing Send", () => {
        expect(
            shouldClearStoredDraft({
                storedText: "hi — invoice attached too",
                textAtSend: "hi",
            }),
        ).toBe(false);
    });

    it("keeps a stored draft that differs entirely from what we sent", () => {
        expect(
            shouldClearStoredDraft({
                storedText: "an unrelated draft",
                textAtSend: "hi",
            }),
        ).toBe(false);
    });

    it("keeps a stored draft that is only a whitespace variation of what we sent", () => {
        expect(
            shouldClearStoredDraft({ storedText: "hi ", textAtSend: "hi" }),
        ).toBe(false);
    });

    it("clears when both the stored draft and the sent text are empty", () => {
        expect(shouldClearStoredDraft({ storedText: "", textAtSend: "" })).toBe(
            true,
        );
    });
});
