import { describe, it, expect } from "vitest";
import {
    entryFromEvent,
    encodeBlock,
    decodeBlock,
    resolveEntries,
    searchEntries,
    normalizeForSearch,
    type IndexEntry,
} from "./eventIndex";
import { parseSearchQuery } from "./messageSearch";

const msg = (
    id: string,
    body: string,
    ts: number,
    extra: Record<string, unknown> = {},
) => ({
    eventId: id,
    sender: "@a:x",
    ts,
    type: "m.room.message",
    content: { msgtype: "m.text", body, ...extra },
});

describe("entryFromEvent", () => {
    it("keeps text messages", () => {
        expect(entryFromEvent(msg("$1", "hello", 5))).toEqual({
            e: "$1",
            s: "@a:x",
            t: 5,
            m: "m.text",
            b: "hello",
        });
    });

    it("skips non-messages, redactions and bodyless content", () => {
        expect(
            entryFromEvent({ ...msg("$1", "x", 1), type: "m.reaction" }),
        ).toBeNull();
        expect(
            entryFromEvent({ ...msg("$1", "x", 1), redacted: true }),
        ).toBeNull();
        expect(
            entryFromEvent({
                ...msg("$1", "x", 1),
                content: { msgtype: "m.text" },
            }),
        ).toBeNull();
        // Still encrypted (no key): the type never became m.room.message.
        expect(
            entryFromEvent({ ...msg("$1", "x", 1), type: "m.room.encrypted" }),
        ).toBeNull();
    });

    it("indexes an edit's new text against the original", () => {
        const entry = entryFromEvent(
            msg("$2", "* fixed", 9, {
                "m.new_content": { msgtype: "m.text", body: "fixed" },
                "m.relates_to": { rel_type: "m.replace", event_id: "$1" },
            }),
        );
        expect(entry).toMatchObject({ e: "$2", o: "$1", b: "fixed" });
    });

    it("marks voice messages", () => {
        const entry = entryFromEvent(
            msg("$1", "Voice message", 1, {
                msgtype: "m.audio",
                "org.matrix.msc3245.voice": {},
            }),
        );
        expect(entry?.v).toBe(1);
    });
});

describe("blocks", () => {
    it("round-trip through compression", async () => {
        const entries: IndexEntry[] = Array.from({ length: 250 }, (_, i) => ({
            e: `$${i}`,
            s: "@someone:example.org",
            t: 1_700_000_000_000 + i,
            m: "m.text",
            b: `message number ${i}, with some ordinary chat text in it`,
        }));
        const block = await encodeBlock(entries);
        expect(await decodeBlock(block)).toEqual(entries);
        const raw = new TextEncoder().encode(JSON.stringify(entries)).length;
        if (block.z) expect(block.data.length).toBeLessThan(raw / 3);
    });
});

describe("resolveEntries", () => {
    const e = (id: string, t: number, b: string, o?: string): IndexEntry => ({
        e: id,
        s: "@a:x",
        t,
        m: "m.text",
        b,
        ...(o ? { o } : {}),
    });

    it("applies the latest edit, keeps the original's time, newest first", () => {
        const out = resolveEntries(
            [
                e("$1", 1, "teh"),
                e("$2", 2, "other"),
                e("$3", 3, "the", "$1"),
                e("$4", 4, "thee", "$1"),
            ],
            new Set(),
        );
        expect(out.map((x) => [x.e, x.b, x.t])).toEqual([
            ["$2", "other", 2],
            ["$1", "thee", 1],
        ]);
    });

    it("drops redacted messages and edits of them, and dedupes", () => {
        const out = resolveEntries(
            [
                e("$1", 1, "a"),
                e("$1", 1, "a"),
                e("$2", 2, "b"),
                e("$3", 3, "c", "$2"),
            ],
            new Set(["$2"]),
        );
        expect(out.map((x) => x.e)).toEqual(["$1"]);
    });

    it("shows an edit whose original isn't indexed as the original", () => {
        const out = resolveEntries([e("$9", 9, "new", "$1")], new Set());
        expect(out).toEqual([
            { e: "$1", s: "@a:x", t: 9, m: "m.text", b: "new", o: undefined },
        ]);
    });
});

describe("searchEntries", () => {
    const entries: IndexEntry[] = [
        { e: "$1", s: "@bob:x", t: 3, m: "m.text", b: "Café meeting tomorrow" },
        { e: "$2", s: "@amy:x", t: 2, m: "m.image", b: "cat.png" },
        { e: "$3", s: "@amy:x", t: 1, m: "m.text", b: "東京で会いましょう" },
    ];

    it("matches every word, partially, ignoring case and accents", () => {
        expect(
            searchEntries(entries, parseSearchQuery("cafe meet")).map(
                (x) => x.e,
            ),
        ).toEqual(["$1"]);
        expect(
            searchEntries(entries, parseSearchQuery("MEET TOM")).map(
                (x) => x.e,
            ),
        ).toEqual(["$1"]);
    });

    it("matches text without spaces (CJK)", () => {
        expect(
            searchEntries(entries, parseSearchQuery("東京")).map((x) => x.e),
        ).toEqual(["$3"]);
    });

    it("applies from: and has: operators", () => {
        expect(
            searchEntries(entries, parseSearchQuery("has:image")).map(
                (x) => x.e,
            ),
        ).toEqual(["$2"]);
        expect(
            searchEntries(entries, parseSearchQuery("from:amy")).map(
                (x) => x.e,
            ),
        ).toEqual(["$2", "$3"]);
    });

    it("normalizes", () => {
        expect(normalizeForSearch("ÉcOle")).toBe("ecole");
    });
});
