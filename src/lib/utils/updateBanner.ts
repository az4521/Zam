import type { UpdatePhase } from "$lib/utils/updateStatus";

/**
 * Whether the app-wide "update ready" banner should be visible.
 *
 * The banner is a subtle, dismissible prompt so an update the updater has
 * already found/downloaded in the background doesn't wait for the user to open
 * Settings → About. It only appears for a phase the user can ACT on:
 *   - `downloaded`  → ready to install (android) / restart (desktop)
 *   - `available`   → an update was found but not auto-downloading (toggle off)
 *   - `unsupported` → a new version exists but this build can't self-update
 * All quiet/transient phases (idle, checking, downloading, up-to-date, error)
 * keep it hidden, and dismissing it hides it until the next actionable phase.
 */
export function shouldShowUpdateBanner(
    phase: UpdatePhase,
    dismissed: boolean,
): boolean {
    if (dismissed) return false;
    return (
        phase === "downloaded" ||
        phase === "available" ||
        phase === "unsupported"
    );
}
