/**
 * When the user last actually touched this device: a click, key, wheel or
 * touch on the window, or the window gaining focus (alt-tab, a click on the
 * taskbar, a notification tap).
 *
 * Two features need "is someone at this device right now", and focus alone
 * cannot answer it: a window keeps focus while its owner is away from the
 * desk. The active-session heartbeat (activeSession.ts) uses this to avoid
 * muting the phone; the read-receipt gate (receiptGate.ts) uses it so a
 * focused but unattended window does not mark every incoming message read,
 * which made the phone drop them as "already read".
 *
 * AppShell owns the DOM listeners and calls `noteUserInput()`; readers call
 * `getLastInputTs()`. `onReturnFromIdle` fires on the first input after an
 * idle spell, so whatever was held back (a heartbeat, a receipt) can go out
 * at once instead of waiting for the next unrelated trigger.
 */

import { IDLE_LIMIT_MS } from "$lib/utils/activeSession";

let lastInputTs: number | null = null;
const returnListeners = new Set<() => void>();

export function getLastInputTs(): number | null {
    return lastInputTs;
}

/** Record an input. Returns true when it ended an idle spell (or was the
 *  first one), after notifying `onReturnFromIdle` listeners. */
export function noteUserInput(now: number = Date.now()): boolean {
    const wasIdle =
        lastInputTs === null ||
        lastInputTs > now ||
        now - lastInputTs >= IDLE_LIMIT_MS;
    lastInputTs = now;
    if (wasIdle) {
        for (const listener of [...returnListeners]) {
            try {
                listener();
            } catch {
                // One broken listener must not stop the others.
            }
        }
    }
    return wasIdle;
}

/** Called on the first input after an idle spell. Returns an unsubscribe. */
export function onReturnFromIdle(listener: () => void): () => void {
    returnListeners.add(listener);
    return () => {
        returnListeners.delete(listener);
    };
}

/** Tests only. */
export function resetUserActivityForTests(): void {
    lastInputTs = null;
    returnListeners.clear();
}
