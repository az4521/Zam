/**
 * Ownership tokens for the module-global Matrix client.
 *
 * `client.ts` keeps ONE client in a mutable module global, which a second
 * sign-in or a session teardown can replace at any await point. An operation
 * that guards the global once on entry and re-dereferences it afterwards can
 * therefore finish against a DIFFERENT account's client — uploading, sending,
 * or writing account data as somebody else (audit LIFE-03), or firing a
 * stopped client's listener against its successor (audit LIFE-02).
 *
 * The fix is to snapshot who owned the slot at entry and re-check that
 * snapshot before every post-await side effect. Identity alone is not enough:
 * it cannot distinguish "still mine" from "released, and nothing has taken
 * the slot yet", so a monotonic generation rides along with it.
 *
 * Deliberately generic over the client type and free of matrix-js-sdk imports
 * — the caller supplies its own opaque client object.
 */

/** A snapshot of who owned the client slot when an operation started. */
export interface ClientOwnership<C> {
    readonly client: C;
    readonly generation: number;
}

/** Rejection message for an operation abandoned because ownership changed. */
export const OWNERSHIP_LOST_MESSAGE =
    "Session changed before the operation finished";

/**
 * The generation to install next. Strictly increasing and never reused, so a
 * token captured before any slot transition can never match again.
 */
export function nextGeneration(current: number): number {
    return current + 1;
}

/** Snapshot the current owner, for an operation that spans awaits. */
export function captureOwnership<C>(
    client: C,
    generation: number,
): ClientOwnership<C> {
    return { client, generation };
}

/**
 * Whether `owner` still owns the runtime. BOTH halves must match: the
 * generation catches a slot that was released (and possibly re-filled), and
 * the identity catches a replacement that happens to share a number.
 */
export function ownsRuntime<C>(
    owner: ClientOwnership<C> | null | undefined,
    currentClient: C | null | undefined,
    currentGeneration: number,
): boolean {
    if (!owner) return false;
    if (currentClient === null || currentClient === undefined) return false;
    return (
        owner.generation === currentGeneration && owner.client === currentClient
    );
}

/**
 * Wrap a callback so it only runs while `owner` still owns the runtime.
 * `readCurrent` is re-read on every invocation — the slot can change between
 * two firings of the same listener.
 */
export function guardOwnership<C, A extends unknown[]>(
    owner: ClientOwnership<C>,
    readCurrent: () => { client: C | null; generation: number },
    fn: (...args: A) => void,
): (...args: A) => void {
    return (...args: A) => {
        const current = readCurrent();
        if (!ownsRuntime(owner, current.client, current.generation)) return;
        fn(...args);
    };
}
