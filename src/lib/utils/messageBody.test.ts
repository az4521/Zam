import { describe, it, expect } from "vitest";
import { buildFormattedBody } from "./messageBody";

const empty = { mentions: new Map<string, string>(), customEmojis: [] };

describe("buildFormattedBody", () => {
    it("applies markdown (bold), no mentions", () => {
        const r = buildFormattedBody("**bold**", empty);
        expect(r.html).toContain("<strong>bold</strong>");
        expect(r.mentionedUserIds).toEqual([]);
    });

    it("applies markdown (italic)", () => {
        const r = buildFormattedBody("*italic*", empty);
        expect(r.html).toContain("<em>italic</em>");
    });

    it("returns null html when nothing is applied", () => {
        const r = buildFormattedBody("hello", empty);
        expect(r.html).toBeNull();
        expect(r.mentionedUserIds).toEqual([]);
    });

    it("substitutes a mention token present in the text", () => {
        const r = buildFormattedBody("hi @alice", {
            mentions: new Map([["@alice", "@alice:hs"]]),
            customEmojis: [],
        });
        expect(r.html).toContain(
            '<a href="https://matrix.to/#/@alice:hs">@alice</a>',
        );
        expect(r.mentionedUserIds).toEqual(["@alice:hs"]);
    });

    it("does not substitute a mapped token absent from the text", () => {
        const r = buildFormattedBody("hello world", {
            mentions: new Map([["@alice", "@alice:hs"]]),
            customEmojis: [],
        });
        expect(r.html).toBeNull();
        expect(r.mentionedUserIds).toEqual([]);
    });

    it("respects token boundaries (@alicia / @alice:hs do not match @alice)", () => {
        const mentions = new Map([["@alice", "@alice:hs"]]);
        const a = buildFormattedBody("@alicia", { mentions, customEmojis: [] });
        expect(a.html ?? "").not.toContain("matrix.to");
        expect(a.mentionedUserIds).toEqual([]);
        const b = buildFormattedBody("@alice:hs", {
            mentions,
            customEmojis: [],
        });
        expect(b.html ?? "").not.toContain("matrix.to");
        expect(b.mentionedUserIds).toEqual([]);
    });

    it("dedupes a userId referenced by two tokens", () => {
        const r = buildFormattedBody("@alice @bob", {
            mentions: new Map([
                ["@alice", "@same:hs"],
                ["@bob", "@same:hs"],
            ]),
            customEmojis: [],
        });
        expect(r.mentionedUserIds).toEqual(["@same:hs"]);
    });

    it("substitutes a known custom-emoji shortcode", () => {
        const r = buildFormattedBody(":party:", {
            mentions: new Map(),
            customEmojis: [{ shortcode: "party", mxcUrl: "mxc://h/x" }],
        });
        expect(r.html).toContain('<img data-mx-emoticon src="mxc://h/x"');
    });

    it("leaves an unknown shortcode as literal text (no img)", () => {
        const r = buildFormattedBody(":party:", {
            mentions: new Map(),
            customEmojis: [],
        });
        expect(r.html ?? "").not.toContain("<img");
    });

    it("applies markdown + mention + emoji together, links intact", () => {
        const r = buildFormattedBody("**hi** @alice :party:", {
            mentions: new Map([["@alice", "@a:hs"]]),
            customEmojis: [{ shortcode: "party", mxcUrl: "mxc://h/x" }],
        });
        expect(r.html).toContain("<strong>hi</strong>");
        expect(r.html).toContain(
            '<a href="https://matrix.to/#/@a:hs">@alice</a>',
        );
        expect(r.html).toContain('<img data-mx-emoticon src="mxc://h/x"');
        expect(r.mentionedUserIds).toEqual(["@a:hs"]);
    });
});

describe("buildFormattedBody — typed @user:server mentions (memberIds)", () => {
    it("notifies and links a typed MXID that is a room member", () => {
        const r = buildFormattedBody("ping @_ooye_mystravil:matrix.hs hi", {
            mentions: new Map(),
            customEmojis: [],
            memberIds: new Set(["@_ooye_mystravil:matrix.hs"]),
        });
        expect(r.mentionedUserIds).toEqual(["@_ooye_mystravil:matrix.hs"]);
        expect(r.html).toContain(
            '<a href="https://matrix.to/#/@_ooye_mystravil:matrix.hs">@_ooye_mystravil:matrix.hs</a>',
        );
    });

    it("ignores a typed MXID that is NOT a member (no accidental pings)", () => {
        const r = buildFormattedBody("mailing @nobody:elsewhere.hs", {
            mentions: new Map(),
            customEmojis: [],
            memberIds: new Set(["@someone:matrix.hs"]),
        });
        expect(r.mentionedUserIds).toEqual([]);
        expect(r.html ?? "").not.toContain("matrix.to");
    });

    it("leaves typed MXIDs alone when no memberIds are supplied (legacy)", () => {
        const r = buildFormattedBody("@alice:hs", {
            mentions: new Map(),
            customEmojis: [],
        });
        expect(r.mentionedUserIds).toEqual([]);
        expect(r.html ?? "").not.toContain("matrix.to");
    });

    it("peels trailing sentence punctuation off the MXID", () => {
        const r = buildFormattedBody("cc @alice:hs.tld, thanks", {
            mentions: new Map(),
            customEmojis: [],
            memberIds: new Set(["@alice:hs.tld"]),
        });
        expect(r.mentionedUserIds).toEqual(["@alice:hs.tld"]);
        expect(r.html).toContain(
            '<a href="https://matrix.to/#/@alice:hs.tld">@alice:hs.tld</a>,',
        );
    });

    it("dedupes when the same user is both a pill and a typed MXID", () => {
        const r = buildFormattedBody("hi @alice and @alice:hs", {
            mentions: new Map([["@alice", "@alice:hs"]]),
            customEmojis: [],
            memberIds: new Set(["@alice:hs"]),
        });
        expect(r.mentionedUserIds).toEqual(["@alice:hs"]);
    });

    it("notifies both a pill mention and a separate typed member", () => {
        const r = buildFormattedBody("@alice ping @bob:hs", {
            mentions: new Map([["@alice", "@alice:hs"]]),
            customEmojis: [],
            memberIds: new Set(["@bob:hs"]),
        });
        expect(new Set(r.mentionedUserIds)).toEqual(
            new Set(["@alice:hs", "@bob:hs"]),
        );
    });
});
