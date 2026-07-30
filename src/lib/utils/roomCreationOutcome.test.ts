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

describe("followUpFailureMessage — copy that never claims the room failed", () => {
    it("says the room WAS created and the space link was not", () => {
        const msg = followUpFailureMessage(spaceTask, {
            data: { error: "You don't have permission" },
        });
        expect(msg).toContain("created");
        expect(msg).toContain("space");
        expect(msg).toContain("You don't have permission");
    });

    it("says the DM WAS created and only the DM list write failed", () => {
        const msg = followUpFailureMessage(dmTask, new Error("boom"));
        expect(msg).toContain("created");
        expect(msg.toLowerCase()).toContain("direct message");
        expect(msg).toContain("boom");
    });

    it("falls back to its own wording when the error carries nothing", () => {
        const msg = followUpFailureMessage(spaceTask, undefined);
        expect(msg.length).toBeGreaterThan(0);
        expect(msg).not.toContain("undefined");
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
    it("returns the stranded DM when the room is still usable", () => {
        const pending = createPendingFollowUps();
        pending.record(dmTask);
        expect(strandedDmRoom(pending, "@partner:hs", () => true)).toEqual(
            dmTask,
        );
    });

    it("returns null and forgets the room when it is no longer usable", () => {
        const pending = createPendingFollowUps();
        pending.record(dmTask);
        expect(strandedDmRoom(pending, "@partner:hs", () => false)).toBeNull();
        expect(pending.all()).toEqual([]);
    });

    it("returns null when nothing is pending for that partner", () => {
        const pending = createPendingFollowUps();
        expect(strandedDmRoom(pending, "@partner:hs", () => true)).toBeNull();
    });
});

describe("NO_FOLLOW_UP", () => {
    it("is the 'nothing to do' status", () => {
        expect(NO_FOLLOW_UP).toEqual({ status: "none" });
    });
});
