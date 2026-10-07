// src/lib/utils/backgroundRelease.ts
/**
 * Rules for the Android app in the background (the wiring is
 * src/lib/backgroundRelease.ts).
 *
 * The page's JavaScript doesn't run while the app is in the background (the
 * WebView holds it until the activity resumes), so it can't decrypt a push,
 * yet it keeps the crypto store's lock, which shuts the hidden decryptor out.
 * So after a short while hidden the page stops its client and releases the
 * lock; coming back restarts crypto and sync in place, or, if that fails,
 * reloads the app with drafts carried across in sessionStorage.
 */

import type { ComposerDraft } from "$lib/stores/composerDrafts.svelte";

/**
 * How long the app stays hidden before letting go. The page has to still be
 * running to do it: Android froze the renderer about 16s after the app left
 * the screen on a Galaxy S24, so this lands well before that.
 */
export const RELEASE_AFTER_HIDDEN_MS = 10_000;

export interface ReleaseInput {
    /** In a call, or joining one: the page carries the call's media. */
    inCall: boolean;
    /** Sharing live location: the page sends the position updates. */
    sharingLiveLocation: boolean;
    /** Messages waiting in the offline outbox (memory only). */
    outboxPending: boolean;
    /** An upload or a send the server hasn't confirmed yet. */
    sendsInFlight: boolean;
    /** Something else asked to keep the page alive (a voice recording). */
    keepAliveHolds: number;
}

/**
 * Why the page must keep running rather than let go, or null when it may.
 * Each of these would be cut off by the reload that follows.
 */
export function releaseBlocker(input: ReleaseInput): string | null {
    if (input.inCall) return "call";
    if (input.sharingLiveLocation) return "live location";
    if (input.outboxPending) return "outbox";
    if (input.sendsInFlight) return "sending";
    if (input.keepAliveHolds > 0) return "keep-alive";
    return null;
}

/** sessionStorage key for drafts carried across the release reload. */
export const DRAFT_SNAPSHOT_KEY = "zam_release_drafts";

/** A snapshot older than this is from some other session; ignore it. */
export const DRAFT_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function serializeDraftSnapshot(
    drafts: Record<string, ComposerDraft>,
    now: number,
): string {
    return JSON.stringify({ v: 1, savedAt: now, drafts });
}

/** The drafts in a snapshot, or null when it is missing, stale or malformed. */
export function parseDraftSnapshot(
    raw: string | null,
    now: number,
): Record<string, ComposerDraft> | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as { v?: unknown; savedAt?: unknown; drafts?: unknown };
    if (p.v !== 1 || typeof p.savedAt !== "number") return null;
    if (now - p.savedAt > DRAFT_SNAPSHOT_MAX_AGE_MS || p.savedAt > now)
        return null;
    if (!p.drafts || typeof p.drafts !== "object" || Array.isArray(p.drafts))
        return null;
    const out: Record<string, ComposerDraft> = {};
    for (const [key, value] of Object.entries(
        p.drafts as Record<string, unknown>,
    )) {
        const d = value as { text?: unknown; mentions?: unknown } | null;
        if (!d || typeof d.text !== "string" || !d.text.trim()) continue;
        const mentions = Array.isArray(d.mentions)
            ? d.mentions.filter(
                  (m): m is [string, string] =>
                      Array.isArray(m) &&
                      m.length === 2 &&
                      typeof m[0] === "string" &&
                      typeof m[1] === "string",
              )
            : [];
        out[key] = { text: d.text, mentions };
    }
    return out;
}
