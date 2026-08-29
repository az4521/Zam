import { describe, it, expect } from "vitest";
import {
    OFFICIAL_REPO,
    repoIdentity,
    mergeRepoList,
    canAddRepo,
    sortInstalledPlugins,
} from "./repoList";

describe("repoIdentity", () => {
    it("normalizes slug, URL and @main to the same identity", () => {
        const a = repoIdentity("Az4521/Zam-Plugins");
        const b = repoIdentity("https://github.com/az4521/zam-plugins");
        const c = repoIdentity("az4521/zam-plugins@main");
        expect(a).toBe("az4521/zam-plugins@main");
        expect(b).toBe(a);
        expect(c).toBe(a);
    });
    it("keeps a non-default branch distinct", () => {
        expect(repoIdentity("a/b@dev")).toBe("a/b@dev");
        expect(repoIdentity("a/b@dev")).not.toBe(repoIdentity("a/b"));
    });
    it("returns null for an unparseable ref", () => {
        expect(repoIdentity("not a repo")).toBeNull();
        expect(repoIdentity("")).toBeNull();
    });
});

describe("mergeRepoList", () => {
    it("puts the official repo first and marks it official", () => {
        const list = mergeRepoList([]);
        expect(list[0]).toEqual({ ref: OFFICIAL_REPO, official: true });
        expect(list).toHaveLength(1);
    });
    it("appends user repos after the official one", () => {
        const list = mergeRepoList(["owner/one", "owner/two"]);
        expect(list.map((r) => r.ref)).toEqual([
            OFFICIAL_REPO,
            "owner/one",
            "owner/two",
        ]);
        expect(list.slice(1).every((r) => r.official === false)).toBe(true);
    });
    it("drops a user entry duplicating the official repo (any form)", () => {
        const list = mergeRepoList(["https://github.com/az4521/zam-plugins"]);
        expect(list).toHaveLength(1);
    });
    it("dedupes user repos among themselves and drops invalid refs", () => {
        const list = mergeRepoList(["o/r", "O/R", "garbage ref"]);
        expect(list.map((r) => r.ref)).toEqual([OFFICIAL_REPO, "o/r"]);
    });

    it("mergeRepoList drops the official repo entered as an uppercase slug", () => {
        const merged = mergeRepoList(["Az4521/Zam-Plugins"]);
        // exactly one entry, and it is the official (non-removable) one
        const officialCount = merged.filter((r) => r.official).length;
        expect(officialCount).toBe(1);
        expect(merged.length).toBe(1);
    });

    it("mergeRepoList drops the official repo entered with an explicit @main", () => {
        const merged = mergeRepoList(["az4521/zam-plugins@main"]);
        expect(merged.length).toBe(1);
        expect(merged[0].official).toBe(true);
    });
});

describe("canAddRepo", () => {
    it("rejects empty input", () => {
        expect(canAddRepo([], "  ").ok).toBe(false);
    });
    it("rejects an invalid ref with the parser's message", () => {
        const r = canAddRepo([], "one-part");
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/owner\/repo/i);
    });
    it("rejects the official repo", () => {
        const r = canAddRepo([], "az4521/zam-plugins");
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/official/i);
    });
    it("rejects an already-added repo (normalized match)", () => {
        const r = canAddRepo(["owner/repo"], "https://github.com/Owner/Repo");
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/already/i);
    });
    it("accepts a fresh repo and returns the normalized slug (no @main)", () => {
        const r = canAddRepo([], "https://github.com/Some/Thing");
        expect(r).toEqual({ ok: true, normalized: "Some/Thing" });
    });
    it("keeps a non-default branch in the normalized slug", () => {
        const r = canAddRepo([], "some/thing@dev");
        expect(r).toEqual({ ok: true, normalized: "some/thing@dev" });
    });

    it("canAddRepo rejects the official repo entered as a .git URL", () => {
        const res = canAddRepo([], "https://github.com/az4521/zam-plugins.git");
        expect(res.ok).toBe(false);
        expect(res.reason).toMatch(/official/i);
    });

    it("rejects the official repo with default allowOfficial=false", () => {
        const r = canAddRepo([], OFFICIAL_REPO);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("That is the official repo (already included).");
    });

    it("allows the official repo when allowOfficial=true", () => {
        const r = canAddRepo([], OFFICIAL_REPO, true);
        expect(r.ok).toBe(true);
        expect(r.normalized).toBe("az4521/zam-plugins");
    });

    it("still rejects malformed input when allowOfficial=true", () => {
        const r = canAddRepo([], "not a repo!!", true);
        expect(r.ok).toBe(false);
    });

    it("still rejects duplicate official repo when allowOfficial=true", () => {
        const r = canAddRepo([OFFICIAL_REPO], OFFICIAL_REPO, true);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("That repo is already added.");
    });
});

describe("sortInstalledPlugins", () => {
    it("orders built-ins before repo plugins, each alphabetized by name", () => {
        const items = [
            { source: "repo" as const, name: "Zebra", id: "z" },
            { source: "builtin" as const, name: "beta", id: "b" },
            { source: "repo" as const, name: "apple", id: "a" },
            { source: "builtin" as const, name: "Alpha", id: "al" },
        ];
        expect(sortInstalledPlugins(items).map((i) => i.id)).toEqual([
            "al",
            "b",
            "a",
            "z",
        ]);
    });
    it("does not mutate the input", () => {
        const items = [
            { source: "repo" as const, name: "b", id: "b" },
            { source: "builtin" as const, name: "a", id: "a" },
        ];
        const copy = [...items];
        sortInstalledPlugins(items);
        expect(items).toEqual(copy);
    });
});
