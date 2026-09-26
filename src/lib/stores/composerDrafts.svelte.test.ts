import { describe, it, expect, beforeEach } from "vitest";
import {
    getDraft,
    setDraft,
    clearDraft,
    registerLiveComposer,
    deliverToLiveComposer,
} from "./composerDrafts.svelte";

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

describe("live composer delivery", () => {
    it("returns false when no composer is open for the key", () => {
        expect(deliverToLiveComposer(A, "hi")).toBe(false);
    });

    it("hands text to the open composer for that key only", () => {
        const got: string[] = [];
        const off = registerLiveComposer(A, (t) => got.push(t));
        expect(deliverToLiveComposer(B, "not mine")).toBe(false);
        expect(deliverToLiveComposer(A, "mine")).toBe(true);
        expect(got).toEqual(["mine"]);
        off();
        expect(deliverToLiveComposer(A, "after close")).toBe(false);
    });

    it("a stale unregister does not remove a newer composer", () => {
        const first: string[] = [];
        const second: string[] = [];
        const offFirst = registerLiveComposer(A, (t) => first.push(t));
        const offSecond = registerLiveComposer(A, (t) => second.push(t));
        offFirst();
        expect(deliverToLiveComposer(A, "x")).toBe(true);
        expect(second).toEqual(["x"]);
        expect(first).toEqual([]);
        offSecond();
    });
});
