import { describe, it, expect } from "vitest";
import {
    isPollStartEventType,
    isPollResponseEventType,
    isPollEndEventType,
    parsePollStart,
    extractResponseAnswers,
    aggregatePollVotes,
    canEndPoll,
    pickPollEndTs,
    buildPollResponse,
    validatePollDraft,
    draftToPollData,
    buildPollStart,
    buildPollEnd,
    affectsPollView,
    type PollStartData,
    type PollResponse,
    type PollDraft,
} from "./pollContent";

describe("buildPollResponse — stable and unstable payloads", () => {
    it("builds a stable m.reference response and deduplicates answers", () => {
        expect(
            buildPollResponse("m.poll.start", "$poll", ["a", "a", "b"]),
        ).toEqual({
            eventType: "m.poll.response",
            content: {
                "m.text": [{ body: "Poll response", mimetype: "text/plain" }],
                "m.poll.response": { answers: ["a", "b"] },
                "m.relates_to": {
                    rel_type: "m.reference",
                    event_id: "$poll",
                },
            },
        });
    });

    it("uses the deployed MSC3381 names for an unstable poll", () => {
        const result = buildPollResponse(
            "org.matrix.msc3381.poll.start",
            "$poll",
            [],
        );
        expect(result.eventType).toBe("org.matrix.msc3381.poll.response");
        expect(result.content["org.matrix.msc3381.poll.response"]).toEqual({
            answers: [],
        });
    });
});

// ── Event-type guards ───────────────────────────────────────────────────────

describe("poll event type guards — stable and unstable names", () => {
    it("recognizes poll start types", () => {
        expect(isPollStartEventType("org.matrix.msc3381.poll.start")).toBe(
            true,
        );
        expect(isPollStartEventType("m.poll.start")).toBe(true);
        expect(isPollStartEventType("m.room.message")).toBe(false);
        expect(isPollStartEventType("org.matrix.msc3381.poll.response")).toBe(
            false,
        );
    });

    it("recognizes poll response types", () => {
        expect(
            isPollResponseEventType("org.matrix.msc3381.poll.response"),
        ).toBe(true);
        expect(isPollResponseEventType("m.poll.response")).toBe(true);
        expect(isPollResponseEventType("m.poll.start")).toBe(false);
    });

    it("recognizes poll end types", () => {
        expect(isPollEndEventType("org.matrix.msc3381.poll.end")).toBe(true);
        expect(isPollEndEventType("m.poll.end")).toBe(true);
        expect(isPollEndEventType("m.poll.response")).toBe(false);
    });
});

// ── parsePollStart ──────────────────────────────────────────────────────────

function unstableStart(over: Record<string, unknown> = {}) {
    return {
        "org.matrix.msc3381.poll.start": {
            question: {
                "org.matrix.msc1767.text": "Best pet?",
                body: "Best pet?",
            },
            kind: "org.matrix.msc3381.poll.disclosed",
            max_selections: 1,
            answers: [
                { id: "cat", "org.matrix.msc1767.text": "Cat" },
                { id: "dog", "org.matrix.msc1767.text": "Dog" },
            ],
            ...over,
        },
        "org.matrix.msc1767.text": "Best pet?\n1. Cat\n2. Dog",
    };
}

describe("parsePollStart — MSC3381 poll start content", () => {
    it("parses the unstable (org.matrix.msc3381) form", () => {
        const poll = parsePollStart(unstableStart());
        expect(poll).not.toBeNull();
        expect(poll!.question).toBe("Best pet?");
        expect(poll!.answers).toEqual([
            { id: "cat", text: "Cat" },
            { id: "dog", text: "Dog" },
        ]);
        expect(poll!.kind).toBe("disclosed");
        expect(poll!.maxSelections).toBe(1);
    });

    it("parses the stable (m.poll.start) form with m.text content blocks", () => {
        const poll = parsePollStart({
            "m.poll.start": {
                question: { "m.text": [{ body: "Lunch?" }] },
                kind: "m.poll.undisclosed",
                max_selections: 2,
                answers: [
                    { id: "a", "m.text": [{ body: "Pizza" }] },
                    { id: "b", "m.text": [{ body: "Sushi" }] },
                ],
            },
        });
        expect(poll).not.toBeNull();
        expect(poll!.question).toBe("Lunch?");
        expect(poll!.answers).toEqual([
            { id: "a", text: "Pizza" },
            { id: "b", text: "Sushi" },
        ]);
        expect(poll!.kind).toBe("undisclosed");
        expect(poll!.maxSelections).toBe(2);
    });

    it("falls back to plain body for question/answer text", () => {
        const poll = parsePollStart({
            "org.matrix.msc3381.poll.start": {
                question: { body: "Q?" },
                answers: [{ id: "x", body: "X" }],
            },
        });
        expect(poll!.question).toBe("Q?");
        expect(poll!.answers).toEqual([{ id: "x", text: "X" }]);
    });

    it("treats unknown or missing kind as undisclosed (spec: maximum privacy)", () => {
        expect(
            parsePollStart(unstableStart({ kind: "com.example.custom" }))!.kind,
        ).toBe("undisclosed");
        expect(parsePollStart(unstableStart({ kind: undefined }))!.kind).toBe(
            "undisclosed",
        );
    });

    it("defaults invalid max_selections to 1", () => {
        expect(
            parsePollStart(unstableStart({ max_selections: 0 }))!.maxSelections,
        ).toBe(1);
        expect(
            parsePollStart(unstableStart({ max_selections: -3 }))!
                .maxSelections,
        ).toBe(1);
        expect(
            parsePollStart(unstableStart({ max_selections: "2" }))!
                .maxSelections,
        ).toBe(1);
        expect(
            parsePollStart(unstableStart({ max_selections: undefined }))!
                .maxSelections,
        ).toBe(1);
    });

    it("drops malformed answers and truncates to the spec cap of 20", () => {
        const many = Array.from({ length: 25 }, (_, i) => ({
            id: `a${i}`,
            "org.matrix.msc1767.text": `Answer ${i}`,
        }));
        const poll = parsePollStart(
            unstableStart({
                answers: [
                    { id: "ok", "org.matrix.msc1767.text": "Fine" },
                    { "org.matrix.msc1767.text": "No id" },
                    { id: "noText" },
                    ...many,
                ],
            }),
        );
        expect(poll!.answers[0]).toEqual({ id: "ok", text: "Fine" });
        expect(
            poll!.answers.some((a) => a.id === "noText" || a.text === "No id"),
        ).toBe(false);
        expect(poll!.answers.length).toBe(20);
    });

    it("returns null for malformed content", () => {
        expect(parsePollStart(null)).toBeNull();
        expect(parsePollStart("nope")).toBeNull();
        expect(parsePollStart({})).toBeNull();
        expect(parsePollStart({ "m.poll.start": {} })).toBeNull();
        // question missing
        expect(
            parsePollStart(unstableStart({ question: undefined })),
        ).toBeNull();
        // no valid answers
        expect(parsePollStart(unstableStart({ answers: [] }))).toBeNull();
        expect(
            parsePollStart(unstableStart({ answers: "not-a-list" })),
        ).toBeNull();
    });
});

// ── extractResponseAnswers ──────────────────────────────────────────────────

describe("extractResponseAnswers — MSC3381 poll response content", () => {
    it("reads answers from the unstable and stable keys", () => {
        expect(
            extractResponseAnswers({
                "org.matrix.msc3381.poll.response": { answers: ["cat"] },
            }),
        ).toEqual(["cat"]);
        expect(
            extractResponseAnswers({
                "m.poll.response": { answers: ["dog", "cat"] },
            }),
        ).toEqual(["dog", "cat"]);
    });

    it("returns null (spoiled) for missing or malformed answers", () => {
        expect(extractResponseAnswers({})).toBeNull();
        expect(extractResponseAnswers(null)).toBeNull();
        expect(
            extractResponseAnswers({
                "org.matrix.msc3381.poll.response": {},
            }),
        ).toBeNull();
        expect(
            extractResponseAnswers({
                "org.matrix.msc3381.poll.response": { answers: "cat" },
            }),
        ).toBeNull();
    });

    it("filters non-string entries", () => {
        expect(
            extractResponseAnswers({
                "org.matrix.msc3381.poll.response": {
                    answers: ["cat", 5, null, "dog"],
                },
            }),
        ).toEqual(["cat", "dog"]);
    });
});

// ── aggregatePollVotes ──────────────────────────────────────────────────────

const START: PollStartData = {
    question: "Best pet?",
    answers: [
        { id: "cat", text: "Cat" },
        { id: "dog", text: "Dog" },
        { id: "fish", text: "Fish" },
    ],
    kind: "disclosed",
    maxSelections: 1,
};

function resp(over: Partial<PollResponse>): PollResponse {
    return {
        sender: "@a:hs",
        ts: 1000,
        eventId: "$e1",
        answers: ["cat"],
        ...over,
    };
}

describe("aggregatePollVotes — MSC3381 vote aggregation", () => {
    it("counts one vote per user and includes zero-count answers", () => {
        const t = aggregatePollVotes(
            START,
            [
                resp({ sender: "@a:hs", answers: ["cat"] }),
                resp({ sender: "@b:hs", eventId: "$e2", answers: ["dog"] }),
                resp({ sender: "@c:hs", eventId: "$e3", answers: ["cat"] }),
            ],
            null,
        );
        expect(t.counts).toEqual({ cat: 2, dog: 1, fish: 0 });
        expect(t.totalVotes).toBe(3);
    });

    it("keeps only each user's latest vote (by origin_server_ts)", () => {
        const t = aggregatePollVotes(
            START,
            [
                resp({ ts: 1000, eventId: "$e1", answers: ["cat"] }),
                resp({ ts: 2000, eventId: "$e2", answers: ["dog"] }),
                resp({ ts: 1500, eventId: "$e3", answers: ["fish"] }),
            ],
            null,
        );
        expect(t.counts).toEqual({ cat: 0, dog: 1, fish: 0 });
        expect(t.votesBySender["@a:hs"]).toEqual(["dog"]);
    });

    it("breaks timestamp ties by higher event id (deterministic)", () => {
        const t = aggregatePollVotes(
            START,
            [
                resp({ ts: 1000, eventId: "$b", answers: ["dog"] }),
                resp({ ts: 1000, eventId: "$a", answers: ["cat"] }),
            ],
            null,
        );
        expect(t.counts.dog).toBe(1);
        expect(t.counts.cat).toBe(0);
    });

    it("treats a later spoiled vote as retracting the earlier vote", () => {
        const t = aggregatePollVotes(
            START,
            [
                resp({ ts: 1000, eventId: "$e1", answers: ["cat"] }),
                resp({ ts: 2000, eventId: "$e2", answers: null }),
            ],
            null,
        );
        expect(t.counts).toEqual({ cat: 0, dog: 0, fish: 0 });
        expect(t.totalVotes).toBe(0);
        expect(t.votesBySender["@a:hs"]).toBeUndefined();
    });

    it("spoils votes whose answers are all unknown ids", () => {
        const t = aggregatePollVotes(
            START,
            [resp({ answers: ["hamster"] })],
            null,
        );
        expect(t.totalVotes).toBe(0);
    });

    it("spoils the whole vote when ANY supplied answer is unknown (MSC3381)", () => {
        const multi = { ...START, maxSelections: 2 };
        // Both "ghost" (unknown) and "cat" (valid) survive the truncation to
        // max_selections, so the unknown id spoils the ENTIRE vote — the voter
        // counts as having made no selection, NOT a vote for the "cat" they
        // also picked.
        const t = aggregatePollVotes(
            multi,
            [resp({ answers: ["ghost", "cat"] })],
            null,
        );
        expect(t.votesBySender["@a:hs"]).toBeUndefined();
        expect(t.counts).toEqual({ cat: 0, dog: 0, fish: 0 });
        expect(t.totalVotes).toBe(0);
    });

    it("truncates to max_selections BEFORE deduping: ['cat','cat','dog'] max 2 → one vote for cat only", () => {
        const multi = { ...START, maxSelections: 2 };
        // Truncate first → ["cat","cat"], then dedupe → ["cat"]. Deduping
        // first would wrongly yield ["cat","dog"] and count a vote for dog too.
        const t = aggregatePollVotes(
            multi,
            [resp({ answers: ["cat", "cat", "dog"] })],
            null,
        );
        expect(t.votesBySender["@a:hs"]).toEqual(["cat"]);
        expect(t.counts).toEqual({ cat: 1, dog: 0, fish: 0 });
        expect(t.totalVotes).toBe(1);
    });

    it("truncates to max_selections first, so an unknown id inside that window spoils the vote", () => {
        const multi = { ...START, maxSelections: 2 };
        const t = aggregatePollVotes(
            multi,
            [
                resp({
                    answers: ["hamster", "cat", "cat", "dog", "fish"],
                }),
            ],
            null,
        );
        // truncate first → ["hamster","cat"]; the surviving unknown "hamster"
        // spoils the ENTIRE vote (dog/fish beyond the window never matter).
        expect(t.votesBySender["@a:hs"]).toBeUndefined();
        expect(t.counts).toEqual({ cat: 0, dog: 0, fish: 0 });
        expect(t.totalVotes).toBe(0);
    });

    it("ignores votes cast after the poll ended, keeping earlier ones", () => {
        const t = aggregatePollVotes(
            START,
            [
                resp({ ts: 1000, eventId: "$e1", answers: ["cat"] }),
                resp({ ts: 3000, eventId: "$e2", answers: ["dog"] }),
                resp({
                    sender: "@late:hs",
                    ts: 4000,
                    eventId: "$e3",
                    answers: ["fish"],
                }),
            ],
            2000,
        );
        // @a's post-end vote is ignored entirely — their 1000ts vote stands
        expect(t.counts).toEqual({ cat: 1, dog: 0, fish: 0 });
    });

    it("counts a vote landing exactly on the end timestamp", () => {
        const t = aggregatePollVotes(
            START,
            [resp({ ts: 2000, answers: ["cat"] })],
            2000,
        );
        expect(t.counts.cat).toBe(1);
    });

    it("computes winners in answer order, including ties", () => {
        const t = aggregatePollVotes(
            START,
            [
                resp({ sender: "@a:hs", answers: ["dog"] }),
                resp({ sender: "@b:hs", eventId: "$e2", answers: ["fish"] }),
            ],
            null,
        );
        expect(t.winners).toEqual(["dog", "fish"]);
    });

    it("has no winners when nobody voted", () => {
        const t = aggregatePollVotes(START, [], null);
        expect(t.winners).toEqual([]);
        expect(t.totalVotes).toBe(0);
        expect(t.counts).toEqual({ cat: 0, dog: 0, fish: 0 });
    });
});

// ── canEndPoll / pickPollEndTs ──────────────────────────────────────────────

describe("canEndPoll — who may close a poll", () => {
    it("lets the poll creator close their own poll regardless of power", () => {
        // creator, effective PL 0, redact 50 → still allowed (creator short-circuit)
        expect(canEndPoll("@me:hs", "@me:hs", 0, 50)).toBe(true);
    });
    it("lets a non-creator who reaches the redact level close it", () => {
        expect(canEndPoll("@mod:hs", "@creator:hs", 50, 50)).toBe(true);
    });
    it("denies a non-creator below the redact level", () => {
        expect(canEndPoll("@user:hs", "@creator:hs", 49, 50)).toBe(false);
    });
    it("denies a non-creator with no power (default 0)", () => {
        expect(canEndPoll("@rando:hs", "@creator:hs", 0, 50)).toBe(false);
    });
    // S-A1: a room-v12 creator who did NOT start this poll — the caller passes
    // their effective power (CREATOR_POWER_LEVEL 100 via getUserPowerLevel), so
    // they clear the redact gate even though they aren't the poll creator.
    it("lets a room-v12 creator close someone else's poll via effective power", () => {
        expect(canEndPoll("@roomcreator:hs", "@polluser:hs", 100, 50)).toBe(
            true,
        );
    });
});

describe("pickPollEndTs — earliest authorized end event wins", () => {
    it("returns the earliest authorized end timestamp", () => {
        const ends = [
            { sender: "@creator:hs", ts: 3000 },
            { sender: "@creator:hs", ts: 2000 },
        ];
        expect(pickPollEndTs(ends, () => true)).toBe(2000);
    });

    it("ignores unauthorized senders", () => {
        const ends = [
            { sender: "@troll:hs", ts: 1000 },
            { sender: "@creator:hs", ts: 2000 },
        ];
        expect(pickPollEndTs(ends, (s) => s === "@creator:hs")).toBe(2000);
    });

    it("returns null when there is no valid end", () => {
        expect(pickPollEndTs([], () => true)).toBeNull();
        expect(
            pickPollEndTs([{ sender: "@troll:hs", ts: 1 }], () => false),
        ).toBeNull();
    });
});

// ── validatePollDraft / draftToPollData / buildPollStart / buildPollEnd ───────

describe("validatePollDraft", () => {
    const base: PollDraft = {
        question: "Lunch?",
        answers: ["Pizza", "Tacos"],
        kind: "disclosed",
        maxSelections: 1,
    };
    it("accepts a well-formed draft", () => {
        expect(validatePollDraft(base)).toEqual({ ok: true });
    });
    it("rejects an empty question", () => {
        expect(validatePollDraft({ ...base, question: "   " }).ok).toBe(false);
    });
    it("rejects fewer than two non-empty answers", () => {
        expect(
            validatePollDraft({ ...base, answers: ["Pizza", "   "] }).ok,
        ).toBe(false);
    });
    it("rejects more than 20 answers", () => {
        expect(
            validatePollDraft({
                ...base,
                answers: Array.from({ length: 21 }, (_, i) => `a${i}`),
            }).ok,
        ).toBe(false);
    });
    it("rejects maxSelections below 1 or above the answer count", () => {
        expect(validatePollDraft({ ...base, maxSelections: 0 }).ok).toBe(false);
        expect(validatePollDraft({ ...base, maxSelections: 3 }).ok).toBe(false);
    });
});

describe("buildPollStart / draftToPollData", () => {
    const draft: PollDraft = {
        question: "Lunch?",
        answers: ["Pizza", "  Tacos  ", "  "],
        kind: "undisclosed",
        maxSelections: 2,
    };
    it("round-trips through parsePollStart", () => {
        const data = draftToPollData(draft);
        const { content } = buildPollStart(data);
        const parsed = parsePollStart(content);
        expect(parsed?.question).toBe("Lunch?");
        expect(parsed?.answers.map((a) => a.text)).toEqual(["Pizza", "Tacos"]);
        expect(parsed?.kind).toBe("undisclosed");
        expect(parsed?.maxSelections).toBe(2);
    });
    it("uses the unstable poll.start event type", () => {
        const { eventType } = buildPollStart(draftToPollData(draft));
        expect(eventType).toBe("org.matrix.msc3381.poll.start");
    });
});

describe("buildPollEnd", () => {
    it("references the poll start via m.reference", () => {
        const { eventType, content } = buildPollEnd("$poll1");
        expect(eventType).toBe("org.matrix.msc3381.poll.end");
        expect((content as any)["m.relates_to"]).toEqual({
            rel_type: "m.reference",
            event_id: "$poll1",
        });
    });
});

describe("affectsPollView", () => {
    it("matches poll response and end events (both namespaces)", () => {
        expect(affectsPollView("m.poll.response", undefined)).toBe(true);
        expect(
            affectsPollView("org.matrix.msc3381.poll.response", undefined),
        ).toBe(true);
        expect(affectsPollView("m.poll.end", undefined)).toBe(true);
        expect(affectsPollView("org.matrix.msc3381.poll.end", undefined)).toBe(
            true,
        );
    });
    it("matches a poll-start edit (m.replace) so the view re-renders", () => {
        expect(affectsPollView("m.poll.start", "m.replace")).toBe(true);
        expect(
            affectsPollView("org.matrix.msc3381.poll.start", "m.replace"),
        ).toBe(true);
    });
    it("ignores a brand-new poll start (no m.replace relation)", () => {
        expect(affectsPollView("m.poll.start", undefined)).toBe(false);
        expect(
            affectsPollView("org.matrix.msc3381.poll.start", "m.reference"),
        ).toBe(false);
    });
    it("ignores unrelated events and unrelated relations", () => {
        expect(affectsPollView("m.room.message", "m.replace")).toBe(false);
        expect(affectsPollView("m.reaction", "m.annotation")).toBe(false);
    });
});
