import { describe, expect, it } from "vitest";
import {
    ANNOUNCE_DEBOUNCE_MS,
    EMPTY_ANNOUNCER,
    MAX_BODY_CHARS,
    drainAnnouncement,
    recordArrival,
    shouldAnnounceDecrypted,
    type ArrivedMessage,
} from "./liveAnnouncer";

function msg(over: Partial<ArrivedMessage> = {}): ArrivedMessage {
    return {
        eventId: "$1",
        sender: "Alice",
        isOwn: false,
        body: "hello",
        ...over,
    };
}

describe("recordArrival", () => {
    it("queues an incoming message", () => {
        const s = recordArrival(EMPTY_ANNOUNCER, msg());
        expect(s.pending).toHaveLength(1);
    });

    it("never queues the user's own message", () => {
        const s = recordArrival(EMPTY_ANNOUNCER, msg({ isOwn: true }));
        expect(s.pending).toHaveLength(0);
        expect(s).toBe(EMPTY_ANNOUNCER);
    });

    it("ignores a repeat of an event it already recorded", () => {
        const a = recordArrival(EMPTY_ANNOUNCER, msg({ eventId: "$dup" }));
        const b = recordArrival(a, msg({ eventId: "$dup" }));
        expect(b.pending).toHaveLength(1);
        expect(b).toBe(a);
    });

    it("still ignores a repeat after the queue was drained", () => {
        const a = recordArrival(EMPTY_ANNOUNCER, msg({ eventId: "$dup" }));
        const { state: drained } = drainAnnouncement(a);
        const b = recordArrival(drained, msg({ eventId: "$dup" }));
        expect(b.pending).toHaveLength(0);
        // Identity, not just emptiness: the caller restarts its debounce timer
        // on `!==`, so a fresh-but-equal object here would clear and re-arm the
        // timer with an empty queue and swallow the burst already in flight.
        expect(b).toBe(drained);
    });

    it("drops an event with no id, which cannot be deduplicated", () => {
        const s = recordArrival(EMPTY_ANNOUNCER, msg({ eventId: "" }));
        expect(s).toBe(EMPTY_ANNOUNCER);
    });
});

describe("drainAnnouncement", () => {
    it("returns empty text and the same state when nothing is pending", () => {
        const { state, text } = drainAnnouncement(EMPTY_ANNOUNCER);
        expect(text).toBe("");
        expect(state).toBe(EMPTY_ANNOUNCER);
    });

    it("announces a single message as sender then body", () => {
        const s = recordArrival(
            EMPTY_ANNOUNCER,
            msg({ sender: "Alice", body: "hi there" }),
        );
        expect(drainAnnouncement(s).text).toBe("Alice: hi there");
    });

    it("announces a message with no body as a generic arrival", () => {
        const s = recordArrival(
            EMPTY_ANNOUNCER,
            msg({ sender: "Alice", body: "" }),
        );
        expect(drainAnnouncement(s).text).toBe("Message from Alice");
    });

    it("truncates a very long body", () => {
        const long = "x".repeat(MAX_BODY_CHARS + 50);
        const s = recordArrival(EMPTY_ANNOUNCER, msg({ body: long }));
        const { text } = drainAnnouncement(s);
        expect(text.length).toBeLessThanOrEqual(MAX_BODY_CHARS + 30);
        expect(text.endsWith("…")).toBe(true);
    });

    it("summarises a burst from one sender by count", () => {
        let s = EMPTY_ANNOUNCER;
        s = recordArrival(s, msg({ eventId: "$1", sender: "Alice" }));
        s = recordArrival(s, msg({ eventId: "$2", sender: "Alice" }));
        s = recordArrival(s, msg({ eventId: "$3", sender: "Alice" }));
        expect(drainAnnouncement(s).text).toBe("3 new messages from Alice");
    });

    it("summarises a burst from several senders without naming them all", () => {
        let s = EMPTY_ANNOUNCER;
        s = recordArrival(s, msg({ eventId: "$1", sender: "Alice" }));
        s = recordArrival(s, msg({ eventId: "$2", sender: "Bob" }));
        expect(drainAnnouncement(s).text).toBe("2 new messages");
    });

    it("empties the queue so a second drain says nothing", () => {
        const s = recordArrival(EMPTY_ANNOUNCER, msg());
        const { state } = drainAnnouncement(s);
        expect(drainAnnouncement(state).text).toBe("");
    });

    it("bounds the remembered-id set so a long session cannot grow forever", () => {
        let s = EMPTY_ANNOUNCER;
        for (let i = 0; i < 500; i++) {
            s = recordArrival(s, msg({ eventId: `$${i}` }));
            s = drainAnnouncement(s).state;
        }
        expect(s.seen.length).toBeLessThanOrEqual(200);
    });

    it("exposes a debounce window long enough to coalesce a burst", () => {
        expect(ANNOUNCE_DEBOUNCE_MS).toBeGreaterThanOrEqual(500);
    });

    it("collapses newlines and runs of spaces so a paste is not a run-on", () => {
        const s = recordArrival(
            EMPTY_ANNOUNCER,
            msg({ sender: "Alice", body: "  line one\n\nline   two  " }),
        );
        expect(drainAnnouncement(s).text).toBe("Alice: line one line two");
    });
});

describe("shouldAnnounceDecrypted", () => {
    it("announces a message that arrived live after the initial sync", () => {
        expect(
            shouldAnnounceDecrypted({
                isLiveAppend: true,
                arrivedDuringInitialSync: false,
            }),
        ).toBe(true);
    });

    it("stays silent for history decrypted during scrollback or a key import", () => {
        // Not a live tail append: the ciphertext came from backfill or a
        // mid-timeline insert, so decrypting it is not a new arrival.
        expect(
            shouldAnnounceDecrypted({
                isLiveAppend: false,
                arrivedDuringInitialSync: false,
            }),
        ).toBe(false);
    });

    it("stays silent for the page-load backlog, which decrypts after sync", () => {
        // The whole replayed backlog is "live" by the SDK's flag; announcing it
        // would read the visible history out on every reload.
        expect(
            shouldAnnounceDecrypted({
                isLiveAppend: true,
                arrivedDuringInitialSync: true,
            }),
        ).toBe(false);
    });
});
