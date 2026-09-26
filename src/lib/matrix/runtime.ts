/**
 * The runtime slot: the ONE module-level Matrix client, its sync store, and
 * the ownership generation that guards both across account switches.
 *
 * Split out of `client.ts` (audit ARCH-01) so the slot has a single writer
 * API and no Svelte/store/toast dependencies. `client.ts`, `crypto.ts` and
 * `pluginHost.ts` read the slot through the live bindings / accessors below;
 * only the install/release helpers write it.
 */
import type { IndexedDBStore, MatrixClient } from "matrix-js-sdk";
import {
    captureOwnership,
    nextGeneration,
    ownsRuntime,
    OWNERSHIP_LOST_MESSAGE,
    type ClientOwnership,
} from "$lib/utils/clientGeneration";

export let matrixClient: MatrixClient | null = null;
export let matrixStore: IndexedDBStore | null = null;
// Monotonic id of the CURRENT occupant of the `matrixClient` slot, bumped on
// every install and every release. An operation or listener that captured the
// pair {client, generation} at entry can re-check it after an await and refuse
// to act for an account that no longer owns the runtime.
export let clientGeneration = 0;

export function getClient(): MatrixClient | null {
    return matrixClient;
}

/** The live occupant of the slot — the read side of every ownership guard. */
export function readOwner(): {
    client: MatrixClient | null;
    generation: number;
} {
    return { client: matrixClient, generation: clientGeneration };
}

/** Snapshot the owner for an operation that spans awaits. */
export function captureClient(): ClientOwnership<MatrixClient> {
    if (!matrixClient) throw new Error("Not logged in");
    return captureOwnership(matrixClient, clientGeneration);
}

/** The captured client, or null once a successor has taken the slot. */
export function ownedClient(
    owner: ClientOwnership<MatrixClient>,
): MatrixClient | null {
    return ownsRuntime(owner, matrixClient, clientGeneration)
        ? owner.client
        : null;
}

/** As `ownedClient`, for operations whose caller must learn they aborted. */
export function ownedClientOrThrow(
    owner: ClientOwnership<MatrixClient>,
): MatrixClient {
    const client = ownedClient(owner);
    if (!client) throw new Error(OWNERSHIP_LOST_MESSAGE);
    return client;
}

/**
 * Invalidate every outstanding ownership token without touching the slot —
 * for a client that has been stopped but not yet replaced.
 */
export function retireClientGeneration(): void {
    clientGeneration = nextGeneration(clientGeneration);
}

/** Install `client` as the slot's new occupant under a fresh generation. */
export function installClient(client: MatrixClient): void {
    matrixClient = client;
    clientGeneration = nextGeneration(clientGeneration);
}

export function setMatrixStore(store: IndexedDBStore | null): void {
    matrixStore = store;
}

/**
 * Empty the slot (client AND store) and bump the generation. Returns the
 * store that was released so the caller can decide whether to destroy it.
 */
export function releaseClient(): IndexedDBStore | null {
    const store = matrixStore;
    matrixClient = null;
    matrixStore = null;
    clientGeneration = nextGeneration(clientGeneration);
    return store;
}
