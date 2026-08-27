import { describe, it, expect } from "vitest";
import {
    parsePersistedState,
    serializePersistedState,
    emptyPersistedState,
} from "./pluginPersist";

describe("parsePersistedState", () => {
    it("returns empty state for null / empty / garbage", () => {
        expect(parsePersistedState(null)).toEqual(emptyPersistedState());
        expect(parsePersistedState("")).toEqual(emptyPersistedState());
        expect(parsePersistedState("{not json")).toEqual(emptyPersistedState());
    });
    it("returns empty state for an unknown version", () => {
        expect(
            parsePersistedState(JSON.stringify({ version: 2, plugins: {} })),
        ).toEqual(emptyPersistedState());
    });
    it("parses a valid record", () => {
        const raw = JSON.stringify({
            version: 1,
            plugins: {
                "zam.sample": { enabled: true, source: "builtin" },
                "com.x.y": {
                    enabled: false,
                    source: "repo",
                    repoRef: "owner/repo",
                },
            },
        });
        const parsed = parsePersistedState(raw);
        expect(parsed.plugins["zam.sample"]).toEqual({
            enabled: true,
            source: "builtin",
        });
        expect(parsed.plugins["com.x.y"].repoRef).toBe("owner/repo");
    });
    it("skips malformed entries but keeps valid ones", () => {
        const raw = JSON.stringify({
            version: 1,
            plugins: {
                good: { enabled: true, source: "builtin" },
                badEnabled: { enabled: "yes", source: "builtin" },
                badSource: { enabled: true, source: "elsewhere" },
                notObject: 42,
            },
        });
        const parsed = parsePersistedState(raw);
        expect(Object.keys(parsed.plugins)).toEqual(["good"]);
    });
    it("round-trips through serialize", () => {
        const state = emptyPersistedState();
        state.plugins["zam.sample"] = { enabled: true, source: "builtin" };
        expect(parsePersistedState(serializePersistedState(state))).toEqual(
            state,
        );
    });
});

describe("repos persistence", () => {
    it("emptyPersistedState has an empty repos array", () => {
        expect(emptyPersistedState().repos).toEqual([]);
    });
    it("parses a repos string array", () => {
        const raw = JSON.stringify({
            version: 1,
            plugins: {},
            repos: ["a/b", "c/d@dev"],
        });
        expect(parsePersistedState(raw).repos).toEqual(["a/b", "c/d@dev"]);
    });
    it("drops non-string repo entries", () => {
        const raw = JSON.stringify({
            version: 1,
            plugins: {},
            repos: ["a/b", 5, null, "c/d"],
        });
        expect(parsePersistedState(raw).repos).toEqual(["a/b", "c/d"]);
    });
    it("defaults repos to [] when absent (back-compat)", () => {
        const raw = JSON.stringify({ version: 1, plugins: {} });
        expect(parsePersistedState(raw).repos).toEqual([]);
    });
    it("round-trips repos through serialize/parse", () => {
        const state = { version: 1 as const, plugins: {}, repos: ["x/y"] };
        expect(
            parsePersistedState(serializePersistedState(state)).repos,
        ).toEqual(["x/y"]);
    });
});

describe("autoUpdate persistence", () => {
    it("defaults global autoUpdate to false when absent (back-compat)", () => {
        const raw = JSON.stringify({ version: 1, plugins: {}, repos: [] });
        expect(parsePersistedState(raw).autoUpdate).toBe(false);
    });

    it("parses a global autoUpdate=true", () => {
        const raw = JSON.stringify({
            version: 1,
            plugins: {},
            repos: [],
            autoUpdate: true,
        });
        expect(parsePersistedState(raw).autoUpdate).toBe(true);
    });

    it("ignores a non-boolean global autoUpdate (falls back to false)", () => {
        const raw = JSON.stringify({
            version: 1,
            plugins: {},
            repos: [],
            autoUpdate: "yes",
        });
        expect(parsePersistedState(raw).autoUpdate).toBe(false);
    });

    it("parses a per-entry autoUpdate override when boolean", () => {
        const raw = JSON.stringify({
            version: 1,
            plugins: {
                "a.b": { enabled: true, source: "repo", autoUpdate: true },
            },
            repos: [],
        });
        expect(parsePersistedState(raw).plugins["a.b"].autoUpdate).toBe(true);
    });

    it("omits a per-entry autoUpdate when not boolean", () => {
        const raw = JSON.stringify({
            version: 1,
            plugins: {
                "a.b": { enabled: true, source: "repo", autoUpdate: "on" },
            },
            repos: [],
        });
        expect(
            parsePersistedState(raw).plugins["a.b"].autoUpdate,
        ).toBeUndefined();
    });

    it("round-trips global + per-entry autoUpdate through serialize/parse", () => {
        const state = emptyPersistedState();
        state.autoUpdate = true;
        state.plugins["a.b"] = {
            enabled: false,
            source: "repo",
            autoUpdate: false,
        };
        const back = parsePersistedState(serializePersistedState(state));
        expect(back.autoUpdate).toBe(true);
        expect(back.plugins["a.b"].autoUpdate).toBe(false);
    });
});
