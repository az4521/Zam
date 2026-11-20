import { describe, it, expect, beforeEach } from "vitest";
import { DecryptedBlobCache } from "./decryptedBlobCache";

// jsdom has no object URLs, so the cache is driven with fake ones and the
// test records every revoke.
let made: string[];
let revoked: string[];
let seq: number;

function blob(bytes: number): Blob {
    return new Blob([new Uint8Array(bytes)]);
}

function makeCache(maxBytes: number): DecryptedBlobCache {
    return new DecryptedBlobCache({
        maxBytes,
        createUrl: () => {
            const url = `blob:test/${seq++}`;
            made.push(url);
            return url;
        },
        revokeUrl: (url) => revoked.push(url),
    });
}

beforeEach(() => {
    made = [];
    revoked = [];
    seq = 1;
});

describe("DecryptedBlobCache", () => {
    it("makes one URL per key and hands the same one to every holder", () => {
        const c = makeCache(1000);
        const a = c.hold("mxc://x/a", blob(10));
        const b = c.get("mxc://x/a");
        expect(b?.url).toBe(a.url);
        expect(made).toHaveLength(1);
    });

    it("keeps a second hold of an existing key on the cached blob", () => {
        const c = makeCache(1000);
        const first = c.hold("k", blob(10));
        const again = c.hold("k", blob(99));
        expect(again.url).toBe(first.url);
        expect(again.blob.size).toBe(10);
        expect(c.totalBytes).toBe(10);
    });

    it("returns null for an unknown key", () => {
        expect(makeCache(1000).get("nope")).toBeNull();
    });

    it("keeps an unheld entry warm after its last release", () => {
        const c = makeCache(1000);
        c.hold("k", blob(10)).release();
        expect(revoked).toEqual([]);
        expect(c.get("k")).not.toBeNull();
    });

    it("evicts least recently used unheld entries past the byte budget", () => {
        const c = makeCache(100);
        c.cache("old", blob(60));
        c.cache("new", blob(60)); // 120 > 100: "old" goes
        expect(revoked).toEqual(["blob:test/1"]);
        expect(c.get("old")).toBeNull();
        expect(c.get("new")).not.toBeNull();
        expect(c.totalBytes).toBe(60);
    });

    it("refreshes LRU order on get", () => {
        const c = makeCache(100);
        c.cache("a", blob(40));
        c.cache("b", blob(40));
        c.get("a")!.release(); // a is now the most recent
        c.cache("c", blob(40)); // 120 > 100: b (least recent) goes
        expect(c.get("b")).toBeNull();
        expect(c.get("a")).not.toBeNull();
        expect(revoked).toEqual(["blob:test/2"]);
    });

    it("never evicts or revokes a held entry, even over budget", () => {
        const c = makeCache(100);
        const held = c.hold("a", blob(80));
        c.cache("b", blob(80)); // over budget, but "a" is held
        expect(revoked).toEqual(["blob:test/2"]); // only the unheld "b"
        expect(c.get("a")?.url).toBe(held.url);
        expect(revoked).not.toContain(held.url);
    });

    it("evicts a released entry once the budget is exceeded again", () => {
        const c = makeCache(100);
        const held = c.hold("a", blob(80));
        held.release(); // unheld, and within budget: stays warm
        expect(revoked).toEqual([]);
        c.cache("b", blob(80)); // 160 > 100: the unheld "a" goes
        expect(revoked).toEqual([held.url]);
        expect(c.get("b")).not.toBeNull();
    });

    it("release is idempotent and does not free another holder's claim", () => {
        const c = makeCache(100);
        const one = c.hold("a", blob(50));
        const two = c.get("a")!;
        one.release();
        one.release();
        c.cache("b", blob(80)); // "a" still held by two: must not go
        expect(revoked).not.toContain(two.url);
        two.release();
    });

    it("does not cache a blob bigger than the budget, but revokes it on release", () => {
        const c = makeCache(100);
        const big = c.hold("big", blob(200));
        expect(c.size).toBe(0);
        expect(c.totalBytes).toBe(0);
        big.release();
        expect(revoked).toEqual([big.url]);
    });

    it("clear revokes unheld URLs now and held ones on their last release", () => {
        const c = makeCache(1000);
        c.cache("unheld", blob(10));
        const held = c.hold("held", blob(10));
        c.clear();
        expect(revoked).toEqual(["blob:test/1"]);
        expect(c.size).toBe(0);
        expect(c.totalBytes).toBe(0);
        held.release();
        expect(revoked).toContain(held.url);
        expect(revoked).toHaveLength(2);
    });
});
