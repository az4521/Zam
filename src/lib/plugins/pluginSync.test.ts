import { describe, it, expect } from "vitest";
import {
    buildSyncPayload,
    parseSyncPayload,
    type LocalSyncSnapshot,
} from "./pluginSync";

const snap = (): LocalSyncSnapshot => ({
    repos: ["a/b"],
    autoUpdate: true,
    plugins: {
        "zam.sample": {
            enabled: true,
            source: "builtin",
            version: "1.0.0",
            settings: { greeting: "hi" },
        },
        "x.y": {
            enabled: false,
            source: "repo",
            version: "2.0.0",
            repoRef: "a/b",
            autoUpdate: false,
        },
    },
});

describe("buildSyncPayload", () => {
    it("stamps version 1 and copies fields", () => {
        const p = buildSyncPayload(snap());
        expect(p.version).toBe(1);
        expect(p.repos).toEqual(["a/b"]);
        expect(p.autoUpdate).toBe(true);
        expect(p.plugins["zam.sample"].settings).toEqual({ greeting: "hi" });
        expect(p.plugins["x.y"].repoRef).toBe("a/b");
    });
    it("returns a fresh object (not the same refs)", () => {
        const s = snap();
        const p = buildSyncPayload(s);
        expect(p.repos).not.toBe(s.repos);
        expect(p.plugins).not.toBe(s.plugins);
    });
    it("whitelists entry fields (drops unknown keys)", () => {
        const s = snap();
        (
            s.plugins["zam.sample"] as unknown as Record<string, unknown>
        ).secretToken = "leak";
        const p = buildSyncPayload(s);
        expect("secretToken" in p.plugins["zam.sample"]).toBe(false);
    });
});

describe("parseSyncPayload", () => {
    it("returns null for a non-object", () => {
        expect(parseSyncPayload(null)).toBeNull();
        expect(parseSyncPayload("x")).toBeNull();
        expect(parseSyncPayload(42)).toBeNull();
    });
    it("returns null when version !== 1", () => {
        expect(
            parseSyncPayload({
                version: 2,
                plugins: {},
                repos: [],
                autoUpdate: false,
            }),
        ).toBeNull();
    });
    it("round-trips a built payload", () => {
        const p = buildSyncPayload(snap());
        const back = parseSyncPayload(JSON.parse(JSON.stringify(p)));
        expect(back).toEqual(p);
    });
    it("defaults autoUpdate to false when absent", () => {
        const back = parseSyncPayload({ version: 1, plugins: {}, repos: [] });
        expect(back?.autoUpdate).toBe(false);
    });
    it("filters non-string repos", () => {
        const back = parseSyncPayload({
            version: 1,
            plugins: {},
            repos: ["a/b", 5, null],
            autoUpdate: false,
        });
        expect(back?.repos).toEqual(["a/b"]);
    });
    it("drops a malformed plugin entry (bad enabled/source) but keeps good ones", () => {
        const back = parseSyncPayload({
            version: 1,
            repos: [],
            autoUpdate: false,
            plugins: {
                good: { enabled: true, source: "repo" },
                badEnabled: { enabled: "yes", source: "repo" },
                badSource: { enabled: true, source: "nope" },
            },
        });
        expect(Object.keys(back!.plugins)).toEqual(["good"]);
    });
    it("keeps a plain-object settings, drops a non-object settings", () => {
        const back = parseSyncPayload({
            version: 1,
            repos: [],
            autoUpdate: false,
            plugins: {
                a: { enabled: true, source: "builtin", settings: { k: 1 } },
                b: { enabled: true, source: "builtin", settings: "oops" },
            },
        });
        expect(back!.plugins.a.settings).toEqual({ k: 1 });
        expect(back!.plugins.b.settings).toBeUndefined();
    });
    it("parseSyncPayload returns a fresh settings object (not the raw ref)", () => {
        const raw = {
            version: 1,
            repos: [],
            autoUpdate: false,
            plugins: {
                a: { enabled: true, source: "builtin", settings: { k: 1 } },
            },
        };
        const back = parseSyncPayload(raw);
        expect(back!.plugins.a.settings).not.toBe(raw.plugins.a.settings);
        expect(back!.plugins.a.settings).toEqual({ k: 1 });
    });
});
