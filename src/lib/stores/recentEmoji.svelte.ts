import {
    loadRecentEmoji,
    persistRecentEmoji,
    onAccountData,
    onSyncPrepared,
} from "$lib/matrix/client";
import {
    parseRecentEmoji,
    pushRecentEmoji,
    type RecentEmoji,
} from "$lib/utils/recentEmoji";

export type { RecentEmoji };

/** Quiet time before the list is written, so a burst of reactions is one
 *  account-data write rather than one per emoji. */
const WRITE_DELAY_MS = 2000;

class RecentEmojiState {
    items = $state<RecentEmoji[]>([]);
}

export const recentEmojiState = new RecentEmojiState();

let writeTimer: ReturnType<typeof setTimeout> | null = null;

/** Note that an emoji was just used: it moves to the front of the list. */
export function recordRecentEmoji(item: RecentEmoji): void {
    recentEmojiState.items = pushRecentEmoji(recentEmojiState.items, item);
    if (writeTimer !== null) clearTimeout(writeTimer);
    writeTimer = setTimeout(flushRecentEmoji, WRITE_DELAY_MS);
}

/** Write the pending list now, if there is one. Sends the latest list, so a
 *  flush after several records writes once. */
function flushRecentEmoji(): void {
    if (writeTimer !== null) {
        clearTimeout(writeTimer);
        writeTimer = null;
    }
    persistRecentEmoji(recentEmojiState.items).catch((err) => {
        // Not worth a toast: the list still works on this device, and the next
        // use writes it again.
        console.error("Failed to sync recently used emoji", err);
    });
}

function loadFromAccount(): RecentEmoji[] {
    return parseRecentEmoji(loadRecentEmoji());
}

// Call once on app mount. Returns a cleanup function.
export function initRecentEmoji(): () => void {
    // Load now in case sync already completed, and again on PREPARED in case
    // this ran before the first sync finished. Neither may clobber a write
    // that is still waiting to go out.
    if (writeTimer === null) recentEmojiState.items = loadFromAccount();

    const unsubSync = onSyncPrepared(() => {
        if (writeTimer === null) recentEmojiState.items = loadFromAccount();
    });
    const unsubAccount = onAccountData((type) => {
        if (type !== "moe.crafty.matrix.recent_emoji") return;
        // A newer local list is about to be written; ignore the echo of the
        // older one. The write that follows will be the one that sticks.
        if (writeTimer === null) recentEmojiState.items = loadFromAccount();
    });
    // Do not lose a pending write when the page goes away inside the delay.
    const onPageHide = () => {
        if (writeTimer !== null) flushRecentEmoji();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
        unsubSync();
        unsubAccount();
        window.removeEventListener("pagehide", onPageHide);
        if (writeTimer !== null) flushRecentEmoji();
    };
}
