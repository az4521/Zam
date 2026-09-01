// src/lib/utils/changelog.ts
// Pure changelog/release selection. DOM-free, SDK-free, network-free so it can
// be unit-tested. The fetch + cache lives in update.ts; the markdown render in
// ReleaseNotesBody.svelte. This module only DECIDES.

/** One GitHub release, trimmed to the fields the What's New UI needs. */
export interface ChangelogRelease {
    /** e.g. "v1.5.1" — may or may not carry a leading "v". */
    tag_name: string;
    /** Human title; GitHub falls back to the tag when a release has no name. */
    name: string;
    /** Release notes, GitHub-flavoured markdown. */
    body: string;
    /** ISO-8601 publish timestamp ("" when unknown). */
    published_at: string;
}

/** Strip a single leading "v"/"V" and surrounding whitespace. */
export function normalizeVersion(v: string): string {
    return v.trim().replace(/^v/i, "");
}

/** Coerce one raw GitHub release object into a ChangelogRelease, or null. */
export function normalizeRelease(raw: unknown): ChangelogRelease | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const tag = typeof r.tag_name === "string" ? r.tag_name : "";
    if (!tag) return null;
    const body = typeof r.body === "string" ? r.body : "";
    const name = typeof r.name === "string" && r.name ? r.name : tag;
    const published = typeof r.published_at === "string" ? r.published_at : "";
    return { tag_name: tag, name, body, published_at: published };
}

/** Newest release by published_at (ISO strings sort chronologically), or null. */
function newestRelease(releases: ChangelogRelease[]): ChangelogRelease | null {
    if (releases.length === 0) return null;
    return releases.reduce((a, b) => (b.published_at > a.published_at ? b : a));
}

/**
 * Pick the release matching `version` (by tag, ignoring a leading "v"), else the
 * newest release (an unreleased dev build won't have a matching tag). null when
 * the list is empty.
 */
export function pickReleaseForVersion(
    releases: ChangelogRelease[],
    version: string,
): ChangelogRelease | null {
    const want = normalizeVersion(version);
    const exact = releases.find((r) => normalizeVersion(r.tag_name) === want);
    if (exact) return exact;
    return newestRelease(releases);
}

/**
 * Whether to auto-surface the What's New popup: only when a PRIOR version was
 * recorded AND it differs from the current build. A first-ever launch
 * (lastSeen null) shows nothing — the caller silently records the version.
 */
export function shouldShowWhatsNew(
    lastSeen: string | null,
    current: string,
): boolean {
    if (lastSeen === null) return false;
    return normalizeVersion(lastSeen) !== normalizeVersion(current);
}
