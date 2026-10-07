import { describe, it, expect } from "vitest";
import {
    DRAFT_SNAPSHOT_MAX_AGE_MS,
    parseDraftSnapshot,
    releaseBlocker,
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
