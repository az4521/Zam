/**
 * Pure MSC3381 poll logic: parsing poll content, building responses, and
 * aggregating response/end events into tallies. Both the stable (`m.poll.*`) and unstable
 * (`org.matrix.msc3381.poll.*`) event names and content keys are accepted,
 * since deployed clients (Element included) still send the unstable form.
 */

export const POLL_START_TYPES = [
    "org.matrix.msc3381.poll.start",
    "m.poll.start",
] as const;
export const POLL_RESPONSE_TYPES = [
    "org.matrix.msc3381.poll.response",
    "m.poll.response",
] as const;
export const POLL_END_TYPES = [
    "org.matrix.msc3381.poll.end",
    "m.poll.end",
] as const;

export function isPollStartEventType(type: string): boolean {
    return (POLL_START_TYPES as readonly string[]).includes(type);
}

export function isPollResponseEventType(type: string): boolean {
    return (POLL_RESPONSE_TYPES as readonly string[]).includes(type);
}

export function isPollEndEventType(type: string): boolean {
    return (POLL_END_TYPES as readonly string[]).includes(type);
}

export interface PollAnswer {
    id: string;
    text: string;
}

export interface PollStartData {
    question: string;
    answers: PollAnswer[];
    /** Undisclosed polls hide tallies until the poll is closed. */
    kind: "disclosed" | "undisclosed";
    maxSelections: number;
}

/** MSC3381 caps polls at 20 answers; excess answers are ignored. */
const MAX_ANSWERS = 20;

const DISCLOSED_KINDS = [
    "org.matrix.msc3381.poll.disclosed",
    "m.poll.disclosed",
];

/**
 * Extract the human-readable text from an MSC1767 extensible-event holder:
 * `org.matrix.msc1767.text` (string), `m.text` (string or content-block
 * array), or a plain `body` fallback.
 */
function extensibleText(holder: unknown): string | null {
    if (typeof holder !== "object" || holder === null) return null;
    const o = holder as Record<string, unknown>;
    const unstable = o["org.matrix.msc1767.text"];
    if (typeof unstable === "string") return unstable;
    const stable = o["m.text"];
    if (typeof stable === "string") return stable;
    if (Array.isArray(stable)) {
        const block = stable.find(
            (b) => typeof (b as { body?: unknown })?.body === "string",
        );
        if (block) return (block as { body: string }).body;
    }
    if (typeof o.body === "string") return o.body;
    return null;
}

function pollSubContent(
    content: unknown,
    keys: readonly string[],
): Record<string, unknown> | null {
    if (typeof content !== "object" || content === null) return null;
    for (const key of keys) {
        const sub = (content as Record<string, unknown>)[key];
        if (typeof sub === "object" && sub !== null)
            return sub as Record<string, unknown>;
    }
    return null;
}

/** Parse `m.poll.start` event content. Returns null when malformed. */
export function parsePollStart(content: unknown): PollStartData | null {
    const start = pollSubContent(content, POLL_START_TYPES);
    if (!start) return null;

    const question = extensibleText(start.question);
    if (!question) return null;

    if (!Array.isArray(start.answers)) return null;
    const answers: PollAnswer[] = [];
    for (const raw of start.answers) {
        const id = (raw as { id?: unknown })?.id;
        const text = extensibleText(raw);
        if (typeof id !== "string" || !id || !text) continue;
        answers.push({ id, text });
        if (answers.length >= MAX_ANSWERS) break;
    }
    if (answers.length === 0) return null;

    // Unknown/missing kinds are treated as undisclosed per the MSC, so a
    // client never reveals tallies the poll author meant to keep hidden.
    const kind = DISCLOSED_KINDS.includes(start.kind as string)
        ? "disclosed"
        : "undisclosed";

    const rawMax = start.max_selections;
    const maxSelections =
        typeof rawMax === "number" && Number.isInteger(rawMax) && rawMax >= 1
            ? rawMax
            : 1;

    return { question, answers, kind, maxSelections };
}

/**
 * Extract the selected answer ids from `m.poll.response` content.
 * Returns null when there is no well-formed answers array — per MSC3381
 * that response still counts as the user's latest action, spoiling
 * (retracting) any earlier vote.
 */
export function extractResponseAnswers(content: unknown): string[] | null {
    const response = pollSubContent(content, POLL_RESPONSE_TYPES);
    if (!response) return null;
    if (!Array.isArray(response.answers)) return null;
    return response.answers.filter((a): a is string => typeof a === "string");
}

/** Build a poll response in the same event-name family as the poll start. */
export function buildPollResponse(
    pollStartType: string,
    pollStartId: string,
    answerIds: string[],
): { eventType: string; content: Record<string, unknown> } {
    const stable = pollStartType === "m.poll.start";
    const responseKey = stable
        ? "m.poll.response"
        : "org.matrix.msc3381.poll.response";
    const textKey = stable ? "m.text" : "org.matrix.msc1767.text";
    return {
        eventType: responseKey,
        content: {
            [textKey]: stable
                ? [{ body: "Poll response", mimetype: "text/plain" }]
                : "Poll response",
            [responseKey]: { answers: [...new Set(answerIds)] },
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: pollStartId,
            },
        },
    };
}

export interface PollResponse {
    sender: string;
    ts: number;
    eventId: string;
    /** Selected answer ids, or null for a spoiled/malformed response. */
    answers: string[] | null;
}

export interface PollTally {
    /** Vote count per answer id — every poll answer is present, 0 included. */
    counts: Record<string, number>;
    /** Sum of all counted votes across answers. */
    totalVotes: number;
    /** Valid (non-spoiled) selections per user. */
    votesBySender: Record<string, string[]>;
    /** Answer ids with the highest count, in answer order; empty if no votes. */
    winners: string[];
}

/**
 * Aggregate poll responses per MSC3381:
 * - only each user's latest response counts (ties broken by event id);
 * - responses after `endTs` are ignored entirely (earlier ones still count);
 * - the selection is truncated to `max_selections` FIRST, then any unknown
 *   answer id remaining spoils the ENTIRE vote (the voter counts as having
 *   made no selection, not a vote for the valid ids they also picked);
 *   surviving duplicates are collapsed. A response with nothing left is a
 *   spoiled vote that retracts the user's earlier vote.
 */
export function aggregatePollVotes(
    start: PollStartData,
    responses: PollResponse[],
    endTs: number | null,
): PollTally {
    const validIds = new Set(start.answers.map((a) => a.id));

    // Latest in-time response per user.
    const latest = new Map<string, PollResponse>();
    for (const r of responses) {
        if (endTs !== null && r.ts > endTs) continue;
        const prev = latest.get(r.sender);
        if (
            !prev ||
            r.ts > prev.ts ||
            (r.ts === prev.ts && r.eventId > prev.eventId)
        ) {
            latest.set(r.sender, r);
        }
    }

    const counts: Record<string, number> = {};
    for (const a of start.answers) counts[a.id] = 0;
    const votesBySender: Record<string, string[]> = {};

    for (const [sender, r] of latest) {
        // MSC3381: truncate to max_selections FIRST, before any dedupe...
        const truncated = (r.answers ?? []).slice(0, start.maxSelections);
        // ...then any unknown id in what survives spoils the ENTIRE vote — the
        // voter counts as having made no selection, not a vote for the valid
        // ids they also picked.
        if (truncated.some((id) => !validIds.has(id))) continue; // spoiled
        const selection = [...new Set(truncated)]; // collapse surviving dupes
        if (selection.length === 0) continue; // empty/retracted — no vote
        votesBySender[sender] = selection;
        for (const id of selection) counts[id]++;
    }

    const totalVotes = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const max = Math.max(0, ...Object.values(counts));
    const winners =
        totalVotes === 0
            ? []
            : start.answers
                  .filter((a) => counts[a.id] === max)
                  .map((a) => a.id);

    return { counts, totalVotes, votesBySender, winners };
}

/**
 * Whether `sender` may close a poll created by `creator`: the creator
 * themselves, or anyone whose power level reaches the room's redact level
 * (MSC3381's proxy for "may moderate the poll").
 */
export function canEndPoll(
    sender: string,
    creator: string,
    powerLevels: {
        redact?: number;
        users?: Record<string, number>;
        users_default?: number;
    },
): boolean {
    if (sender === creator) return true;
    const senderLevel =
        powerLevels.users?.[sender] ?? powerLevels.users_default ?? 0;
    return senderLevel >= (powerLevels.redact ?? 50);
}

/**
 * The poll's effective end timestamp: the earliest end event from an
 * authorized sender, or null while the poll is still open.
 */
export function pickPollEndTs(
    ends: Array<{ sender: string; ts: number }>,
    isAuthorized: (sender: string) => boolean,
): number | null {
    let earliest: number | null = null;
    for (const end of ends) {
        if (!isAuthorized(end.sender)) continue;
        if (earliest === null || end.ts < earliest) earliest = end.ts;
    }
    return earliest;
}

export interface PollDraft {
    question: string;
    answers: string[];
    kind: "disclosed" | "undisclosed";
    maxSelections: number;
}

/** Trimmed, non-empty answers in order. */
function nonEmptyAnswers(answers: string[]): string[] {
    return answers.map((a) => a.trim()).filter((a) => a.length > 0);
}

export function validatePollDraft(
    draft: PollDraft,
): { ok: true } | { ok: false; reason: string } {
    if (!draft.question.trim()) return { ok: false, reason: "Add a question." };
    const answers = nonEmptyAnswers(draft.answers);
    if (answers.length < 2)
        return { ok: false, reason: "Add at least two options." };
    if (answers.length > MAX_ANSWERS)
        return { ok: false, reason: `At most ${MAX_ANSWERS} options.` };
    if (
        !Number.isInteger(draft.maxSelections) ||
        draft.maxSelections < 1 ||
        draft.maxSelections > answers.length
    )
        return { ok: false, reason: "Invalid number of selections." };
    return { ok: true };
}

export function draftToPollData(draft: PollDraft): PollStartData {
    const answers: PollAnswer[] = nonEmptyAnswers(draft.answers)
        .slice(0, MAX_ANSWERS)
        .map((text, i) => ({ id: String(i + 1), text }));
    const maxSelections = Math.min(
        Math.max(1, Math.trunc(draft.maxSelections)),
        answers.length || 1,
    );
    return {
        question: draft.question.trim(),
        answers,
        kind: draft.kind,
        maxSelections,
    };
}

export function buildPollStart(data: PollStartData): {
    eventType: string;
    content: Record<string, unknown>;
} {
    const kindKey =
        data.kind === "disclosed"
            ? "org.matrix.msc3381.poll.disclosed"
            : "org.matrix.msc3381.poll.undisclosed";
    const fallback = [
        data.question,
        ...data.answers.map((a, i) => `${i + 1}. ${a.text}`),
    ].join("\n");
    return {
        eventType: "org.matrix.msc3381.poll.start",
        content: {
            "org.matrix.msc3381.poll.start": {
                question: { "org.matrix.msc1767.text": data.question },
                kind: kindKey,
                max_selections: data.maxSelections,
                answers: data.answers.map((a) => ({
                    id: a.id,
                    "org.matrix.msc1767.text": a.text,
                })),
            },
            "org.matrix.msc1767.text": fallback,
        },
    };
}

export function buildPollEnd(
    pollStartId: string,
    text = "The poll has ended.",
): { eventType: string; content: Record<string, unknown> } {
    return {
        eventType: "org.matrix.msc3381.poll.end",
        content: {
            "org.matrix.msc3381.poll.end": {},
            "org.matrix.msc1767.text": text,
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: pollStartId,
            },
        },
    };
}
