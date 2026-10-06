// Switching the active account: shared by the account switcher and by a
// notification tapped for an account that isn't the active one.

import { leaveVoiceCall } from "$lib/matrix/client";
import { switchActive } from "$lib/stores/accounts.svelte";
import { clearAllNotificationSurfaces } from "$lib/utils/notificationSurfaces";

export async function switchToAccount(userId: string): Promise<void> {
    // The account we are leaving must not keep notifications on screen —
    // after the reload they would be sitting above a different account's
    // session with a deep link to a room it may not even be in. Before the
    // bounded leave below, so a hung leave cannot leave them up for three
    // seconds and then across the reload.
    clearAllNotificationSurfaces();
    // A hard reload would strand our MatrixRTC membership as a ghost
    // participant (up to 4h — no MSC4140 on continuwuity). Leave first,
    // bounded so a hung leave can't block the switch.
    await Promise.race([
        // Swallowed deliberately: leaveVoiceCall fans out to component
        // subscriber callbacks and can re-throw a previous leave's
        // rejection. A rejection here would skip switchActive() and the
        // reload, stranding the switch — with the notification latch above
        // already set, so the session continues with popups dead and no
        // error anywhere. A failed leave is worth a ghost participant.
        leaveVoiceCall().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    switchActive(userId);
    // Full reload: the session-restore path boots the account with
    // clean stores (no cross-account state survives).
    window.location.assign("/");
}
