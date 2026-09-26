/**
 * Pure GitHub repo-ref normalization and plugin-index parsing. Turns GitHub
 * slugs/URLs into a canonical {owner,repo,branch} triple, builds raw.githubusercontent
 * URLs for fetching plugin files, and validates the repo's index.json schema.
 * No imports except semver — kept pure for unit-testability.
 */

import { isValidSemver } from "./semver";

const VALID_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface RepoRef {
    owner: string;
    repo: string;
    branch: string;
}

export interface PluginIndexEntry {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    path: string;
}

/**
 * Normalize a GitHub repo reference (slug or URL) into a canonical RepoRef.
 * Accepts: owner/repo, owner/repo@branch, https://github.com/owner/repo,
 * https://github.com/owner/repo/tree/branch (and http://, www., trailing .git, trailing /).
 * Throws Error on invalid input.
 */
export function normalizeRepoRef(slugOrUrl: string): RepoRef {
    if (typeof slugOrUrl !== "string") {
        throw new Error("Repo reference must be a string");
    }

    if (!slugOrUrl || slugOrUrl.trim() === "") {
        throw new Error("Repo reference cannot be empty");
    }

    let input = slugOrUrl.trim();

    // Strip protocol (http:// or https://) and optional www., case-insensitively
    input = input.replace(/^https?:\/\/(www\.)?/i, "");

    // Strip github.com/ prefix if present (case-insensitive)
    if (input.toLowerCase().startsWith("github.com/")) {
        input = input.slice("github.com/".length);
    }

    // Strip trailing slash
    if (input.endsWith("/")) {
        input = input.slice(0, -1);
    }

    // Strip trailing .git
    if (input.endsWith(".git")) {
        input = input.slice(0, -4);
    }

    // Parse branch from @branch suffix or /tree/branch
    let branch = "main";
    let ownerRepoPart = input;

    // Check for /tree/<branch> first
    const treeMatch = input.match(/^([^/]+\/[^/]+)\/tree\/(.+)$/);
    if (treeMatch) {
        ownerRepoPart = treeMatch[1];
        branch = treeMatch[2];
    } else {
        // Check for @branch suffix
        const atIndex = input.indexOf("@");
        if (atIndex !== -1) {
            ownerRepoPart = input.slice(0, atIndex);
            branch = input.slice(atIndex + 1);
        }
    }

    // Validate branch
    if (!branch) {
        throw new Error("Branch cannot be empty");
    }
    if (/\s/.test(branch)) {
        throw new Error("Branch cannot contain whitespace");
    }
    if (branch.includes("..")) {
        throw new Error("Branch cannot contain '..'");
    }

    // Parse owner/repo
    const parts = ownerRepoPart.split("/");

    // Reject extra path segments (anything beyond owner/repo)
    if (parts.length > 2) {
        throw new Error(
            "Invalid repo reference: extra path segments (not /tree/<branch>)",
        );
    }

    if (parts.length !== 2) {
        throw new Error("Invalid repo reference: must be owner/repo");
    }

    const [owner, repo] = parts;

    // Validate owner
    if (!owner || owner.trim() === "") {
        throw new Error("Owner cannot be empty");
    }
    if (!VALID_NAME_PATTERN.test(owner)) {
        throw new Error("Invalid owner: must match [A-Za-z0-9][A-Za-z0-9._-]*");
    }

    // Validate repo
    if (!repo || repo.trim() === "") {
        throw new Error("Repo cannot be empty");
    }
    if (!VALID_NAME_PATTERN.test(repo)) {
        throw new Error("Invalid repo: must match [A-Za-z0-9][A-Za-z0-9._-]*");
    }

    return { owner, repo, branch };
}

/**
 * Build a raw.githubusercontent.com URL for fetching a file from a repo ref.
 * Strips one leading slash from path to avoid double slashes.
 */
export function rawUrl(ref: RepoRef, path: string): string {
    // Strip one leading slash from path
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${ref.branch}/${cleanPath}`;
}

/**
 * Check whether a relative path is safe (no .., /, \, :, and each segment
 * matches [A-Za-z0-9._-]+). Used to validate plugin paths, manifest entry, and
 * index paths before building URLs.
 */
export function isSafeRelPath(p: string): boolean {
    if (typeof p !== "string" || p === "") return false;
    if (p.includes("\\") || p.includes(":")) return false;
    const segments = p.split("/");
    if (segments.length === 0) return false;
    // No empty segments (leading/trailing/double slash), no . or ..
    for (const seg of segments) {
        if (seg === "" || seg === "." || seg === "..") return false;
        if (!/^[A-Za-z0-9._-]+$/.test(seg)) return false;
    }
    return true;
}

/**
 * Check whether a string is a valid Git commit SHA (40 lowercase hex characters).
 */
export function isCommitSha(s: string): boolean {
    return typeof s === "string" && /^[0-9a-f]{40}$/.test(s);
}

/**
 * Build a pinned raw.githubusercontent.com URL using a commit SHA. The ONLY
 * URL builder for plugin files (manifest, bundle). Throws unless the SHA is
 * a valid commit SHA and all path parts are safe relative paths.
 */
export function pinnedFileUrl(
    ref: RepoRef,
    sha: string,
    ...parts: string[]
): string {
    if (!isCommitSha(sha)) {
        throw new Error(`Invalid commit SHA: ${sha}`);
    }
    for (const part of parts) {
        if (!isSafeRelPath(part)) {
            throw new Error(`Unsafe path component: ${part}`);
        }
    }
    const path = parts.join("/");
    return `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${sha}/${path}`;
}

/**
 * Build the GitHub API URL for resolving a branch to a commit SHA.
 */
export function commitShaApiUrl(ref: RepoRef): string {
    return `https://api.github.com/repos/${ref.owner}/${ref.repo}/commits/${encodeURIComponent(ref.branch)}`;
}

/**
 * Build a canonical repo key (owner/repo@branch, with owner and repo lowercased).
 * If the input is a RepoRef, use it directly; if it's a string, try to parse it
 * first, falling back to the raw string if parsing fails.
 */
export function repoKey(refOrString: RepoRef | string): string {
    let ref: RepoRef;
    if (typeof refOrString === "string") {
        try {
            ref = normalizeRepoRef(refOrString);
        } catch {
            return refOrString;
        }
    } else {
        ref = refOrString;
    }
    return `${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}@${ref.branch}`;
}

/**
 * Parse a plugin index.json (schema 1) into an array of PluginIndexEntry.
 * Throws on bad top-level structure (not object, missing/wrong schema, plugins not array).
 * Drops individual invalid entries (missing fields, invalid semver) rather than throwing.
 */
export function parseIndex(input: unknown): PluginIndexEntry[] {
    // Top-level validation: must be object
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw new Error("Index must be an object");
    }

    const obj = input as Record<string, unknown>;

    // Validate schema
    if (!("schema" in obj)) {
        throw new Error("Index missing required 'schema' field");
    }
    if (obj.schema !== 1) {
        throw new Error("Unsupported schema version (expected 1)");
    }

    // Validate plugins is an array
    if (!("plugins" in obj)) {
        throw new Error("Index missing required 'plugins' field");
    }
    if (!Array.isArray(obj.plugins)) {
        throw new Error("Index 'plugins' must be an array");
    }

    // Filter and validate individual entries
    const result: PluginIndexEntry[] = [];

    for (const entry of obj.plugins) {
        // Entry must be an object
        if (
            typeof entry !== "object" ||
            entry === null ||
            Array.isArray(entry)
        ) {
            continue; // drop non-object entries
        }

        const e = entry as Record<string, unknown>;

        // All required fields must be non-empty strings
        const id = e.id;
        const name = e.name;
        const version = e.version;
        const description = e.description;
        const author = e.author;
        const path = e.path;

        if (
            typeof id !== "string" ||
            id.trim() === "" ||
            typeof name !== "string" ||
            name.trim() === "" ||
            typeof version !== "string" ||
            version.trim() === "" ||
            typeof description !== "string" ||
            description.trim() === "" ||
            typeof author !== "string" ||
            author.trim() === "" ||
            typeof path !== "string" ||
            path.trim() === ""
        ) {
            continue; // drop entries missing required fields
        }

        // Version must be valid semver
        if (!isValidSemver(version)) {
            continue; // drop entries with invalid version
        }

        // Path must be safe
        if (!isSafeRelPath(path)) {
            continue; // drop entries with unsafe path
        }

        // Entry is valid
        result.push({
            id,
            name,
            version,
            description,
            author,
            path,
        });
    }

    return result;
}
