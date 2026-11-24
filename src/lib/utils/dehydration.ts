/**
 * MSC3814 dehydrated devices: which `startDehydration` options each moment in
 * the session calls for. Kept SDK-free so the policy is testable; crypto.ts
 * feeds the result straight to `CryptoApi.startDehydration`.
 *
 * - `startup`: a restored session. Only refresh the dehydrated device when
 *   the dehydration key is already cached locally, so startup never reads
 *   secret storage (it is locked after a restart). No rehydration: this
 *   session was receiving its own to-device messages all along.
 * - `unlock`: secret storage was unlocked on a session that was already
 *   verified. The key comes from 4S (or is created there); nothing to
 *   rehydrate for the same reason as above.
 * - `unlock-new-session`: the recovery key verified this session just now,
 *   i.e. a fresh login. Rehydrate first so room keys sent while every other
 *   device was offline reach this one.
 * - `recovery-created`: recovery was (re)created. A reset removes the old
 *   dehydrated device and the old key went with the old secret storage, so
 *   mint a new key into the new 4S.
 */
export type DehydrationTrigger =
    "startup" | "unlock" | "unlock-new-session" | "recovery-created";

export interface DehydrationOptions {
    createNewKey: boolean;
    onlyIfKeyCached: boolean;
    rehydrate: boolean;
}

export function dehydrationOptions(
    trigger: DehydrationTrigger,
): DehydrationOptions {
    return {
        createNewKey: trigger === "recovery-created",
        onlyIfKeyCached: trigger === "startup",
        rehydrate: trigger === "unlock-new-session",
    };
}

/** Delay before the startup refresh, keeping its key upload off the boot path. */
export const STARTUP_DEHYDRATION_DELAY_MS = 20_000;
