// Per-room composer drafts, in-memory only.
//
// Flipping to the call view unmounts MessageArea (correct — a mounted
// MessageArea keeps firing read receipts while you peek at the call), which
// destroys the composer's local text/mention state. This store lets that
// content survive the unmount, and also gives each room its own draft instead
// of one shared composer that bleeds text between rooms.
//
// Session-scoped by design: an account switch does a full page reload, so
// there's no cross-account keying, serialization, or stale-draft cleanup. The
// one exception is the reload after the Android app let go of its crypto store
// in the background (backgroundRelease.ts): drafts are carried across that in
// sessionStorage, written just before and read back once here.

import {
    DRAFT_SNAPSHOT_KEY,
    parseDraftSnapshot,
    serializeDraftSnapshot,
} from "$lib/utils/backgroundRelease";

export type ComposerDraft = {
    text: string;
    // Mention pills stored as [insertedToken, userId] entries (not a live Map)
    // so the store shares no mutable reference with the composer and stays
    // trivially testable. The composer rebuilds a Map from these on load.
    mentions: [string, string][];
};

function takeDraftSnapshot(): Record<string, ComposerDraft> {
    try {
        const raw = sessionStorage.getItem(DRAFT_SNAPSHOT_KEY);
        if (raw === null) return {};
        sessionStorage.removeItem(DRAFT_SNAPSHOT_KEY);
        return parseDraftSnapshot(raw, Date.now()) ?? {};
    } catch {
        return {};
    }
}

const draftsState = $state<{ drafts: Record<string, ComposerDraft> }>({
    drafts: takeDraftSnapshot(),
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

// Open composers by draft key. A mounted composer reads its draft only when
// its key becomes active and writes it back when it leaves, so text put into
// the draft store underneath an open composer would never show and would be
// overwritten. Code that restores text in the background (a failed
// notification quick reply) hands it to the open composer instead.
const liveComposers = new Map<string, (text: string) => void>();

/** Register the composer that is open for `key`. Returns the unregister fn. */
export function registerLiveComposer(
    key: string,
    insert: (text: string) => void,
): () => void {
    liveComposers.set(key, insert);
    return () => {
        if (liveComposers.get(key) === insert) liveComposers.delete(key);
    };
}

/** Append text to the open composer for `key`. False when none is open. */
export function deliverToLiveComposer(key: string, text: string): boolean {
    const insert = liveComposers.get(key);
    if (!insert) return false;
    insert(text);
    return true;
}

// Open composers' write-back, by draft key. A composer only stores its text
// when it leaves its key, so a reload would lose what is still in an open one;
// flushing first puts it in the store.
const draftFlushers = new Map<string, () => void>();

/** Register how the composer open for `key` stores its current text. */
export function registerDraftFlusher(
    key: string,
    flush: () => void,
): () => void {
    draftFlushers.set(key, flush);
    return () => {
        if (draftFlushers.get(key) === flush) draftFlushers.delete(key);
    };
}

/**
 * Store every draft, open composers included, where the next page load in
 * this tab reads it back. For a reload this page triggers itself.
 */
export function saveDraftsForReload(): void {
    for (const flush of draftFlushers.values()) {
        try {
            flush();
        } catch {
            /* a torn-down composer: its last stored text stands */
        }
    }
    try {
        sessionStorage.setItem(
            DRAFT_SNAPSHOT_KEY,
            serializeDraftSnapshot(
                $state.snapshot(draftsState.drafts),
                Date.now(),
            ),
        );
    } catch {
        /* storage unavailable: the drafts are lost with the reload */
    }
}
