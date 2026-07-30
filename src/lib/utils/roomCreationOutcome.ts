import { matrixErrorMessage } from "./knock";

/**
 * A creation follow-up that can be retried on its own, WITHOUT creating a
 * second room. Every variant carries the id of the room that already exists.
 */
export type RoomFollowUpTask =
    | { kind: "space-link"; roomId: string; spaceId: string }
    | { kind: "dm-account-data"; roomId: string; userId: string };

export type DmFollowUpTask = Extract<
    RoomFollowUpTask,
    { kind: "dm-account-data" }
>;

/**
 * What happened to the follow-up AFTER the room itself was created. `"none"`
 * means there was nothing to do (e.g. a room created outside any space).
 * A creation that never happened is a rejection, not a status — the two cases
 * must stay distinguishable.
 */
export type RoomFollowUp =
    | { status: "none" }
    | { status: "ok" }
    | { status: "failed"; task: RoomFollowUpTask; message: string };

export interface RoomCreationResult {
    roomId: string;
    followUp: RoomFollowUp;
}

/**
 * Frozen: a single `{status:"none"}` object is shared by every no-follow-up
 * result in the app, so a consumer that drops it into `$state` and mutates it
 * would otherwise corrupt every other result that aliases it.
 */
export const NO_FOLLOW_UP: RoomFollowUp = Object.freeze({
    status: "none",
} as const);

/**
 * The server's own wording, punctuated so it can be joined into a sentence.
 * `matrixErrorMessage` returns a bare fragment ("You don't have permission"),
 * which would otherwise run straight into the sentence that follows it.
 */
function detailSentence(err: unknown): string {
    const detail = matrixErrorMessage(err, "the server rejected the change");
    return /[.!?]$/.test(detail) ? detail : `${detail}.`;
}

/**
 * User-facing copy for a failed follow-up. Two invariants, both load-bearing
 * for TX-01 and both pinned by tests:
 *  - it must never read as "the room could not be created" — the room exists,
 *    and telling the user otherwise is what makes them retry into a duplicate;
 *  - it must never read as though the follow-up landed, or the user won't know
 *    to retry it.
 */
export function followUpFailureMessage(
    task: RoomFollowUpTask,
    err: unknown,
): string {
    if (task.kind === "space-link") {
        return `The room was created, but adding it to the space failed: ${detailSentence(err)}`;
    }
    return `The direct message was created, but saving it to your DM list failed: ${detailSentence(err)} It may appear as a normal room until this is retried.`;
}

/**
 * In-session memory of follow-ups that failed, keyed by the room they belong to.
 *
 * INVARIANT: at most ONE pending follow-up per room. A room is created either
 * into a space or as a DM, never both, so the two kinds never collide today.
 * If that ever stops being true, `record` would silently drop the first kind
 * and a success on one kind would clear the other — key by `roomId + kind` then.
 */
export interface PendingFollowUps {
    /** Records this room's follow-up, replacing any previous one for the room. */
    record(task: RoomFollowUpTask): void;
    clear(roomId: string): void;
    /** The pending DM follow-up for this partner, if any. */
    findDm(userId: string): DmFollowUpTask | null;
    /** Everything still pending, for tests and diagnostics. */
    all(): RoomFollowUpTask[];
}

export function createPendingFollowUps(): PendingFollowUps {
    const byRoom = new Map<string, RoomFollowUpTask>();
    return {
        record(task) {
            byRoom.set(task.roomId, task);
        },
        clear(roomId) {
            byRoom.delete(roomId);
        },
        findDm(userId) {
            for (const task of byRoom.values())
                if (task.kind === "dm-account-data" && task.userId === userId)
                    return task;
            return null;
        },
        all() {
            return [...byRoom.values()];
        },
    };
}

/**
 * Run one follow-up write and report EXACTLY what it did. Success clears any
 * earlier pending record for that room; failure records it so a later attempt
 * can reuse the room instead of creating another one.
 */
export async function runFollowUp(
    task: RoomFollowUpTask,
    write: (task: RoomFollowUpTask) => Promise<void>,
    pending: PendingFollowUps,
): Promise<RoomFollowUp> {
    try {
        await write(task);
    } catch (err) {
        pending.record(task);
        return {
            status: "failed",
            task,
            message: followUpFailureMessage(task, err),
        };
    }
    pending.clear(task.roomId);
    return { status: "ok" };
}

/**
 * A DM room we created earlier whose `m.direct` write failed is invisible to
 * the `m.direct` reuse check — so without this, the obvious retry creates a
 * SECOND room and a second invite.
 *
 * `isGone` asks the NARROW question "have we definitively left this room?" —
 * never the broad "is this room usable?". The difference is the whole bug:
 * `createRoom` is a bare POST, so the SDK holds no Room and `getRoom()` returns
 * null from the moment it resolves until `/sync` delivers the room. A room the
 * client has not seen yet is therefore NOT gone — it is a room we created
 * moments ago, and forgetting it destroys the recovery record exactly during
 * the immediate retry it exists to serve. Anything short of proof that the room
 * is gone must keep the task, so UNKNOWN means still-pending.
 */
export function strandedDmRoom(
    pending: PendingFollowUps,
    userId: string,
    isGone: (roomId: string) => boolean,
): DmFollowUpTask | null {
    const task = pending.findDm(userId);
    if (!task) return null;
    if (isGone(task.roomId)) {
        pending.clear(task.roomId);
        return null;
    }
    return task;
}
