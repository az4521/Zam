/**
 * Pure decision logic for plugin commit pinning: install-id validation and
 * load-decision logic (cache/fetch/needs-update) based on pinned SHA and
 * cache state. No SDK, DOM, or localStorage — unit-tested pure functions.
 */

import { repoKey, type RepoRef } from "./repo";

export interface CheckInstallIdParams {
    entryId: string;
    manifestId: string;
    repoRef: RepoRef;
    builtinIds: string[];
    installed: Record<
        string,
        { source: "builtin" | "repo"; repoRef?: RepoRef }
    >;
}

/**
 * Check whether a plugin can be installed: manifest.id must match the index
 * entry id, must not collide with a built-in id, and must not collide with
 * another repo's installed plugin. Returns null if OK, error string otherwise.
 */
export function checkInstallId(params: CheckInstallIdParams): string | null {
    const { entryId, manifestId, repoRef, builtinIds, installed } = params;

    // Manifest id must match entry id
    if (manifestId !== entryId) {
        return `Plugin id mismatch: index lists "${entryId}", manifest declares "${manifestId}"`;
    }

    // Must not be a built-in id
    if (builtinIds.includes(manifestId)) {
        return `Cannot install plugin with id "${manifestId}": it is a built-in plugin`;
    }

    // Must not collide with an already-installed plugin from a different source
    const existing = installed[manifestId];
    if (existing) {
        if (existing.source === "builtin") {
            return `Cannot install plugin with id "${manifestId}": it is a built-in plugin`;
        }
        // Check if it's from a different repo
        if (
            existing.repoRef &&
            repoKey(existing.repoRef) !== repoKey(repoRef)
        ) {
            return `Plugin "${manifestId}" is already installed from a different repository`;
        }
        // Same repo re-install is OK
    }

    return null;
}

export interface DecideRepoLoadParams {
    pinnedSha: string | null;
    cacheUsable: boolean;
    hasAnyCache: boolean;
    resolvedSha: string | null;
}

export type RepoLoadDecision =
    | { kind: "cache"; record?: string }
    | { kind: "fetch"; sha: string; record?: string }
    | { kind: "needs-update"; record?: string };

/**
 * Decide how to load a repo plugin: use cache, fetch at a SHA, or mark
 * needs-update. Returns the decision plus an optional SHA to record
 * (present when migrating an unpinned plugin).
 */
export function decideRepoLoad(params: DecideRepoLoadParams): RepoLoadDecision {
    const { pinnedSha, cacheUsable, hasAnyCache, resolvedSha } = params;

    if (pinnedSha) {
        // Already pinned: use cache if usable, else fetch at the pinned sha
        if (cacheUsable) {
            return { kind: "cache" };
        } else {
            return { kind: "fetch", sha: pinnedSha };
        }
    } else {
        // Unpinned (migration path): try to resolve and record
        if (resolvedSha) {
            // Resolved: record it and fetch AT it. A legacy cache came from an
            // earlier branch head, so running it would pin a SHA that doesn't
            // match the code (the fetch still falls back to it offline).
            return { kind: "fetch", sha: resolvedSha, record: resolvedSha };
        } else {
            // Resolve failed: fall back to cache if we have any, else needs-update
            if (hasAnyCache) {
                return { kind: "cache" };
            } else {
                return { kind: "needs-update" };
            }
        }
    }
}
