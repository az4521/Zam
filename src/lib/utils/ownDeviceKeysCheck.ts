/**
 * Pure decision for the own-device keys check that runs at boot
 * (crypto.ts ownDeviceKeysReplaced). No SDK or store imports.
 */

/**
 * "blocking": the check must finish before sync starts (first boot, or the
 * device has no record yet, or the recorded key already disagrees).
 * "background": this device's recorded ed25519 key matches the crypto store
 * that just opened, so the server comparison can run after the client is up,
 * with outgoing crypto requests held until it settles.
 */
export type OwnKeysCheckMode = "blocking" | "background";

export function ownKeysCheckMode(
    recorded: string | null | undefined,
    current: string | null | undefined,
): OwnKeysCheckMode {
    return recorded && current && recorded === current
        ? "background"
        : "blocking";
}

/**
 * The outcome of the background check: "safe" releases held crypto requests,
 * "replaced" means the server has other keys for this device, and "unknown"
 * (an unexpected failure) keeps them held.
 */
export type OwnKeysVerdict = "safe" | "replaced" | "unknown";
