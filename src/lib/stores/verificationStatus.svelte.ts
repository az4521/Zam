/**
 * Reactive store for the reconciled own-device verification status.
 *
 * Caches the unified view built from two contradictory signals:
 * - deviceTrust.isVerified (local verification OR cross-signing)
 * - setupState (whole-account encryption posture)
 *
 * Resolved by `reconcileVerification` into a single status that surfaces
 * unverified sessions AND incomplete setup (the "az contradiction") without
 * conflicting UI.
 *
 * The store is imperative: components drive `refreshVerificationStatus()` from
 * their own tick-guarded effects (tasks 3/4). No `$effect` here — that would
 * introduce circular reactivity (crypto ticks → refresh → tick bump → refresh).
 */

import { getOwnVerificationStatusInputs } from "$lib/matrix/crypto";
import { reconcileVerification } from "$lib/utils/verificationStatus";
import type { VerificationStatusView } from "$lib/utils/verificationStatus";

class VerificationStatusStore {
    view = $state<VerificationStatusView | null>(null);
    nudgeDismissed = $state(false);
}

export const verificationStatusState = new VerificationStatusStore();

/**
 * Refresh the cached verification-status view. Called by components when
 * security/verification ticks bump. Never throws (the wrapper swallows errors).
 */
export async function refreshVerificationStatus(): Promise<void> {
    const { deviceTrust, setupState } = await getOwnVerificationStatusInputs();
    verificationStatusState.view = reconcileVerification({
        deviceTrust,
        setupState,
    });
}

/**
 * Dismiss the verification nudge for this session. The flag resets on reload
 * (session-only, reversible by design).
 */
export function dismissVerificationNudge(): void {
    verificationStatusState.nudgeDismissed = true;
}
