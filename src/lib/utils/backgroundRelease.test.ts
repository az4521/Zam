import { describe, it, expect } from "vitest";
import {
    DRAFT_SNAPSHOT_MAX_AGE_MS,
    RELEASE_AFTER_MISS_FOR_MS,
    parseDraftSnapshot,
    releaseBlocker,
    releaseNeeded,
    serializeDraftSnapshot,
    type ReleaseInput,
} from "./backgroundRelease";

const idle: ReleaseInput = {
    inCall: false,
    sharingLiveLocation: false,
    outboxPending: false,
    sendsInFlight: false,
    keepAliveHolds: 0,
};

describe("releaseBlocker", () => {
    it("lets an idle page go", () => {
        expect(releaseBlocker(idle)).toBeNull();
    });

    it("keeps the page for anything the reload would cut off", () => {
        expect(releaseBlocker({ ...idle, inCall: true })).toBe("call");
        expect(releaseBlocker({ ...idle, sharingLiveLocation: true })).toBe(
            "live location",
        );
        expect(releaseBlocker({ ...idle, outboxPending: true })).toBe("outbox");
        expect(releaseBlocker({ ...idle, sendsInFlight: true })).toBe(
            "sending",
        );
        expect(releaseBlocker({ ...idle, keepAliveHolds: 1 })).toBe(
            "keep-alive",
        );
    });
});

describe("draft snapshot", () => {
    const now = 1_000_000_000;
    const drafts = {
        "!a:x": { text: "half a thought", mentions: [["@b", "@b:x"]] },
        "!a:x::thread::$r": { text: "thread reply", mentions: [] },
    } as Record<string, { text: string; mentions: [string, string][] }>;

    it("round-trips drafts, thread composers included", () => {
        const raw = serializeDraftSnapshot(drafts, now);
        expect(parseDraftSnapshot(raw, now + 5000)).toEqual(drafts);
    });

    it("ignores a missing, stale, future or malformed snapshot", () => {
        const raw = serializeDraftSnapshot(drafts, now);
        expect(parseDraftSnapshot(null, now)).toBeNull();
        expect(
            parseDraftSnapshot(raw, now + DRAFT_SNAPSHOT_MAX_AGE_MS + 1),
        ).toBeNull();
        expect(parseDraftSnapshot(raw, now - 1)).toBeNull();
        expect(parseDraftSnapshot("not json", now)).toBeNull();
        expect(
            parseDraftSnapshot('{"v":2,"savedAt":1,"drafts":{}}', now),
        ).toBeNull();
    });

    it("drops blank drafts and malformed mentions", () => {
        const raw = JSON.stringify({
            v: 1,
            savedAt: now,
            drafts: {
                "!blank:x": { text: "   ", mentions: [] },
                "!ok:x": { text: "hi", mentions: [["@a", "@a:x"], ["bad"], 3] },
                "!junk:x": 42,
            },
        });
        expect(parseDraftSnapshot(raw, now)).toEqual({
            "!ok:x": { text: "hi", mentions: [["@a", "@a:x"]] },
        });
    });
});

describe("releaseNeeded", () => {
    const now = 2_000_000_000_000;

    it("is off on a phone where the page never missed a deadline", () => {
        expect(releaseNeeded(null, now)).toBe(false);
    });

    it("is on for a while after a miss, then tried without again", () => {
        expect(releaseNeeded(now - 1000, now)).toBe(true);
        expect(releaseNeeded(now - RELEASE_AFTER_MISS_FOR_MS + 1, now)).toBe(
            true,
        );
        expect(releaseNeeded(now - RELEASE_AFTER_MISS_FOR_MS, now)).toBe(false);
    });

    it("ignores a timestamp from the future or a junk value", () => {
        expect(releaseNeeded(now + 60_000, now)).toBe(false);
        expect(releaseNeeded(Number.NaN, now)).toBe(false);
    });
});
