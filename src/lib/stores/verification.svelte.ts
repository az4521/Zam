import {
    startDeviceVerification,
    startUserVerification,
    onIncomingVerificationRequest,
    getPendingVerificationControllers,
    type VerificationController,
} from "$lib/matrix/crypto";
import {
    acceptFailureText,
    verificationPhaseKind,
} from "$lib/utils/verification";

// SAS (emoji) verification state. Two surfaces:
//   • `active` — the one flow shown in the VerificationModal (self- or
//     cross-user), whether we started it or accepted an incoming request.
//   • `incoming` — a queue of received requests we haven't accepted yet, each
//     rendered as a stacked card (mirrors the incoming-call cards).
// Live controllers hide the raw SDK objects; `verificationTick` bumps on every
// controller change so `$derived`s that read `controller.view()` re-run.
class VerificationStore {
    verificationTick = $state(0);
    active = $state<VerificationController | null>(null);
    incoming = $state<VerificationController[]>([]);
    /** Request id whose accept() is in flight, if any. */
    accepting = $state<string | null>(null);
    /** Per-request accept failure copy, keyed by request id. Real failures only. */
    acceptErrors = $state<Record<string, string>>({});
    /**
     * Request whose Verify was refused because `accepting` was busy. A marker,
     * not stored copy: the refusal is only true while that other accept is in
     * flight, so it has to die with it (see `setAccepting`).
     */
    busyRefusalId = $state<string | null>(null);
}

export const verificationState = new VerificationStore();

/**
 * Refusal copy for a Verify click that lands while a DIFFERENT request's accept
 * is in flight. It lives here rather than in `utils/verification` because it
 * describes this store's one-at-a-time rule, not anything about a request.
 */
const ACCEPT_BUSY_TEXT = "Finishing another verification first. Try again.";

function bump(): void {
    verificationState.verificationTick++;
}

/**
 * The ONLY writer of `accepting`. Clearing the gate also drops any busy refusal
 * it caused — routing both through here is what stops them drifting into
 * "Finishing another verification first" sitting on a card with nothing in
 * flight.
 */
function setAccepting(id: string | null): void {
    verificationState.accepting = id;
    if (id === null) verificationState.busyRefusalId = null;
}

/** Release the gate, but only if it is still ours — see `removeIncoming`. */
function releaseAccepting(id: string): void {
    if (verificationState.accepting === id) setAccepting(null);
}

/** Is this flow finished (verified or cancelled)? */
function isTerminal(controller: VerificationController): boolean {
    const kind = verificationPhaseKind(controller.view().phase);
    return kind === "success" || kind === "cancelled";
}

/**
 * Subscribe a controller so its changes bump the tick. `onChange` runs after
 * the bump for extra bookkeeping (e.g. pruning a finished incoming card).
 */
function track(
    controller: VerificationController,
    onChange?: () => void,
): () => void {
    return controller.subscribe(() => {
        bump();
        onChange?.();
    });
}

/** Drop an incoming request from the queue (does not cancel it). */
function removeIncoming(controller: VerificationController): void {
    verificationState.incoming = verificationState.incoming.filter(
        (c) => c.id !== controller.id,
    );
    clearAcceptError(controller.id);
    // Release the gate if it belonged to this request. Nothing bounds
    // `controller.accept()` client-side (no localTimeoutMs anywhere), so a
    // stalled accept can have its card pruned — the SDK times the request out,
    // the subscriber sees a terminal phase — while the promise is still
    // outstanding. Leaving `accepting` pinned to a request that no longer
    // exists would refuse every later Verify, on every card, for the rest of
    // the session.
    releaseAccepting(controller.id);
}

function clearAcceptError(id: string): void {
    if (!(id in verificationState.acceptErrors)) return;
    const next = { ...verificationState.acceptErrors };
    delete next[id];
    verificationState.acceptErrors = next;
}

function setAcceptError(id: string, text: string): void {
    verificationState.acceptErrors = {
        ...verificationState.acceptErrors,
        [id]: text,
    };
}

/**
 * Is there still a surface that would render this request's error — its card in
 * the queue, or the modal? Used to drop an error nothing can show: dequeuing is
 * also the only thing that clears the map, so such an entry would leak.
 */
function hasSurface(id: string): boolean {
    return (
        verificationState.incoming.some((c) => c.id === id) ||
        verificationState.active?.id === id
    );
}

/** Is this request's accept() in flight? */
export function isAcceptingRequest(
    controller: VerificationController,
): boolean {
    return verificationState.accepting === controller.id;
}

/**
 * Copy for this request's last failed accept, if any. A busy refusal is derived
 * rather than stored, so it disappears on its own when the accept that caused it
 * finishes.
 */
export function acceptRequestError(
    controller: VerificationController,
): string | null {
    return (
        verificationState.acceptErrors[controller.id] ??
        (verificationState.busyRefusalId === controller.id
            ? ACCEPT_BUSY_TEXT
            : null)
    );
}

function addIncoming(controller: VerificationController): void {
    // Dedupe: the same request can surface via both the seed and the live
    // listener during the boot race.
    if (verificationState.incoming.some((c) => c.id === controller.id)) return;
    // Track it so a card re-renders as its phase changes, and auto-remove it
    // if the other side cancels (or it otherwise finishes) before we accept.
    track(controller, () => {
        if (
            isTerminal(controller) &&
            verificationState.active?.id !== controller.id
        ) {
            removeIncoming(controller);
        }
    });
    verificationState.incoming = [...verificationState.incoming, controller];
}

function setActive(controller: VerificationController): void {
    verificationState.active = controller;
    track(controller);
    bump();
}

/**
 * Wire up incoming verification requests. Call once from the app shell after
 * login; returns an unsubscribe. Seeds any request already in flight at boot
 * (received, not one we started), then listens for new ones.
 */
export function initVerification(): () => void {
    for (const controller of getPendingVerificationControllers()) {
        if (!controller.view().initiatedByMe) addIncoming(controller);
    }
    return onIncomingVerificationRequest((controller) => {
        addIncoming(controller);
    });
}

/** Start verifying one of our own other sessions (opens the modal). */
export async function verifyOwnDevice(deviceId: string): Promise<void> {
    setActive(await startDeviceVerification(deviceId));
}

/** Start verifying another user (opens the modal). */
export async function verifyUser(userId: string): Promise<void> {
    setActive(await startUserVerification(userId));
}

/**
 * Accept an incoming request, then promote it to the active modal flow.
 *
 * Order matters: the card is only dequeued once `accept()` has actually
 * succeeded. Dequeuing first (the pre-2026-07-30 behaviour) lost the request
 * entirely when acceptance rejected — no card, no modal, no error (CRYPTO-03).
 * Returns whether the request was accepted.
 */
export async function acceptIncoming(
    controller: VerificationController,
): Promise<boolean> {
    // A second click on the SAME card is not an error: it already reads "…".
    if (verificationState.accepting === controller.id) return false;
    if (verificationState.accepting !== null) {
        // One accept at a time, but say so — the other card's Verify button is
        // live, and a click that silently does nothing is its own lie. Marker,
        // not stored copy: it self-clears when that other accept finishes.
        verificationState.busyRefusalId = controller.id;
        bump();
        return false;
    }
    setAccepting(controller.id);
    clearAcceptError(controller.id);
    bump();
    try {
        await controller.accept();
    } catch (error) {
        // Log unconditionally, BEFORE deciding whether anything can show it: on
        // the no-surface path below the console is the only remaining record
        // that this accept failed at all.
        const text = acceptFailureText(error);
        // Identity-checked: the gate may already have moved on. A prune can
        // release it mid-flight (see removeIncoming) and the user can then
        // start a different accept, which this settle must not disturb.
        releaseAccepting(controller.id);
        // Store the copy only while a card or the modal can render it. The
        // other side cancelling makes addIncoming's subscriber prune the card,
        // and that prune is also what clears the map, so an entry written after
        // it would sit there forever with nothing able to show it.
        if (hasSurface(controller.id)) setAcceptError(controller.id, text);
        bump();
        return false;
    }
    releaseAccepting(controller.id);
    // Re-filters the CURRENT queue by id, so a request that arrived while
    // accept() was in flight keeps its card.
    removeIncoming(controller);
    setActive(controller);
    return true;
}

/** Decline an incoming request: cancel it and drop its card. */
export function declineIncoming(controller: VerificationController): void {
    controller.cancel();
    removeIncoming(controller);
}

/**
 * Close the active modal. Cancels the flow first unless it already finished, so
 * dismissing mid-handshake never leaves a half-open verification on the wire.
 */
export function closeActive(): void {
    const controller = verificationState.active;
    if (controller && !isTerminal(controller)) controller.cancel();
    // The modal is the other surface `acceptErrors` is written for, so closing
    // it is the only thing that can clear an entry recorded against the active
    // flow (its card is long gone from the queue).
    if (controller) clearAcceptError(controller.id);
    verificationState.active = null;
    bump();
}
