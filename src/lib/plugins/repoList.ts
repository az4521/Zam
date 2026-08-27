/**
 * Pure helpers for the Plugin Manager (item 4): the non-removable official repo
 * merged with user-added repos (deduped), add-repo validation, and a stable
 * installed-list sort. No DOM/SDK/localStorage/fetch — unit-testable.
 */
import { normalizeRepoRef } from "./repo";

/** The built-in official plugin source (spec §4). Non-removable in the UI. */
export const OFFICIAL_REPO = "az4521/zam-plugins";

export interface RepoRecord {
    /** The repo ref as entered (or the official constant). */
    ref: string;
    /** True for the built-in official repo — cannot be removed. */
    official: boolean;
}

/** Canonical dedupe identity: lowercased owner/repo (GitHub is case-insensitive)
 *  plus the case-sensitive branch. `null` when the ref does not parse. */
export function repoIdentity(ref: string): string | null {
    try {
        const { owner, repo, branch } = normalizeRepoRef(ref);
        return `${owner.toLowerCase()}/${repo.toLowerCase()}@${branch}`;
    } catch {
        return null;
    }
}

/** Merge the official repo (always first, `official:true`) with user repos,
 *  dropping invalid refs and any duplicate of the official repo or an earlier
 *  user entry. */
export function mergeRepoList(userRepos: readonly string[]): RepoRecord[] {
    const seen = new Set<string>();
    const officialId = repoIdentity(OFFICIAL_REPO);
    if (officialId) seen.add(officialId);
    const out: RepoRecord[] = [{ ref: OFFICIAL_REPO, official: true }];
    for (const ref of userRepos) {
        const id = repoIdentity(ref);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ ref, official: false });
    }
    return out;
}

export interface AddRepoResult {
    ok: boolean;
    /** Normalized `owner/repo[@branch]` slug to persist (on success). */
    normalized?: string;
    /** Human message for the UI (on failure). */
    reason?: string;
}

/** Validate a candidate repo for adding: must parse, must not be the official
 *  repo, must not duplicate an existing user repo. Returns the normalized slug
 *  to persist (`@branch` omitted when it is the default `main`). */
export function canAddRepo(
    userRepos: readonly string[],
    candidate: string,
): AddRepoResult {
    const trimmed = (candidate ?? "").trim();
    if (!trimmed) {
        return {
            ok: false,
            reason: "Enter a repo (owner/repo or a GitHub URL).",
        };
    }
    let owner: string, repo: string, branch: string;
    try {
        ({ owner, repo, branch } = normalizeRepoRef(trimmed));
    } catch (e) {
        return { ok: false, reason: (e as Error).message };
    }
    const id = `${owner.toLowerCase()}/${repo.toLowerCase()}@${branch}`;
    if (id === repoIdentity(OFFICIAL_REPO)) {
        return {
            ok: false,
            reason: "That is the official repo — it is already included.",
        };
    }
    for (const existing of userRepos) {
        if (repoIdentity(existing) === id) {
            return { ok: false, reason: "That repo is already added." };
        }
    }
    const normalized =
        branch === "main" ? `${owner}/${repo}` : `${owner}/${repo}@${branch}`;
    return { ok: true, normalized };
}

/** Stable display order for the Installed list: built-ins first, then repo
 *  plugins, each group alphabetized by name (case-insensitive), id as tiebreak.
 *  Returns a new array (does not mutate the input). */
export function sortInstalledPlugins<
    T extends { source: "builtin" | "repo"; name: string; id: string },
>(items: readonly T[]): T[] {
    return [...items].sort((a, b) => {
        if (a.source !== b.source) return a.source === "builtin" ? -1 : 1;
        const byName = a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
        });
        return byName !== 0 ? byName : a.id.localeCompare(b.id);
    });
}
