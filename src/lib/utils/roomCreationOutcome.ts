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
    | { status: "failed"; task: RoomFollowUpTask; message: string }
    /**
     * The write outlived our patience without settling. NOT a synonym for
     * `"failed"`: it may still land. Carries the task so the user keeps a
     * retry, but the copy must never state an outcome we do not have.
     */
    | { status: "unconfirmed"; task: RoomFollowUpTask; message: string };

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
 * User-facing copy for a follow-up write that is STILL IN FLIGHT past the
 * point where we keep waiting. Three invariants, all pinned by tests:
 *  - the room exists (same as the failure copy — never send them back to the
 *    form to create a duplicate);
 *  - it must not claim the follow-up failed: the request is still running and
 *    may yet land, and a false "failed" is just the TX-01 lie in a new place;
 *  - it must not claim it landed either, or the user won't know to retry.
 */
export function followUpTimeoutMessage(task: RoomFollowUpTask): string {
    if (task.kind === "space-link") {
        return "The room was created, but adding it to the space hasn't been confirmed yet — it may still be saving. Retry if the room doesn't show up in the space.";
    }
    return "The direct message was created, but saving it to your DM list hasn't been confirmed yet — it may still be saving. Retry if it doesn't show up in your DM list.";
}

/**
 * How long a retried follow-up write may stay in flight before we stop
 * claiming to know what happened.
 *
 * `setAccountData` (matrix-js-sdk 41) awaits the `/sync` remote echo after the
 * PUT with no timeout of its own, so a wedged sync — the very condition that
 * failed the original write — makes the retry hang forever. The toast that
 * carried the Retry button is long gone by then, so an unbounded wait leaves
 * the user with no recovery affordance and no signal at all.
 *
 * Matches the live-share stop watchdog (`STOP_WATCHDOG_MS`) for the same
 * reason: it is how long a human will believe "working on it".
 */
export const FOLLOW_UP_RETRY_TIMEOUT_MS = 30000;

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
    /**
     * Forget everything. Every record belongs to the account that made it, so
     * a registry that survives into a different session is a cross-account
     * leak waiting to happen — `findDm` matches on the partner id alone and
     * cannot tell whose room it is handing back.
     */
    reset(): void;
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
        reset() {
            byRoom.clear();
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
 * `runFollowUp` with a deadline. Past `timeoutMs` it reports `"unconfirmed"` —
 * a statement about what WE know, never a verdict on the write, which keeps
 * running and keeps its own claim on the outcome: if it lands afterwards it
 * still clears the pending record, and if it rejects it still records one.
 *
 * The task is recorded on timeout so the room stays reusable: an unconfirmed
 * write may not have landed, and forgetting the room is what makes the next
 * attempt create a second one.
 */
export async function runFollowUpBounded(
    task: RoomFollowUpTask,
    write: (task: RoomFollowUpTask) => Promise<void>,
    pending: PendingFollowUps,
    timeoutMs: number = FOLLOW_UP_RETRY_TIMEOUT_MS,
): Promise<RoomFollowUp> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<RoomFollowUp>((resolve) => {
        timer = setTimeout(() => {
            pending.record(task);
            resolve({
                status: "unconfirmed",
                task,
                message: followUpTimeoutMessage(task),
            });
        }, timeoutMs);
    });
    try {
        // runFollowUp never rejects, so the losing side of this race can never
        // surface as an unhandled rejection.
        return await Promise.race([
            runFollowUp(task, write, pending),
            deadline,
        ]);
    } finally {
        clearTimeout(timer);
    }
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
/**
 * The `isGone` predicate for {@link strandedDmRoom}, over a room's local
 * membership (`undefined` when the client holds no Room for it).
 *
 * Both halves are load-bearing and both are pinned by tests:
 *  - `!== undefined` — a room we have never seen is NOT gone. `createRoom` is a
 *    bare POST that stores no Room, so membership is undefined from the moment
 *    creation resolves until /sync delivers the room, which is exactly the
 *    window the recovery retry runs in. Dropping the `undefined` check reads an
 *    unknown room as gone, destroys the pending record, and the retry creates a
 *    second room plus a second invite — the TX-01 bug, restored.
 *  - `!== "join"` — anything else (left, kicked, banned, still only invited) is
 *    proof we are not in the room, so there is nothing to reuse.
 */
export function isRoomGone(membership: string | undefined): boolean {
    return membership !== undefined && membership !== "join";
}

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
