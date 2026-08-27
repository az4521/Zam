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
