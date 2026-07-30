import { describe, it, expect, vi } from "vitest";
import {
    createPendingFollowUps,
    followUpFailureMessage,
    runFollowUp,
    strandedDmRoom,
    NO_FOLLOW_UP,
    type RoomFollowUpTask,
} from "./roomCreationOutcome";

const spaceTask: RoomFollowUpTask = {
    kind: "space-link",
    roomId: "!new:hs",
    spaceId: "!space:hs",
};
const dmTask: RoomFollowUpTask = {
    kind: "dm-account-data",
    roomId: "!dm:hs",
    userId: "@partner:hs",
};

/**
 * The lie TX-01 is about: copy that tells the user the room does not exist,
 * sending them off to create a duplicate. `toContain("created")` does NOT
 * catch this — "could not be created" contains "created".
 */
const CLAIMS_CREATION_FAILED =
    /(could not|couldn'?t|failed to|unable to)\s+(be\s+)?creat/i;
/** The other lie: copy implying the follow-up landed, so nothing needs retrying. */
const CLAIMS_SPACE_LINKED =
    /\b(was|were|has been|have been|and)\s+added to the space/i;
const CLAIMS_DM_SAVED =
    /\b(was|were|has been|have been|and)\s+(saved|added) to your DM list/i;

describe("followUpFailureMessage — copy that never claims the room failed", () => {
    it("says the room WAS created and the space link was not", () => {
        const msg = followUpFailureMessage(spaceTask, {
            data: { error: "You don't have permission" },
        });
        expect(msg).toMatch(/room was created/i);
        expect(msg).not.toMatch(CLAIMS_CREATION_FAILED);
        expect(msg).not.toMatch(CLAIMS_SPACE_LINKED);
        expect(msg).toContain("space");
        // names the link as the thing that failed
        expect(msg).toMatch(/fail|could not|couldn'?t/i);
        expect(msg).toContain("You don't have permission");
    });

    it("says the DM WAS created and only the DM list write failed", () => {
        const msg = followUpFailureMessage(dmTask, new Error("boom"));
        expect(msg).toMatch(/direct message was created/i);
        expect(msg).not.toMatch(CLAIMS_CREATION_FAILED);
        expect(msg).not.toMatch(CLAIMS_DM_SAVED);
        expect(msg.toLowerCase()).toContain("direct message");
        expect(msg).toMatch(/fail|could not|couldn'?t/i);
        expect(msg).toContain("boom");
    });

    it("falls back to its own wording when the error carries nothing", () => {
        const msg = followUpFailureMessage(spaceTask, undefined);
        expect(msg.length).toBeGreaterThan(0);
        expect(msg).not.toContain("undefined");
        expect(msg).toMatch(/room was created/i);
        expect(msg).not.toMatch(CLAIMS_CREATION_FAILED);
        expect(msg).not.toMatch(CLAIMS_SPACE_LINKED);
    });

    it("separates the server's fragment from the sentence after it", () => {
        const msg = followUpFailureMessage(dmTask, {
            data: { error: "You don't have permission" },
        });
        expect(msg).toContain("You don't have permission. It may appear");
        // an already-punctuated server message is not double-punctuated
        expect(followUpFailureMessage(spaceTask, new Error("Bad."))).toContain(
            "Bad.",
        );
        expect(
            followUpFailureMessage(spaceTask, new Error("Bad.")),
        ).not.toContain("Bad..");
    });
});

describe("runFollowUp — the outcome always matches what the write actually did", () => {
    it("reports ok only when the write resolves", async () => {
        const pending = createPendingFollowUps();
        const write = vi.fn().mockResolvedValue(undefined);
        const out = await runFollowUp(spaceTask, write, pending);
        expect(out).toEqual({ status: "ok" });
        expect(write).toHaveBeenCalledWith(spaceTask);
        expect(pending.all()).toEqual([]);
    });

    it("reports failed and remembers the task when the write rejects", async () => {
        const pending = createPendingFollowUps();
        const write = vi.fn().mockRejectedValue(new Error("nope"));
        const out = await runFollowUp(spaceTask, write, pending);
        expect(out.status).toBe("failed");
        if (out.status !== "failed") throw new Error("unreachable");
        expect(out.task).toEqual(spaceTask);
        expect(out.message).toContain("nope");
        expect(pending.all()).toEqual([spaceTask]);
    });

    it("clears a previously remembered task when a retry succeeds", async () => {
        const pending = createPendingFollowUps();
        await runFollowUp(
            dmTask,
            () => Promise.reject(new Error("x")),
            pending,
        );
        expect(pending.all()).toHaveLength(1);
        const out = await runFollowUp(dmTask, () => Promise.resolve(), pending);
        expect(out).toEqual({ status: "ok" });
        expect(pending.all()).toEqual([]);
    });

    it("does not report ok when the write throws synchronously", async () => {
        const pending = createPendingFollowUps();
        const out = await runFollowUp(
            dmTask,
            () => {
                throw new Error("sync boom");
            },
            pending,
        );
        expect(out.status).toBe("failed");
        expect(pending.all()).toEqual([dmTask]);
    });
});

describe("pending registry", () => {
    it("keeps one entry per room and overwrites on re-record", () => {
        const pending = createPendingFollowUps();
        pending.record(dmTask);
        pending.record(dmTask);
        expect(pending.all()).toEqual([dmTask]);
    });

    it("clear() removes only the named room", () => {
        const pending = createPendingFollowUps();
        pending.record(dmTask);
        pending.record(spaceTask);
        pending.clear(dmTask.roomId);
        expect(pending.all()).toEqual([spaceTask]);
    });

    it("findDm matches on the partner, never on a space link", () => {
        const pending = createPendingFollowUps();
        pending.record(spaceTask);
        expect(pending.findDm("@partner:hs")).toBeNull();
        pending.record(dmTask);
        expect(pending.findDm("@partner:hs")).toEqual(dmTask);
        expect(pending.findDm("@someone-else:hs")).toBeNull();
    });
});

describe("strandedDmRoom — a retry must reuse the room, not create a second one", () => {
    it("returns the stranded DM when the room is not gone", () => {
        const pending = createPendingFollowUps();
        pending.record(dmTask);
        expect(strandedDmRoom(pending, "@partner:hs", () => false)).toEqual(
            dmTask,
        );
    });

    /**
     * The exact window TX-01 lives in. `createRoom` is a bare POST: the SDK
     * stores no Room and emits no ClientEvent.Room, so `getRoom()` is null from
     * the moment it resolves until /sync delivers the room. If "I have not seen
     * this room" counted as "gone", the pending record would be destroyed
     * precisely during the immediate retry it exists to serve — and the retry
     * would create a second room and a second invite.
     */
    it("still hands back a room the client has not seen yet, and keeps remembering it", () => {
        const pending = createPendingFollowUps();
        pending.record(dmTask);
        // "not gone" is what an unknown room reports: absence of evidence that
        // we left, NOT evidence of absence.
        const seen: string[] = [];
        const out = strandedDmRoom(pending, "@partner:hs", (id) => {
            seen.push(id);
            return false;
        });
        expect(out).toEqual(dmTask);
        expect(seen).toEqual([dmTask.roomId]);
        expect(pending.all()).toEqual([dmTask]);
    });

    it("returns null and forgets a room we have definitively left", () => {
        const pending = createPendingFollowUps();
        pending.record(dmTask);
        expect(strandedDmRoom(pending, "@partner:hs", () => true)).toBeNull();
        expect(pending.all()).toEqual([]);
    });

    it("returns null when nothing is pending for that partner", () => {
        const pending = createPendingFollowUps();
        expect(strandedDmRoom(pending, "@partner:hs", () => false)).toBeNull();
    });
});

describe("NO_FOLLOW_UP", () => {
    it("is the 'nothing to do' status", () => {
        expect(NO_FOLLOW_UP).toEqual({ status: "none" });
    });
});
