import { describe, it, expect, beforeEach } from "vitest";
import { getDraft, setDraft, clearDraft } from "./composerDrafts.svelte";

const A = "!a:server";
const B = "!b:server";

// Module-level store persists across tests — reset the ids we touch.
beforeEach(() => {
    clearDraft(A);
    clearDraft(B);
});

describe("composerDrafts", () => {
    it("returns null for a room with no draft", () => {
        expect(getDraft(A)).toBeNull();
    });

    it("stores and returns text with no mentions", () => {
        setDraft(A, "hello world", new Map());
        expect(getDraft(A)).toEqual({ text: "hello world", mentions: [] });
    });

    it("round-trips the mention map to entries", () => {
        const mentions = new Map([
            ["@alice", "@alice:server"],
            ["@bob", "@bob:server"],
        ]);
        setDraft(A, "hey @alice @bob", mentions);
        const draft = getDraft(A);
        expect(draft?.text).toBe("hey @alice @bob");
        expect(new Map(draft?.mentions)).toEqual(mentions);
    });

    it("snapshots the mention map so later caller mutations don't leak in", () => {
        const mentions = new Map([["@alice", "@alice:server"]]);
        setDraft(A, "hey @alice", mentions);
        mentions.set("@bob", "@bob:server"); // mutate after storing
        expect(getDraft(A)?.mentions).toEqual([["@alice", "@alice:server"]]);
    });

    it("deletes the draft when text is blank", () => {
        setDraft(A, "something", new Map());
        setDraft(A, "", new Map());
        expect(getDraft(A)).toBeNull();
    });

    it("deletes the draft when text is whitespace-only", () => {
        setDraft(A, "something", new Map());
        setDraft(A, "   \n\t ", new Map());
        expect(getDraft(A)).toBeNull();
    });

    it("overwrites an existing draft on the same room", () => {
        setDraft(A, "first", new Map());
        setDraft(A, "second", new Map([["@x", "@x:server"]]));
        expect(getDraft(A)).toEqual({
            text: "second",
            mentions: [["@x", "@x:server"]],
        });
    });

    it("isolates drafts between rooms", () => {
        setDraft(A, "draft for A", new Map());
        setDraft(B, "draft for B", new Map());
        expect(getDraft(A)?.text).toBe("draft for A");
        expect(getDraft(B)?.text).toBe("draft for B");
    });

    it("clearDraft removes a stored draft", () => {
        setDraft(A, "gone soon", new Map());
        clearDraft(A);
        expect(getDraft(A)).toBeNull();
    });
});
