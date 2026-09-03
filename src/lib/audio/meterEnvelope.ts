/**
 * One step of a fast-attack / slow-release envelope follower for a level
 * meter. Instant attack (ATTACK_MS = 0) makes the bar jump to a louder
 * reading the moment it arrives — so it never lags the voice — while the
 * release smooths the fall so the bar does not flicker. Frame-rate
 * independent: the decay is driven by real elapsed time (dtMs), so it looks
 * the same on a 60 Hz and a 144 Hz display.
 */
export const ATTACK_MS = 0;
export const RELEASE_MS = 140;

export function smoothMeterLevel(
    prev: number,
    next: number,
    dtMs: number,
    attackMs: number,
    releaseMs: number,
): number {
    const tau = next >= prev ? attackMs : releaseMs;
    // Instant on attack, on a non-positive time constant, or on a
    // non-positive frame delta (guards the exp/divide).
    if (tau <= 0 || dtMs <= 0) return next;
    const coeff = 1 - Math.exp(-dtMs / tau);
    return prev + (next - prev) * coeff;
}
