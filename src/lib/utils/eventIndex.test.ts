import { describe, it, expect } from "vitest";
import {
    entryFromEvent,
    entryKey,
    decodeLegacyBlock,
    dropRedactedEntries,
    redactionKeyOf,
    indexPlaceholderId,
    isIndexPlaceholderId,
    legacyToCompact,
    parseIndexPlaceholderId,
    pickResolvedEventId,
    resolveEntries,
    searchEntries,
    normalizeForSearch,
    type LegacyIndexEntry,
} from "./eventIndex";
import { eventIdHash, type CompactEntry } from "./indexBlock";
import { parseSearchQuery } from "./messageSearch";

const H = eventIdHash;

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

/** A compact entry for a test event id (edits name their original by id). */
/** An edit names its original by id and the original's timestamp. */
type Original = { id: string; ts: number | undefined };

const c = (
    id: string,
    t: number,
    b: string,
    original?: Original,
    extra: Partial<CompactEntry> = {},
): CompactEntry => ({
    h: H(id),
    s: "@a:x",
    t,
    m: "m.text",
    b,
    ...(original !== undefined
        ? {
              o: H(original.id),
              ...(original.ts !== undefined ? { ot: original.ts } : {}),
          }
        : {}),
    ...extra,
});

/** Two different event ids with the same 32-bit hash (found by search). */
function collidingPair(): [string, string] {
    const seen = new Map<number, string>();
    for (let i = 0; ; i++) {
        const id = `$c${i}`;
        const h = H(id);
        const prev = seen.get(h);
        if (prev !== undefined) return [prev, id];
        seen.set(h, id);
    }
}

describe("entryFromEvent", () => {
    it("keeps text messages, hashing the event id", () => {
        expect(entryFromEvent(msg("$1", "hello", 5))).toEqual({
            h: H("$1"),
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
        expect(entry).toMatchObject({ h: H("$2"), o: H("$1"), b: "fixed" });
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

describe("entryKey", () => {
    it("identifies a message by its hash and timestamp", () => {
        expect(entryKey({ h: 7, t: 100 })).toBe("7:100");
        expect(entryKey(c("$1", 100, "a"))).toBe(`${H("$1")}:100`);
    });
});

describe("legacy blocks", () => {
    /** A legacy (format 1) block as older builds stored it. */
    async function legacyBlock(entries: LegacyIndexEntry[]) {
        const json = new TextEncoder().encode(JSON.stringify(entries));
        const stream = new CompressionStream("deflate-raw");
        const writer = stream.writable.getWriter();
        void writer.write(json).then(() => writer.close());
        const data = new Uint8Array(
            await new Response(stream.readable).arrayBuffer(),
        );
        return { z: true, data };
    }

    it("decodes the deflated JSON form", async () => {
        const entries: LegacyIndexEntry[] = [
            { e: "$1", s: "@a:x", t: 1, m: "m.text", b: "one" },
            { e: "$2", s: "@a:x", t: 2, m: "m.text", b: "two", o: "$1" },
        ];
        expect(await decodeLegacyBlock(await legacyBlock(entries))).toEqual(
            entries,
        );
    });

    it("converts a legacy entry to the compact form", () => {
        expect(
            legacyToCompact({
                e: "$2",
                s: "@a:x",
                t: 2,
                m: "m.text",
                b: "two",
                o: "$1",
                v: 1,
            }),
        ).toEqual({
            h: H("$2"),
            s: "@a:x",
            t: 2,
            m: "m.text",
            b: "two",
            o: H("$1"),
            v: 1,
        });
    });
});

describe("placeholder ids", () => {
    it("formats and parses the hash and timestamp", () => {
        const id = indexPlaceholderId(0x0000ab12, 1_700_000_000_123);
        expect(id).toBe("$zamidx_0000ab12_1700000000123");
        expect(parseIndexPlaceholderId(id)).toEqual({
            h: 0xab12,
            t: 1_700_000_000_123,
        });
        expect(isIndexPlaceholderId(id)).toBe(true);
    });

    it("round-trips the full uint32 range", () => {
        const id = indexPlaceholderId(0xffffffff, 0);
        expect(parseIndexPlaceholderId(id)).toEqual({ h: 0xffffffff, t: 0 });
    });

    it("rejects anything that isn't a placeholder", () => {
        for (const bad of [
            "$event:example.org",
            "$zamidx_1234_5",
            "$zamidx_0000ab12_",
            "$zamidx_0000ab12_-5",
            "$zamidx_0000ab12_01",
            "$zamidx_0000AB12_5",
            "$zamidx_0000ab12_9999999999999999999",
            "",
        ]) {
            expect(parseIndexPlaceholderId(bad)).toBeNull();
            expect(isIndexPlaceholderId(bad)).toBe(false);
        }
    });
});

describe("pickResolvedEventId", () => {
    const h = H("$target");

    it("takes the timestamp lookup's event when its hash matches", () => {
        expect(
            pickResolvedEventId(h, 10, { eventId: "$target", ts: 10 }, []),
        ).toBe("$target");
    });

    it("finds the event in the context when the anchor is a neighbour", () => {
        expect(
            pickResolvedEventId(h, 10, { eventId: "$neighbour", ts: 10 }, [
                { eventId: "$other", ts: 9 },
                { eventId: "$target", ts: 10 },
            ]),
        ).toBe("$target");
    });

    it("requires the timestamp to match too", () => {
        expect(
            pickResolvedEventId(h, 10, { eventId: "$neighbour", ts: 11 }, [
                { eventId: "$target", ts: 11 },
            ]),
        ).toBeNull();
    });

    it("returns null when neither the anchor nor the context matches", () => {
        expect(
            pickResolvedEventId(h, 10, { eventId: "$x", ts: 10 }, []),
        ).toBeNull();
        expect(pickResolvedEventId(h, 10, null, [])).toBeNull();
    });
});

describe("resolveEntries", () => {
    it("applies the latest edit, keeps the original's time, newest first", () => {
        const out = resolveEntries(
            [
                c("$1", 1, "teh"),
                c("$2", 2, "other"),
                c("$3", 3, "the", { id: "$1", ts: 1 }),
                c("$4", 4, "thee", { id: "$1", ts: 1 }),
            ],
            new Set(),
        );
        expect(out.map((x) => [x.h, x.b, x.t])).toEqual([
            [H("$2"), "other", 2],
            [H("$1"), "thee", 1],
        ]);
    });

    it("drops redacted messages and edits of them, and dedupes", () => {
        const out = resolveEntries(
            [
                c("$1", 1, "a"),
                c("$1", 1, "a"),
                c("$2", 2, "b"),
                c("$3", 3, "c", { id: "$2", ts: 2 }),
            ],
            new Set([redactionKeyOf(H("$2"), 2)]),
        );
        expect(out.map((x) => x.h)).toEqual([H("$1")]);
    });

    it("drops the stored body of a redacted message, and of its edits", () => {
        const kept = dropRedactedEntries(
            [
                c("$1", 1, "keep"),
                c("$2", 2, "secret"),
                c("$3", 3, "secret edit", { id: "$2", ts: 2 }),
                c("$4", 4, "edit of kept", { id: "$1", ts: 1 }),
            ],
            new Set([redactionKeyOf(H("$2"), 2)]),
        );
        expect(kept.map((x) => x.b)).toEqual(["keep", "edit of kept"]);
    });

    it("drops a redacted edit by its own id and leaves the original", () => {
        const kept = dropRedactedEntries(
            [c("$1", 1, "orig"), c("$5", 5, "edit text", { id: "$1", ts: 1 })],
            new Set([redactionKeyOf(H("$5"), 5)]),
        );
        expect(kept.map((x) => x.h)).toEqual([H("$1")]);
    });

    it("returns the same array when no stored entry is redacted", () => {
        const entries = [c("$1", 1, "a")];
        expect(
            dropRedactedEntries(entries, new Set([redactionKeyOf(H("$9"), 9)])),
        ).toBe(entries);
        expect(dropRedactedEntries(entries, new Set())).toBe(entries);
    });

    it("shows an edit whose original isn't indexed as the original", () => {
        const out = resolveEntries(
            [c("$9", 9, "new", { id: "$1", ts: 1 })],
            new Set(),
        );
        expect(out).toEqual([
            {
                h: H("$1"),
                s: "@a:x",
                t: 1,
                m: "m.text",
                b: "new",
                o: undefined,
                ot: undefined,
            },
        ]);
    });

    it("shows an edit without its original's time as a hit of its own", () => {
        const out = resolveEntries(
            [
                c("$1", 1, "orig"),
                c("$9", 9, "unlinked edit", { id: "$1", ts: undefined }),
            ],
            new Set(),
        );
        expect(out.map((x) => [x.h, x.b])).toEqual([
            [H("$9"), "unlinked edit"],
            [H("$1"), "orig"],
        ]);
    });
});

describe("hash collisions: matches use the timestamp too", () => {
    const [A, B] = collidingPair();
    expect(H(A)).toBe(H(B));

    it("a redaction removes only the message with the matching timestamp", () => {
        const kept = dropRedactedEntries(
            [c(A, 100, "a"), c(B, 200, "b")],
            new Set([redactionKeyOf(H(B), 200)]),
        );
        expect(kept.map((x) => x.b)).toEqual(["a"]);
        expect(
            resolveEntries(
                [c(A, 100, "a"), c(B, 200, "b")],
                new Set([redactionKeyOf(H(A), 100)]),
            ).map((x) => x.b),
        ).toEqual(["b"]);
    });

    it("a redaction with a timestamp that matches neither removes nothing", () => {
        const entries = [c(A, 100, "a"), c(B, 200, "b")];
        expect(
            dropRedactedEntries(entries, new Set([redactionKeyOf(H(A), 999)])),
        ).toBe(entries);
    });

    it("an edit links only to the original with the matching timestamp", () => {
        const out = resolveEntries(
            [
                c(A, 100, "orig a"),
                c(B, 200, "orig b"),
                c("$ea", 300, "edit of a", { id: A, ts: 100 }),
                c("$eb", 301, "edit of b", { id: B, ts: 200 }),
            ],
            new Set(),
        );
        expect(out.map((x) => [x.t, x.b])).toEqual([
            [200, "edit of b"],
            [100, "edit of a"],
        ]);
    });

    it("an edit naming the wrong timestamp links to nothing", () => {
        const out = resolveEntries(
            [c(A, 100, "orig a"), c("$e", 300, "stray", { id: A, ts: 555 })],
            new Set(),
        );
        // Its original is not indexed, so the edit stands in for it at the
        // time it names (555): the original's own id and time.
        expect(out.map((x) => [x.t, x.b])).toEqual([
            [555, "stray"],
            [100, "orig a"],
        ]);
    });

    it("redacting one original removes only its own edits", () => {
        const kept = dropRedactedEntries(
            [
                c("$ea", 300, "edit of a", { id: A, ts: 100 }),
                c("$eb", 301, "edit of b", { id: B, ts: 200 }),
            ],
            new Set([redactionKeyOf(H(B), 200)]),
        );
        expect(kept.map((x) => x.b)).toEqual(["edit of a"]);
    });

    it("an edit without its original's time is never removed by a redaction", () => {
        const entries = [c("$e", 300, "no time", { id: A, ts: undefined })];
        expect(
            dropRedactedEntries(entries, new Set([redactionKeyOf(H(A), 100)])),
        ).toBe(entries);
    });

    it("a tombstone without a timestamp has no key, so it removes nothing by hash", () => {
        const entries = [c(A, 100, "a"), c(B, 200, "b")];
        const keys = redactionKeysOfTest([{ eventId: A }]);
        expect(dropRedactedEntries(entries, keys)).toBe(entries);
    });
});

/** The same key rule the matrix layer uses: a timestamp is needed. */
function redactionKeysOfTest(rows: { eventId: string; ts?: number }[]) {
    return new Set(
        rows
            .filter((r) => r.ts !== undefined)
            .map((r) => redactionKeyOf(H(r.eventId), r.ts as number)),
    );
}

describe("searchEntries", () => {
    const entries: CompactEntry[] = [
        c("$1", 3, "Café meeting tomorrow", undefined, { s: "@bob:x" }),
        c("$2", 2, "cat.png", undefined, { s: "@amy:x", m: "m.image" }),
        c("$3", 1, "東京で会いましょう", undefined, { s: "@amy:x" }),
    ];
    const hashes = (xs: CompactEntry[]) =>
        xs.map((x) => entries.find((e) => e.h === x.h && e.t === x.t)!.t);

    it("matches every word, partially, ignoring case and accents", () => {
        expect(
            hashes(searchEntries(entries, parseSearchQuery("cafe meet"))),
        ).toEqual([3]);
        expect(
            hashes(searchEntries(entries, parseSearchQuery("MEET TOM"))),
        ).toEqual([3]);
    });

    it("matches text without spaces (CJK)", () => {
        expect(
            hashes(searchEntries(entries, parseSearchQuery("東京"))),
        ).toEqual([1]);
    });

    it("applies from: and has: operators", () => {
        expect(
            hashes(searchEntries(entries, parseSearchQuery("has:image"))),
        ).toEqual([2]);
        expect(
            hashes(searchEntries(entries, parseSearchQuery("from:amy"))),
        ).toEqual([2, 1]);
    });

    it("normalizes", () => {
        expect(normalizeForSearch("ÉcOle")).toBe("ecole");
    });
});

describe("gallery item types (g)", () => {
    const galleryEv = (
        itemtypes: unknown,
        extra: Record<string, unknown> = {},
    ) => ({
        eventId: "$gal",
        sender: "@alice:example.org",
        ts: 10,
        type: "m.room.message",
        content: {
            msgtype: "dm.filament.gallery",
            body: "our trip",
            itemtypes,
            ...extra,
        },
    });

    it("records the item msgtypes of a gallery", () => {
        const entry = entryFromEvent(
            galleryEv([
                { itemtype: "m.image", url: "mxc://hs/a" },
                { itemtype: "m.video", url: "mxc://hs/b" },
                { itemtype: "m.text" },
            ]),
        );
        expect(entry).toEqual({
            h: H("$gal"),
            s: "@alice:example.org",
            t: 10,
            m: "dm.filament.gallery",
            b: "our trip",
            g: ["m.image", "m.video"],
        });
    });

    it("omits g when a gallery has no valid items", () => {
        const entry = entryFromEvent(galleryEv([{ itemtype: "m.text" }]));
        expect(entry).not.toHaveProperty("g");
        expect(entryFromEvent(galleryEv("nope"))).not.toHaveProperty("g");
    });

    it("omits g for single media and text", () => {
        expect(entryFromEvent(msg("$1", "hello", 5))).not.toHaveProperty("g");
    });

    it("matches has:image against a gallery entry", () => {
        const entries = [
            entryFromEvent(
                galleryEv([{ itemtype: "m.image", url: "mxc://hs/a" }]),
            )!,
        ];
        expect(
            searchEntries(entries, parseSearchQuery("has:image")).map(
                (e) => e.h,
            ),
        ).toEqual([H("$gal")]);
        expect(searchEntries(entries, parseSearchQuery("has:file"))).toEqual(
            [],
        );
    });

    it("keeps g from an edit that is still a gallery", () => {
        const original = entryFromEvent(
            galleryEv([{ itemtype: "m.image", url: "mxc://hs/a" }]),
        )!;
        const edit = entryFromEvent(
            {
                eventId: "$edit",
                sender: "@alice:example.org",
                ts: 20,
                type: "m.room.message",
                content: {
                    msgtype: "m.text",
                    body: "* new",
                    "m.relates_to": { rel_type: "m.replace", event_id: "$gal" },
                    "m.new_content": {
                        msgtype: "dm.filament.gallery",
                        body: "new caption",
                        itemtypes: [{ itemtype: "m.file", url: "mxc://hs/f" }],
                    },
                },
            },
            10,
        )!;
        const [resolved] = resolveEntries([original, edit], new Set());
        expect(resolved.b).toBe("new caption");
        expect(resolved.g).toEqual(["m.file"]);
    });

    it("drops g when an edit turns the gallery into plain text", () => {
        const original = entryFromEvent(
            galleryEv([{ itemtype: "m.image", url: "mxc://hs/a" }]),
        )!;
        const edit = c("$edit", 20, "just text now", { id: "$gal", ts: 10 });
        const [resolved] = resolveEntries([original, edit], new Set());
        expect(resolved.m).toBe("m.text");
        expect(resolved).not.toHaveProperty("g");
        expect(
            searchEntries([resolved], parseSearchQuery("has:image")),
        ).toEqual([]);
    });

    it("keeps the original g when an edit has no msgtype", () => {
        const original = entryFromEvent(
            galleryEv([{ itemtype: "m.video", url: "mxc://hs/a" }]),
        )!;
        const edit = c(
            "$edit",
            20,
            "fixed caption",
            { id: "$gal", ts: 10 },
            {
                m: "",
            },
        );
        const [resolved] = resolveEntries([original, edit], new Set());
        expect(resolved.b).toBe("fixed caption");
        expect(resolved.m).toBe("dm.filament.gallery");
        expect(resolved.g).toEqual(["m.video"]);
    });
});
