import { describe, it, expect } from "vitest";
import { normalizeRepoRef, rawUrl, parseIndex, type RepoRef } from "./repo";

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
});
