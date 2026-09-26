import { describe, it, expect } from "vitest";
import {
    normalizeRepoRef,
    rawUrl,
    parseIndex,
    isSafeRelPath,
    isCommitSha,
    pinnedFileUrl,
    commitShaApiUrl,
    repoKey,
    type RepoRef,
} from "./repo";

describe("normalizeRepoRef", () => {
    it("accepts owner/repo and defaults to main branch", () => {
        const result = normalizeRepoRef("owner/repo");
        expect(result).toEqual({
            owner: "owner",
            repo: "repo",
            branch: "main",
        });
    });

    it("accepts owner/repo@branch", () => {
        const result = normalizeRepoRef("owner/repo@develop");
        expect(result).toEqual({
            owner: "owner",
            repo: "repo",
            branch: "develop",
        });
    });

    it("accepts https://github.com/owner/repo", () => {
        const result = normalizeRepoRef("https://github.com/owner/repo");
        expect(result).toEqual({
            owner: "owner",
            repo: "repo",
            branch: "main",
        });
    });

    it("accepts http://github.com/owner/repo", () => {
        const result = normalizeRepoRef("http://github.com/owner/repo");
        expect(result).toEqual({
            owner: "owner",
            repo: "repo",
            branch: "main",
        });
    });

    it("accepts https://www.github.com/owner/repo", () => {
        const result = normalizeRepoRef("https://www.github.com/owner/repo");
        expect(result).toEqual({
            owner: "owner",
            repo: "repo",
            branch: "main",
        });
    });

    it("strips trailing slash from URL", () => {
        const result = normalizeRepoRef("https://github.com/owner/repo/");
        expect(result).toEqual({
            owner: "owner",
            repo: "repo",
            branch: "main",
        });
    });

    it("strips trailing .git from URL", () => {
        const result = normalizeRepoRef("https://github.com/owner/repo.git");
        expect(result).toEqual({
            owner: "owner",
            repo: "repo",
            branch: "main",
        });
    });

    it("accepts https://github.com/owner/repo/tree/branch", () => {
        const result = normalizeRepoRef(
            "https://github.com/owner/repo/tree/feature-x",
        );
        expect(result).toEqual({
            owner: "owner",
            repo: "repo",
            branch: "feature-x",
        });
    });

    it("handles owner and repo with dots, dashes, underscores", () => {
        const result = normalizeRepoRef("my.owner_123/repo-name.test");
        expect(result).toEqual({
            owner: "my.owner_123",
            repo: "repo-name.test",
            branch: "main",
        });
    });

    it("throws on empty string", () => {
        expect(() => normalizeRepoRef("")).toThrow(/empty/i);
    });

    it("throws on owner only (missing repo)", () => {
        expect(() => normalizeRepoRef("owner")).toThrow(/repo/i);
    });

    it("throws on owner/ (missing repo after slash)", () => {
        expect(() => normalizeRepoRef("owner/")).toThrow(/repo/i);
    });

    it("throws on /repo (missing owner)", () => {
        expect(() => normalizeRepoRef("/repo")).toThrow(/owner/i);
    });

    it("throws on owner/repo/extra (extra path segment not /tree/)", () => {
        expect(() => normalizeRepoRef("owner/repo/extra")).toThrow(
            /tree|segment/i,
        );
    });

    it("throws on owner with space", () => {
        expect(() => normalizeRepoRef("own er/repo")).toThrow(/owner|invalid/i);
    });

    it("throws on path traversal (..)", () => {
        expect(() => normalizeRepoRef("../x")).toThrow(/\.\.|owner|invalid/i);
    });

    it("throws on owner/repo@ (empty branch)", () => {
        expect(() => normalizeRepoRef("owner/repo@")).toThrow(/branch/i);
    });

    it("throws on branch with spaces", () => {
        expect(() => normalizeRepoRef("owner/repo@feat x")).toThrow(
            /branch|whitespace/i,
        );
    });

    it("throws on branch with ..", () => {
        expect(() => normalizeRepoRef("owner/repo@../bad")).toThrow(
            /branch|\.\./i,
        );
    });

    it("throws on null input", () => {
        expect(() => normalizeRepoRef(null as any)).toThrow(/string/i);
    });

    it("throws on undefined input", () => {
        expect(() => normalizeRepoRef(undefined as any)).toThrow(/string/i);
    });

    it("throws on number input", () => {
        expect(() => normalizeRepoRef(42 as any)).toThrow(/string/i);
    });

    it("throws on object input", () => {
        expect(() => normalizeRepoRef({} as any)).toThrow(/string/i);
    });

    it("throws on array input", () => {
        expect(() => normalizeRepoRef([] as any)).toThrow(/string/i);
    });
});

describe("rawUrl", () => {
    const ref: RepoRef = { owner: "owner", repo: "repo", branch: "main" };

    it("builds the raw.githubusercontent.com URL", () => {
        const url = rawUrl(ref, "plugin.json");
        expect(url).toBe(
            "https://raw.githubusercontent.com/owner/repo/main/plugin.json",
        );
    });

    it("strips one leading slash from path", () => {
        const url = rawUrl(ref, "/plugin.json");
        expect(url).toBe(
            "https://raw.githubusercontent.com/owner/repo/main/plugin.json",
        );
    });

    it("does not introduce double slashes", () => {
        const url = rawUrl(ref, "path/to/file.json");
        expect(url).toBe(
            "https://raw.githubusercontent.com/owner/repo/main/path/to/file.json",
        );
        expect(url).not.toContain("//main//");
    });

    it("handles deep paths", () => {
        const url = rawUrl(ref, "plugins/foo/manifest.json");
        expect(url).toBe(
            "https://raw.githubusercontent.com/owner/repo/main/plugins/foo/manifest.json",
        );
    });
});

describe("parseIndex", () => {
    it("parses a valid index with multiple entries", () => {
        const input = {
            schema: 1,
            plugins: [
                {
                    id: "foo",
                    name: "Foo Plugin",
                    version: "1.0.0",
                    description: "A foo plugin",
                    author: "Alice",
                    path: "plugins/foo",
                },
                {
                    id: "bar",
                    name: "Bar Plugin",
                    version: "2.1.3",
                    description: "A bar plugin",
                    author: "Bob",
                    path: "plugins/bar",
                },
            ],
        };
        const result = parseIndex(input);
        expect(result).toEqual([
            {
                id: "foo",
                name: "Foo Plugin",
                version: "1.0.0",
                description: "A foo plugin",
                author: "Alice",
                path: "plugins/foo",
            },
            {
                id: "bar",
                name: "Bar Plugin",
                version: "2.1.3",
                description: "A bar plugin",
                author: "Bob",
                path: "plugins/bar",
            },
        ]);
    });

    it("drops entries with invalid semver but keeps valid ones in order", () => {
        const input = {
            schema: 1,
            plugins: [
                {
                    id: "foo",
                    name: "Foo",
                    version: "1.0.0",
                    description: "Valid",
                    author: "Alice",
                    path: "foo",
                },
                {
                    id: "bad",
                    name: "Bad",
                    version: "not-semver",
                    description: "Invalid",
                    author: "Bad",
                    path: "bad",
                },
                {
                    id: "bar",
                    name: "Bar",
                    version: "2.0.0",
                    description: "Valid",
                    author: "Bob",
                    path: "bar",
                },
            ],
        };
        const result = parseIndex(input);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe("foo");
        expect(result[1].id).toBe("bar");
    });

    it("drops entries missing required fields", () => {
        const input = {
            schema: 1,
            plugins: [
                {
                    id: "foo",
                    name: "Foo",
                    version: "1.0.0",
                    description: "Valid",
                    author: "Alice",
                    path: "foo",
                },
                {
                    id: "bad",
                    // missing name
                    version: "2.0.0",
                    description: "Invalid",
                    author: "Bad",
                    path: "bad",
                },
                {
                    id: "bar",
                    name: "Bar",
                    version: "3.0.0",
                    description: "Valid",
                    author: "Bob",
                    path: "bar",
                },
            ],
        };
        const result = parseIndex(input);
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe("foo");
        expect(result[1].id).toBe("bar");
    });

    it("drops entries with empty string fields", () => {
        const input = {
            schema: 1,
            plugins: [
                {
                    id: "",
                    name: "Empty ID",
                    version: "1.0.0",
                    description: "Invalid",
                    author: "Alice",
                    path: "foo",
                },
                {
                    id: "bar",
                    name: "Bar",
                    version: "2.0.0",
                    description: "Valid",
                    author: "Bob",
                    path: "bar",
                },
            ],
        };
        const result = parseIndex(input);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("bar");
    });

    it("throws on non-object input", () => {
        expect(() => parseIndex(null)).toThrow(/object/i);
        expect(() => parseIndex("string")).toThrow(/object/i);
        expect(() => parseIndex(42)).toThrow(/object/i);
        expect(() => parseIndex([])).toThrow(/object/i);
    });

    it("throws on missing schema field", () => {
        expect(() => parseIndex({ plugins: [] })).toThrow(/schema/i);
    });

    it("throws on schema !== 1", () => {
        expect(() => parseIndex({ schema: 2, plugins: [] })).toThrow(/schema/i);
    });

    it("throws on plugins not being an array", () => {
        expect(() => parseIndex({ schema: 1, plugins: "not-array" })).toThrow(
            /plugins|array/i,
        );
        expect(() => parseIndex({ schema: 1, plugins: {} })).toThrow(
            /plugins|array/i,
        );
    });

    it("returns empty array when all entries are invalid", () => {
        const input = {
            schema: 1,
            plugins: [
                { id: "bad", version: "not-semver" },
                { name: "missing-id" },
            ],
        };
        const result = parseIndex(input);
        expect(result).toEqual([]);
    });

    it("drops non-object entries", () => {
        const input = {
            schema: 1,
            plugins: [
                {
                    id: "foo",
                    name: "Foo",
                    version: "1.0.0",
                    description: "Valid",
                    author: "Alice",
                    path: "foo",
                },
                "not-an-object",
                42,
                null,
            ],
        };
        const result = parseIndex(input);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("foo");
    });

    it("parseIndex drops an entry missing path, keeps valid siblings", () => {
        const out = parseIndex({
            schema: 1,
            plugins: [
                {
                    id: "ok",
                    name: "OK",
                    version: "1.0.0",
                    description: "d",
                    author: "a",
                    path: "plugins/ok",
                },
                {
                    id: "nopath",
                    name: "No Path",
                    version: "1.0.0",
                    description: "d",
                    author: "a",
                },
            ],
        });
        expect(out.map((e) => e.id)).toEqual(["ok"]);
    });

    it("parseIndex throws when schema is a string rather than number 1", () => {
        expect(() => parseIndex({ schema: "1", plugins: [] })).toThrow();
    });

    it("parseIndex drops an entry with a whitespace-only field", () => {
        const out = parseIndex({
            schema: 1,
            plugins: [
                {
                    id: "x",
                    name: "X",
                    version: "1.0.0",
                    description: "d",
                    author: "   ",
                    path: "p",
                },
            ],
        });
        expect(out).toEqual([]);
    });

    it("parseIndex drops entries with unsafe paths", () => {
        const out = parseIndex({
            schema: 1,
            plugins: [
                {
                    id: "ok",
                    name: "OK",
                    version: "1.0.0",
                    description: "d",
                    author: "a",
                    path: "plugins/ok",
                },
                {
                    id: "dotdot",
                    name: "DotDot",
                    version: "1.0.0",
                    description: "d",
                    author: "a",
                    path: "../bad",
                },
                {
                    id: "abs",
                    name: "Absolute",
                    version: "1.0.0",
                    description: "d",
                    author: "a",
                    path: "/etc/passwd",
                },
                {
                    id: "scheme",
                    name: "Scheme",
                    version: "1.0.0",
                    description: "d",
                    author: "a",
                    path: "https://evil.com/x",
                },
            ],
        });
        expect(out.map((e) => e.id)).toEqual(["ok"]);
    });
});

describe("isSafeRelPath", () => {
    it("accepts a simple filename", () => {
        expect(isSafeRelPath("file.txt")).toBe(true);
    });

    it("accepts a relative path with slashes", () => {
        expect(isSafeRelPath("plugins/com.zam.dice")).toBe(true);
    });

    it("accepts alphanumeric, dots, dashes, underscores in segments", () => {
        expect(isSafeRelPath("foo-bar_123/baz.qux")).toBe(true);
    });

    it("rejects empty string", () => {
        expect(isSafeRelPath("")).toBe(false);
    });

    it("rejects path with .. segment", () => {
        expect(isSafeRelPath("../etc/passwd")).toBe(false);
        expect(isSafeRelPath("foo/../bar")).toBe(false);
    });

    it("rejects path with . segment", () => {
        expect(isSafeRelPath("./foo")).toBe(false);
        expect(isSafeRelPath("foo/./bar")).toBe(false);
    });

    it("rejects leading slash (absolute)", () => {
        expect(isSafeRelPath("/etc/passwd")).toBe(false);
    });

    it("rejects trailing slash", () => {
        expect(isSafeRelPath("foo/")).toBe(false);
    });

    it("rejects double slash", () => {
        expect(isSafeRelPath("foo//bar")).toBe(false);
    });

    it("rejects backslash", () => {
        expect(isSafeRelPath("foo\\bar")).toBe(false);
    });

    it("rejects colon (scheme)", () => {
        expect(isSafeRelPath("https://evil.com")).toBe(false);
        expect(isSafeRelPath("C:\\bad")).toBe(false);
    });

    it("rejects segments with spaces", () => {
        expect(isSafeRelPath("foo bar/baz")).toBe(false);
    });

    it("rejects segments with special characters", () => {
        expect(isSafeRelPath("foo@bar")).toBe(false);
        expect(isSafeRelPath("foo#bar")).toBe(false);
    });
});

describe("isCommitSha", () => {
    it("accepts a 40-character hex string", () => {
        expect(isCommitSha("a".repeat(40))).toBe(true);
        expect(isCommitSha("0123456789abcdef0123456789abcdef01234567")).toBe(
            true,
        );
    });

    it("rejects shorter than 40 characters", () => {
        expect(isCommitSha("a".repeat(39))).toBe(false);
    });

    it("rejects longer than 40 characters", () => {
        expect(isCommitSha("a".repeat(41))).toBe(false);
    });

    it("rejects uppercase hex", () => {
        expect(isCommitSha("A".repeat(40))).toBe(false);
    });

    it("rejects non-hex characters", () => {
        expect(isCommitSha("g".repeat(40))).toBe(false);
        expect(isCommitSha("0".repeat(39) + "x")).toBe(false);
    });

    it("rejects empty string", () => {
        expect(isCommitSha("")).toBe(false);
    });
});

describe("pinnedFileUrl", () => {
    const ref: RepoRef = { owner: "owner", repo: "repo", branch: "main" };
    const sha = "a".repeat(40);

    it("builds a pinned URL with single file", () => {
        const url = pinnedFileUrl(ref, sha, "index.json");
        expect(url).toBe(
            "https://raw.githubusercontent.com/owner/repo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.json",
        );
    });

    it("builds a pinned URL with directory and file", () => {
        const url = pinnedFileUrl(ref, sha, "plugins/com.zam.dice", "main.js");
        expect(url).toBe(
            "https://raw.githubusercontent.com/owner/repo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/plugins/com.zam.dice/main.js",
        );
    });

    it("builds a pinned URL with multiple path parts", () => {
        const url = pinnedFileUrl(
            ref,
            sha,
            "plugins",
            "com.zam.dice",
            "manifest.json",
        );
        expect(url).toBe(
            "https://raw.githubusercontent.com/owner/repo/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/plugins/com.zam.dice/manifest.json",
        );
    });

    it("throws when sha is not a commit sha", () => {
        expect(() => pinnedFileUrl(ref, "main", "file.js")).toThrow(/sha/i);
        expect(() => pinnedFileUrl(ref, "short", "file.js")).toThrow(/sha/i);
    });

    it("throws when a part is unsafe", () => {
        expect(() => pinnedFileUrl(ref, sha, "../etc/passwd")).toThrow(
            /path|safe/i,
        );
        expect(() => pinnedFileUrl(ref, sha, "ok", "/abs")).toThrow(
            /path|safe/i,
        );
        expect(() => pinnedFileUrl(ref, sha, "ok", "https://evil.com")).toThrow(
            /path|safe/i,
        );
    });
});

describe("commitShaApiUrl", () => {
    it("builds GitHub API URL for commit SHA", () => {
        const ref: RepoRef = { owner: "owner", repo: "repo", branch: "main" };
        const url = commitShaApiUrl(ref);
        expect(url).toBe("https://api.github.com/repos/owner/repo/commits/main");
    });

    it("encodes branch names with special characters", () => {
        const ref: RepoRef = {
            owner: "owner",
            repo: "repo",
            branch: "feature/x",
        };
        const url = commitShaApiUrl(ref);
        expect(url).toBe(
            "https://api.github.com/repos/owner/repo/commits/feature%2Fx",
        );
    });
});

describe("repoKey", () => {
    it("builds canonical key from RepoRef", () => {
        const ref: RepoRef = { owner: "Owner", repo: "Repo", branch: "main" };
        expect(repoKey(ref)).toBe("owner/repo@main");
    });

    it("lowercases owner and repo", () => {
        const ref: RepoRef = {
            owner: "AZ4521",
            repo: "Zam-Plugins",
            branch: "develop",
        };
        expect(repoKey(ref)).toBe("az4521/zam-plugins@develop");
    });

    it("preserves branch case", () => {
        const ref: RepoRef = {
            owner: "owner",
            repo: "repo",
            branch: "Feature-X",
        };
        expect(repoKey(ref)).toBe("owner/repo@Feature-X");
    });

    it("returns raw string if not a valid ref string", () => {
        expect(repoKey("not-a-ref")).toBe("not-a-ref");
    });

    it("normalizes and builds key from a parseable ref string", () => {
        expect(repoKey("Owner/Repo@branch")).toBe("owner/repo@branch");
        expect(repoKey("https://github.com/Owner/Repo")).toBe("owner/repo@main");
    });
});
