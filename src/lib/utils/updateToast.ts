import type { UpdatePhase } from "./updateStatus";
import { shouldShowUpdateBanner } from "./updateBanner";

/**
 * Whether the mobile "update available" toast should fire on a phase change.
 *
 * On mobile the inline update banner isn't shown — it lives in the desktop
 * sidebar footer, which collapses to a drawer on mobile — so a one-shot toast
 * is the only update prompt. Fire it whenever the phase moves INTO an
 * actionable phase (available / downloaded / unsupported), the same phases the
 * banner shows, so the user learns an update is ready without a persistent bar.
 *
 * Desktop never toasts (the inline banner covers it), and an unchanged phase
 * never re-fires. Android re-runs its launch check each boot, so a missed
 * toast returns on the next app open while the update is still pending.
 */
export function shouldFireUpdateToast(
    prevPhase: UpdatePhase,
    nextPhase: UpdatePhase,
    isMobile: boolean,
): boolean {
    if (!isMobile) return false;
    if (nextPhase === prevPhase) return false;
    return shouldShowUpdateBanner(nextPhase, false);
}
