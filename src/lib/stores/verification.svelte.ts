import {
    startDeviceVerification,
    startUserVerification,
    onIncomingVerificationRequest,
    getPendingVerificationControllers,
    type VerificationController,
} from "$lib/matrix/crypto";
import { verificationPhaseKind } from "$lib/utils/verification";

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
}

export const verificationState = new VerificationStore();

function bump(): void {
    verificationState.verificationTick++;
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

/** Accept an incoming request: promote it to the active modal flow. */
export async function acceptIncoming(
    controller: VerificationController,
): Promise<void> {
    removeIncoming(controller);
    setActive(controller);
    await controller.accept();
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
    verificationState.active = null;
    bump();
}
