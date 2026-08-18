export interface ReconcileReloadInput {
    /** Server-joined rooms still missing locally AFTER an in-place heal attempt. */
    stillMissing: string[];
    /** Room ids we have already cache-wipe-reloaded for (persisted across boots). */
    reloadedRooms: string[];
}

export interface ReconcileReloadPlan {
    /** Whether to cache-wipe-and-reload now. */
    reload: boolean;
    /** The reloaded-rooms set to persist (unchanged when not reloading). */
    nextReloadedRooms: string[];
}

/**
 * Decide whether a joined-rooms mismatch warrants a cache-wipe reload.
 *
 * A reload is worth trying only for a room we have NOT reloaded for before: a
 * genuinely poisoned cache may deliver it on a fresh sync. A room already in
 * `reloadedRooms` has proven a reload does not fix it (a continuwuity phantom:
 * the server reports it joined but never delivers the room), so we never reload
 * for it again — that repeat reload is the boot "Restoring session…" double-flash.
 *
 * The fresh rooms are recorded in `nextReloadedRooms` BEFORE the reload, so the
 * post-reload boot (where they may still be missing) sees them as known and does
 * not reload a second time.
 */
export function planReconcileReload(
    input: ReconcileReloadInput,
): ReconcileReloadPlan {
    const known = new Set(input.reloadedRooms);
    const fresh: string[] = [];
    for (const id of input.stillMissing) {
        if (!known.has(id)) {
            known.add(id);
            fresh.push(id);
        }
    }
    if (fresh.length === 0) {
        return { reload: false, nextReloadedRooms: input.reloadedRooms };
    }
    return {
        reload: true,
        nextReloadedRooms: [...input.reloadedRooms, ...fresh],
    };
}
