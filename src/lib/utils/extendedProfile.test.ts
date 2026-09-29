import { describe, expect, it } from "vitest";
import {
    PROFILE_FIELDS,
    buildBiography,
    buildStatus,
    parseBiography,
    buildCall,
    buildConnections,
    connectionsProblem,
    describeCall,
    formatLocalTime,
    formatStatusMessage,
    normalizeColour,
    parseBanner,
    parseColourPreference,
    parseCallJoinedTs,
    parseConnections,
    parsePronouns,
    parseTimezone,
    readFieldWithLegacy,
    parseStatus,
    planFieldWrite,
    planLegacyStatusMirror,
    pronounsToText,
    readField,
    statusProblem,
    textToPronouns,
} from "./extendedProfile";
import { profileFieldAllowed } from "./serverCapabilities";

describe("readField / planFieldWrite", () => {
    const f = PROFILE_FIELDS.pronouns;

    it("prefers the stable key", () => {
        expect(readField({ [f.stable]: "a", [f.unstable]: "b" }, f)).toBe("a");
        expect(readField({ [f.unstable]: "b" }, f)).toBe("b");
        expect(readField(null, f)).toBeUndefined();
    });

    it("writes the unstable key, mirroring an existing stable one", () => {
        expect(planFieldWrite({}, f, 1)).toEqual([
            { key: f.unstable, value: 1 },
        ]);
        expect(planFieldWrite({ [f.stable]: 0 }, f, 1)).toEqual([
            { key: f.unstable, value: 1 },
            { key: f.stable, value: 1 },
        ]);
    });

    it("deletes only keys that exist", () => {
        expect(planFieldWrite({}, f, null)).toEqual([]);
        expect(planFieldWrite({ [f.unstable]: 0 }, f, null)).toEqual([
            { key: f.unstable, value: null },
        ]);
    });

    it("reads legacy keys only when asked", () => {
        const profile = { "chat.commet.profile_status": "brb" };
        expect(readField(profile, PROFILE_FIELDS.status)).toBeUndefined();
        expect(readFieldWithLegacy(profile, PROFILE_FIELDS.status)).toBe("brb");
    });
});

describe("pronouns", () => {
    it("ignores malformed entries", () => {
        expect(
            parsePronouns([{ summary: " it/its ", language: "en" }, 3, {}]),
        ).toEqual([{ summary: "it/its", language: "en" }]);
        expect(parsePronouns("x")).toEqual([]);
    });

    it("round-trips text, keeping known languages and dropping duplicates", () => {
        const existing = [{ summary: "she/her", language: "fr" }];
        expect(
            textToPronouns("she/her, they/them, they/them,", existing, "en"),
        ).toEqual([
            { summary: "she/her", language: "fr" },
            { summary: "they/them", language: "en" },
        ]);
        expect(pronounsToText(existing)).toBe("she/her");
    });
});

describe("biography", () => {
    it("reads the plaintext entry and skips html", () => {
        expect(
            parseBiography({
                "m.text": [
                    { body: "<b>hi</b>", mimetype: "text/html" },
                    { body: "hi" },
                ],
            }),
        ).toBe("hi");
        expect(parseBiography(undefined)).toBe("");
    });

    it("builds and clears", () => {
        expect(buildBiography(" hi ")).toEqual({ "m.text": [{ body: "hi" }] });
        expect(buildBiography("  ")).toBeNull();
    });
});

describe("status", () => {
    it("needs both parts", () => {
        expect(statusProblem("", "")).toBeNull();
        expect(statusProblem("afk", "🏃")).toBeNull();
        expect(statusProblem("afk", "")).not.toBeNull();
        expect(buildStatus(" afk ", "🏃")).toEqual({
            text: "afk",
            emoji: "🏃",
        });
        expect(buildStatus("", "")).toBeNull();
    });

    it("parses only complete statuses", () => {
        expect(parseStatus({ text: "a", emoji: "b" })).toEqual({
            text: "a",
            emoji: "b",
        });
        expect(parseStatus({ text: "a" })).toBeNull();
    });
});

describe("legacy status mirror", () => {
    const key = "chat.commet.profile_status";

    it("writes one plain string", () => {
        expect(
            planLegacyStatusMirror({}, { text: "brb", emoji: "🏃" }),
        ).toEqual([{ key, value: "🏃 brb" }]);
    });

    it("deletes only an existing key when cleared", () => {
        expect(planLegacyStatusMirror({}, null)).toEqual([]);
        expect(planLegacyStatusMirror({ [key]: "x" }, null)).toEqual([
            { key, value: null },
        ]);
    });
});

describe("status legacy", () => {
    it("accepts Commet's bare string", () => {
        expect(parseStatus("  brb ")).toEqual({ text: "brb", emoji: "" });
        expect(parseStatus("  ")).toBeNull();
    });
});

describe("colour preference", () => {
    it("normalises short and upper-case hex", () => {
        expect(normalizeColour("#F80")).toBe("#ff8800");
        expect(normalizeColour("red")).toBeNull();
    });

    it("needs both halves", () => {
        expect(
            parseColourPreference({ on_dark: "#fff", on_light: "#400" }),
        ).toEqual({ on_dark: "#ffffff", on_light: "#440000" });
        expect(parseColourPreference({ on_dark: "#fff" })).toBeNull();
        expect(parseColourPreference("#fff")).toBeNull();
    });
});

describe("timezone", () => {
    it("accepts only real zones", () => {
        expect(parseTimezone("Europe/London")).toBe("Europe/London");
        expect(parseTimezone("Mars/Base")).toBeNull();
        expect(parseTimezone(5)).toBeNull();
    });

    it("formats a local time", () => {
        expect(
            formatLocalTime("UTC", new Date("2026-01-01T13:05:00Z")),
        ).toMatch(/1:05|13:05/);
        expect(formatLocalTime("Mars/Base", new Date())).toBeNull();
    });
});

describe("banner", () => {
    it("takes mxc uris, unwrapping stray quotes", () => {
        expect(parseBanner("mxc://a/b")).toBe("mxc://a/b");
        expect(parseBanner('"mxc://a/b"')).toBe("mxc://a/b");
        expect(parseBanner("https://a/b")).toBeNull();
    });
});

describe("connections", () => {
    it("drops unsafe schemes and caps the list", () => {
        const parsed = parseConnections([
            { description: "home", uri: "https://example.org" },
            { description: "bad", uri: "javascript:alert(1)" },
            { uri: "not a url" },
            { uri: "matrix:u/a:b.c" },
        ]);
        expect(parsed.map((c) => c.uri)).toEqual([
            "https://example.org",
            "matrix:u/a:b.c",
        ]);
        const many = Array.from({ length: 30 }, () => ({
            uri: "https://example.org",
        }));
        expect(parseConnections(many)).toHaveLength(20);
    });

    it("validates edits and ignores blank rows", () => {
        expect(connectionsProblem([{ description: "", uri: "" }])).toBeNull();
        expect(
            connectionsProblem([{ description: "x", uri: "javascript:1" }]),
        ).not.toBeNull();
        expect(buildConnections([{ description: "", uri: "" }])).toBeNull();
        expect(
            buildConnections([{ description: " a ", uri: " https://e.org " }]),
        ).toEqual([{ description: "a", uri: "https://e.org" }]);
    });
});

describe("profileFieldAllowed", () => {
    it("is permissive without the capability", () => {
        expect(profileFieldAllowed("x", null)).toBe(true);
    });

    it("honours enabled, allowed and disallowed", () => {
        expect(
            profileFieldAllowed("x", {
                "m.profile_fields": { enabled: false },
            }),
        ).toBe(false);
        expect(
            profileFieldAllowed("x", {
                "m.profile_fields": { enabled: true, allowed: ["y"] },
            }),
        ).toBe(false);
        expect(
            profileFieldAllowed("y", {
                "m.profile_fields": { enabled: true, allowed: ["y"] },
            }),
        ).toBe(true);
        expect(
            profileFieldAllowed("y", {
                "m.profile_fields": { enabled: true, disallowed: ["y"] },
            }),
        ).toBe(false);
    });
});

describe("call presence", () => {
    it("builds and parses call_joined_ts in seconds", () => {
        expect(buildCall(1_770_140_640_999)).toEqual({
            call_joined_ts: 1_770_140_640,
        });
        expect(parseCallJoinedTs({ call_joined_ts: 5 })).toBe(5);
        expect(parseCallJoinedTs({ call_joined_ts: "5" })).toBeNull();
        expect(parseCallJoinedTs({})).toBeNull();
    });

    it("describes elapsed time and hides stale fields", () => {
        const now = 1_000_000 * 1000;
        expect(describeCall(1_000_000 - 30, now)).toBe("In a call");
        expect(describeCall(1_000_000 - 12 * 60, now)).toBe(
            "In a call for 12 min",
        );
        expect(describeCall(1_000_000 - 65 * 60, now)).toBe(
            "In a call for 1 h 5 min",
        );
        expect(describeCall(1_000_000 - 3 * 3600, now)).toBe(
            "In a call for 3 h",
        );
        expect(describeCall(1_000_000 - 3 * 86400, now)).toBeNull();
        expect(describeCall(1_000_000 + 60, now)).toBe("In a call");
    });
});

describe("formatStatusMessage", () => {
    it("joins emoji and text, or is empty", () => {
        expect(formatStatusMessage({ text: "brb", emoji: "🏃" })).toBe(
            "🏃 brb",
        );
        expect(formatStatusMessage(null)).toBe("");
    });
});
