// Pushes the read-receipt privacy (account default + per-room exceptions) to the
// two places that send "mark as read" receipts without the app open: the
// service worker and the Android notification action.
import { auth } from "$lib/stores/auth.svelte";
import { settingsState } from "$lib/stores/settings.svelte";
import {
    receiptPrivacyRoomExceptions,
    updateServiceWorkerReceiptPrivacy,
} from "$lib/matrix/client";
import { syncNativeReceiptPrivacy } from "$lib/nativeSession";

// The last payload posted, so a sync-driven re-mirror that changed nothing
// does not message the worker again.
let lastSent = "";

export function mirrorReceiptPrivacy(): void {
    const userId = auth.userId;
    if (!userId) return;
    const isPrivate = settingsState.privateReadReceipts;
    const rooms = receiptPrivacyRoomExceptions();
    const key = JSON.stringify([userId, isPrivate, rooms]);
    if (key === lastSent) return;
    lastSent = key;
    updateServiceWorkerReceiptPrivacy(userId, isPrivate, rooms);
    syncNativeReceiptPrivacy(userId, isPrivate, rooms).catch(() => {});
}
