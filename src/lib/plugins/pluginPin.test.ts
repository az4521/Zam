import { describe, it, expect } from "vitest";
import { checkInstallId, decideRepoLoad } from "./pluginPin";
import type { RepoRef } from "./repo";

describe("checkInstallId", () => {
    const ref: RepoRef = { owner: "owner", repo: "repo", branch: "main" };

    it("returns null when manifest id matches entry id and no conflicts", () => {
        const err = checkInstallId({
            entryId: "com.example.foo",
            manifestId: "com.example.foo",
            repoRef: ref,
            builtinIds: ["com.zam.builtin"],
            installed: {},
        });
        expect(err).toBeNull();
    });

    it("returns error when manifest id != entry id", () => {
        const err = checkInstallId({
            entryId: "com.example.foo",
            manifestId: "com.example.bar",
            repoRef: ref,
            builtinIds: [],
            installed: {},
        });
        expect(err).toMatch(/id mismatch/i);
    });

    it("returns error when manifest id is a built-in id", () => {
        const err = checkInstallId({
            entryId: "com.zam.dice",
            manifestId: "com.zam.dice",
            repoRef: ref,
            builtinIds: ["com.zam.dice"],
            installed: {},
        });
        expect(err).toMatch(/built-in/i);
    });

    it("returns error when id already installed from a different repo", () => {
        const err = checkInstallId({
            entryId: "com.example.foo",
            manifestId: "com.example.foo",
            repoRef: ref,
            builtinIds: [],
            installed: {
                "com.example.foo": {
                    source: "repo",
                    repoRef: { owner: "other", repo: "other", branch: "main" },
                },
            },
        });
        expect(err).toMatch(/already installed/i);
    });

    it("returns null when same repo re-install", () => {
        const err = checkInstallId({
            entryId: "com.example.foo",
            manifestId: "com.example.foo",
            repoRef: ref,
            builtinIds: [],
            installed: {
                "com.example.foo": {
                    source: "repo",
                    repoRef: ref,
                },
            },
        });
        expect(err).toBeNull();
    });

    it("returns error when id is installed as builtin", () => {
        const err = checkInstallId({
            entryId: "com.example.foo",
            manifestId: "com.example.foo",
            repoRef: ref,
            builtinIds: [],
            installed: {
                "com.example.foo": {
                    source: "builtin",
                },
            },
        });
        expect(err).toMatch(/built-in/i);
    });
});

describe("decideRepoLoad", () => {
    it("uses cache when pinned and cache usable", () => {
        const result = decideRepoLoad({
            pinnedSha: "a".repeat(40),
            cacheUsable: true,
            hasAnyCache: true,
            resolvedSha: null,
        });
        expect(result.kind).toBe("cache");
        expect(result.record).toBeUndefined();
    });

    it("fetches at pinned sha when pinned and cache not usable", () => {
        const sha = "a".repeat(40);
        const result = decideRepoLoad({
            pinnedSha: sha,
            cacheUsable: false,
            hasAnyCache: false,
            resolvedSha: null,
        });
        expect(result.kind).toBe("fetch");
        if (result.kind === "fetch") {
            expect(result.sha).toBe(sha);
        }
        expect(result.record).toBeUndefined();
    });

    it("records sha and uses cache when unpinned with resolved sha and cache usable", () => {
        const sha = "b".repeat(40);
        const result = decideRepoLoad({
            pinnedSha: null,
            cacheUsable: true,
            hasAnyCache: true,
            resolvedSha: sha,
        });
        expect(result.kind).toBe("cache");
        expect(result.record).toBe(sha);
    });

    it("records sha and fetches when unpinned with resolved sha and cache not usable", () => {
        const sha = "b".repeat(40);
        const result = decideRepoLoad({
            pinnedSha: null,
            cacheUsable: false,
            hasAnyCache: false,
            resolvedSha: sha,
        });
        expect(result.kind).toBe("fetch");
        if (result.kind === "fetch") {
            expect(result.sha).toBe(sha);
        }
        expect(result.record).toBe(sha);
    });

    it("uses cache when unpinned and resolve failed but cache exists", () => {
        const result = decideRepoLoad({
            pinnedSha: null,
            cacheUsable: false,
            hasAnyCache: true,
            resolvedSha: null,
        });
        expect(result.kind).toBe("cache");
        expect(result.record).toBeUndefined();
    });

    it("marks needs-update when unpinned and resolve failed with no cache", () => {
        const result = decideRepoLoad({
            pinnedSha: null,
            cacheUsable: false,
            hasAnyCache: false,
            resolvedSha: null,
        });
        expect(result.kind).toBe("needs-update");
        expect(result.record).toBeUndefined();
    });
});
