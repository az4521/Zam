// Per-room composer drafts, in-memory only.
//
// Flipping to the call view unmounts MessageArea (correct — a mounted
// MessageArea keeps firing read receipts while you peek at the call), which
// destroys the composer's local text/mention state. This store lets that
// content survive the unmount, and also gives each room its own draft instead
// of one shared composer that bleeds text between rooms.
//
// Session-scoped by design: an account switch does a full page reload, so
// there's no cross-account keying, serialization, or stale-draft cleanup.

export type ComposerDraft = {
    text: string;
    // Mention pills stored as [insertedToken, userId] entries (not a live Map)
    // so the store shares no mutable reference with the composer and stays
    // trivially testable. The composer rebuilds a Map from these on load.
    mentions: [string, string][];
};

const draftsState = $state<{ drafts: Record<string, ComposerDraft> }>({
    drafts: {},
});

export function getDraft(roomId: string): ComposerDraft | null {
    return draftsState.drafts[roomId] ?? null;
}

// Stores the room's draft. A blank (whitespace-only) composer is "no draft", so
// it deletes the entry instead — mentions without text are orphans not worth
// keeping, and this keeps "no draft" unambiguous.
export function setDraft(
    roomId: string,
    text: string,
    mentions: Map<string, string>,
): void {
    if (!text.trim()) {
        clearDraft(roomId);
        return;
    }
    draftsState.drafts[roomId] = {
        text,
        mentions: [...mentions.entries()],
    };
}

export function clearDraft(roomId: string): void {
    delete draftsState.drafts[roomId];
}
