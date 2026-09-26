import { describe, it, expect } from "vitest";
import {
    computeUpdateStatus,
    pluginsToAutoUpdate,
    type InstalledForUpdate,
} from "./updateCheck";
import type { RepoRef } from "./repo";

const repoA: RepoRef = { owner: "owner", repo: "repo", branch: "main" };
const repoB: RepoRef = { owner: "other", repo: "other", branch: "dev" };

const installed: InstalledForUpdate[] = [
    { id: "repoNewer", version: "1.0.0", source: "repo", repoRef: repoA },
    { id: "repoEqual", version: "2.0.0", source: "repo", repoRef: repoA },
    { id: "repoOlderLatest", version: "3.0.0", source: "repo", repoRef: repoA },
    { id: "builtinIgnored", version: "1.0.0", source: "builtin" },
    { id: "repoNoLatest", version: "1.0.0", source: "repo", repoRef: repoA },
    { id: "repoBadSemver", version: "not-semver", source: "repo", repoRef: repoA },
    { id: "repoB", version: "1.0.0", source: "repo", repoRef: repoB },
];
const latestByRepo = {
    "owner/repo@main": {
        repoNewer: "1.2.0",
        repoEqual: "2.0.0",
        repoOlderLatest: "2.0.0",
        builtinIgnored: "9.9.9",
        repoBadSemver: "1.0.0",
    },
    "other/other@dev": {
        repoB: "2.0.0",
    },
};

describe("computeUpdateStatus", () => {
    it("flags hasUpdate when latest > installed for a repo plugin", () => {
        const s = computeUpdateStatus(installed, latestByRepo).find(
            (u) => u.id === "repoNewer",
        );
        expect(s).toEqual({
            id: "repoNewer",
            installedVersion: "1.0.0",
            latestVersion: "1.2.0",
            hasUpdate: true,
        });
    });
    it("no update when versions equal", () => {
        expect(
            computeUpdateStatus(installed, latestByRepo).find(
                (u) => u.id === "repoEqual",
            )?.hasUpdate,
        ).toBe(false);
    });
    it("no update when latest is older", () => {
        expect(
            computeUpdateStatus(installed, latestByRepo).find(
                (u) => u.id === "repoOlderLatest",
            )?.hasUpdate,
        ).toBe(false);
    });
    it("skips built-in plugins (no repo to update from)", () => {
        expect(
            computeUpdateStatus(installed, latestByRepo).find(
                (u) => u.id === "builtinIgnored",
            ),
        ).toBeUndefined();
    });
    it("skips repo plugins with no latest version known", () => {
        expect(
            computeUpdateStatus(installed, latestByRepo).find(
                (u) => u.id === "repoNoLatest",
            ),
        ).toBeUndefined();
    });
    it("treats an invalid semver as no update (never throws)", () => {
        expect(() => computeUpdateStatus(installed, latestByRepo)).not.toThrow();
        expect(
            computeUpdateStatus(installed, latestByRepo).find(
                (u) => u.id === "repoBadSemver",
            )?.hasUpdate,
        ).toBe(false);
    });
    it("looks up latest by repoKey for each plugin", () => {
        const s = computeUpdateStatus(installed, latestByRepo).find(
            (u) => u.id === "repoB",
        );
        expect(s?.hasUpdate).toBe(true);
        expect(s?.latestVersion).toBe("2.0.0");
    });
    it("skips plugins with no repoRef", () => {
        const noRef: InstalledForUpdate[] = [
            { id: "orphan", version: "1.0.0", source: "repo" },
        ];
        expect(computeUpdateStatus(noRef, latestByRepo)).toEqual([]);
    });
});

describe("pluginsToAutoUpdate", () => {
    const status = [
        {
            id: "a",
            installedVersion: "1.0.0",
            latestVersion: "2.0.0",
            hasUpdate: true,
        },
        {
            id: "b",
            installedVersion: "1.0.0",
            latestVersion: "2.0.0",
            hasUpdate: true,
        },
        {
            id: "c",
            installedVersion: "1.0.0",
            latestVersion: "1.0.0",
            hasUpdate: false,
        },
    ];
    it("includes updatable plugins when global auto is on and no override", () => {
        expect(pluginsToAutoUpdate(status, true, {}).sort()).toEqual([
            "a",
            "b",
        ]);
    });
    it("excludes when global off and no override", () => {
        expect(pluginsToAutoUpdate(status, false, {})).toEqual([]);
    });
    it("per-plugin override false beats global on", () => {
        expect(pluginsToAutoUpdate(status, true, { a: false })).toEqual(["b"]);
    });
    it("per-plugin override true beats global off", () => {
        expect(pluginsToAutoUpdate(status, false, { a: true })).toEqual(["a"]);
    });
    it("never includes a plugin without an available update", () => {
        expect(pluginsToAutoUpdate(status, true, { c: true })).not.toContain(
            "c",
        );
    });
});
