// Mirror every account signed in on this origin to the service worker, so a
// web push for an account other than the active one can still be fetched,
// decrypted and attributed (static/sw.js, SET_ACCOUNTS). The Android
// counterpart is syncNativeAccounts in nativeSession.ts.

import { serializeNativeAccounts } from "$lib/utils/nativeSessionRecord";
import type { StoredAccount } from "$lib/utils/accounts";

export function syncServiceWorkerAccounts(
    accounts: readonly StoredAccount[],
): void {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
        return;
    // The same { userId: record string } map the native side stores.
    const records = JSON.parse(serializeNativeAccounts(accounts));
    // `ready` waits for a worker that is not active yet; postMessage order is
    // preserved, so the newest snapshot is the one the worker ends up with.
    navigator.serviceWorker.ready
        .then((reg) =>
            reg.active?.postMessage({ type: "SET_ACCOUNTS", records }),
        )
        .catch(() => {});
}
