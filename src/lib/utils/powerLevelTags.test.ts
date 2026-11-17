import { describe, it, expect } from "vitest";
import {
    defaultPowerLevelTags,
    isMxcIcon,
    parsePowerLevelTags,
    safeTagColor,
    serializePowerLevelTags,
    sortedTagLevels,
    tagForPowerLevel,
    POWER_LEVEL_TAGS_EVENT_TYPE,
    UNSTABLE_POWER_LEVEL_TAGS_EVENT_TYPE,
} from "./powerLevelTags";

describe("event types", () => {
    it("exposes the stable and unstable type names", () => {
        expect(POWER_LEVEL_TAGS_EVENT_TYPE).toBe("m.room.power_level_tags");
        expect(UNSTABLE_POWER_LEVEL_TAGS_EVENT_TYPE).toBe(
            "in.cinny.room.power_level_tags",
        );
    });
});

describe("parsePowerLevelTags", () => {
    it("returns an empty map for non-object content", () => {
        expect(parsePowerLevelTags(null)).toEqual({});
        expect(parsePowerLevelTags(undefined)).toEqual({});
        expect(parsePowerLevelTags("nope")).toEqual({});
        expect(parsePowerLevelTags([{ name: "x" }])).toEqual({});
    });

    it("keeps a minimal tag", () => {
        expect(parsePowerLevelTags({ "50": { name: "Mod" } })).toEqual({
            50: { name: "Mod" },
        });
    });

    it("drops keys that are not integer strings", () => {
        const parsed = parsePowerLevelTags({
            "50": { name: "Mod" },
            "5.5": { name: "float" },
            "1e3": { name: "exp" },
            " 7": { name: "space" },
            "07": { name: "leading zero" },
            "-0": { name: "negative zero" },
            abc: { name: "word" },
        });
        expect(Object.keys(parsed)).toEqual(["50"]);
    });

    it("allows negative integer levels", () => {
        const parsed = parsePowerLevelTags({ "-1": { name: "Muted" } });
        expect(parsed[-1]).toEqual({ name: "Muted" });
    });

    it("drops entries without a non-empty string name", () => {
        const parsed = parsePowerLevelTags({
            "1": { name: "   " },
            "2": { name: 42 },
            "3": { color: "#ffffff" },
            "4": "just a string",
            "5": null,
            "6": ["array"],
            "7": { name: "ok" },
        });
        expect(parsed).toEqual({ 7: { name: "ok" } });
    });

    it("trims names and caps them at 64 code points", () => {
        const long = "a".repeat(70);
        expect(
            parsePowerLevelTags({ "1": { name: `  ${long}  ` } })[1].name,
        ).toHaveLength(64);
        expect(parsePowerLevelTags({ "1": { name: "  Boss  " } })[1].name).toBe(
            "Boss",
        );
    });

    it("does not split a surrogate pair when capping", () => {
        const name = "😀".repeat(65);
        const capped = parsePowerLevelTags({ "1": { name } })[1].name;
        expect(Array.from(capped)).toHaveLength(64);
        expect(capped).toBe("😀".repeat(64));
    });

    it("keeps a 6-digit colour lowercased", () => {
        expect(
            parsePowerLevelTags({ "1": { name: "a", color: "#AABBCC" } })[1]
                .color,
        ).toBe("#aabbcc");
    });

    it("expands a 3-digit colour to 6 digits", () => {
        expect(
            parsePowerLevelTags({ "1": { name: "a", color: "#F0a" } })[1].color,
        ).toBe("#ff00aa");
    });

    it("drops invalid colours but keeps the tag", () => {
        const invalid = [
            "red",
            "#ff00",
            "#ff00aaa",
            "ff00aa",
            "#gg0000",
            "url(javascript:alert(1))",
            "#ff00aa; background: red",
            " #ff00aa",
            42,
            null,
        ];
        for (const color of invalid) {
            const tag = parsePowerLevelTags({ "1": { name: "a", color } })[1];
            expect(tag).toEqual({ name: "a" });
        }
    });

    it("keeps an emoji icon", () => {
        const parsed = parsePowerLevelTags({
            "1": { name: "a", icon: { key: "🛡️" } },
        });
        expect(parsed[1].icon).toEqual({ key: "🛡️" });
    });

    it("keeps an mxc icon with image info", () => {
        const info = { w: 32, h: 32, mimetype: "image/png", size: 1024 };
        const parsed = parsePowerLevelTags({
            "1": {
                name: "a",
                icon: { key: "mxc://example.org/abc", info },
            },
        });
        expect(parsed[1].icon).toEqual({
            key: "mxc://example.org/abc",
            info,
        });
    });

    it("drops icons with an empty or non-string key", () => {
        for (const icon of [
            { key: "" },
            { key: "   " },
            { key: 5 },
            { info: { w: 1 } },
            "🛡️",
            null,
        ]) {
            const parsed = parsePowerLevelTags({ "1": { name: "a", icon } });
            expect(parsed[1]).toEqual({ name: "a" });
        }
    });

    it("caps icon keys at 256 code points", () => {
        const key = "x".repeat(300);
        const parsed = parsePowerLevelTags({
            "1": { name: "a", icon: { key } },
        });
        expect(parsed[1].icon?.key).toHaveLength(256);
    });

    it("keeps icon info only when it is a plain object", () => {
        const withArray = parsePowerLevelTags({
            "1": { name: "a", icon: { key: "x", info: [1, 2] } },
        });
        expect(withArray[1].icon).toEqual({ key: "x" });

        const withString = parsePowerLevelTags({
            "1": { name: "a", icon: { key: "x", info: "nope" } },
        });
        expect(withString[1].icon).toEqual({ key: "x" });

        const withNull = parsePowerLevelTags({
            "1": { name: "a", icon: { key: "x", info: null } },
        });
        expect(withNull[1].icon).toEqual({ key: "x" });
    });

    it("ignores prototype keys", () => {
        const content = JSON.parse(
            '{"__proto__": {"name": "evil"}, "1": {"name": "ok"}}',
        );
        const parsed = parsePowerLevelTags(content);
        expect(Object.keys(parsed)).toEqual(["1"]);
        expect(({} as Record<string, unknown>).name).toBeUndefined();
    });
});

describe("safeTagColor", () => {
    it("normalises valid colours", () => {
        expect(safeTagColor("#1A2b3C")).toBe("#1a2b3c");
        expect(safeTagColor("#abc")).toBe("#aabbcc");
    });

    it("returns undefined for anything else", () => {
        expect(safeTagColor("#abcd")).toBeUndefined();
        expect(safeTagColor("expression(alert(1))")).toBeUndefined();
        expect(safeTagColor(undefined)).toBeUndefined();
        expect(safeTagColor(0xffffff)).toBeUndefined();
    });
});

describe("tagForPowerLevel", () => {
    const tags = parsePowerLevelTags({
        "0": { name: "Member" },
        "50": { name: "Mod" },
        "100": { name: "Admin" },
    });

    it("returns an exact match", () => {
        expect(tagForPowerLevel(tags, 50)).toEqual({
            level: 50,
            tag: { name: "Mod" },
        });
    });

    it("uses the nearest lower defined level", () => {
        expect(tagForPowerLevel(tags, 75)?.level).toBe(50);
        expect(tagForPowerLevel(tags, 49)?.level).toBe(0);
        expect(tagForPowerLevel(tags, 250)?.level).toBe(100);
    });

    it("returns null when no defined level is at or below", () => {
        const sparse = parsePowerLevelTags({ "10": { name: "Ten" } });
        expect(tagForPowerLevel(sparse, 9)).toBeNull();
        expect(tagForPowerLevel({}, 0)).toBeNull();
    });

    it("handles negative levels", () => {
        const withNeg = parsePowerLevelTags({
            "-10": { name: "Banned" },
            "-1": { name: "Muted" },
            "0": { name: "Member" },
        });
        expect(tagForPowerLevel(withNeg, -1)?.tag.name).toBe("Muted");
        expect(tagForPowerLevel(withNeg, -5)?.level).toBe(-10);
        expect(tagForPowerLevel(withNeg, -10)?.level).toBe(-10);
        expect(tagForPowerLevel(withNeg, -11)).toBeNull();
        expect(tagForPowerLevel(withNeg, -1)?.level).toBe(-1);
    });

    it("returns null for non-integer levels", () => {
        expect(tagForPowerLevel(tags, 1.5)).toBeNull();
        expect(tagForPowerLevel(tags, Number.NaN)).toBeNull();
    });
});

describe("sortedTagLevels", () => {
    it("lists defined levels highest first, including negatives", () => {
        const tags = parsePowerLevelTags({
            "0": { name: "a" },
            "-1": { name: "b" },
            "100": { name: "c" },
            "50": { name: "d" },
        });
        expect(sortedTagLevels(tags)).toEqual([100, 50, 0, -1]);
    });
});

describe("defaultPowerLevelTags", () => {
    it("maps 0 / 50 / 100 to member / moderator / admin", () => {
        const tags = defaultPowerLevelTags({
            admin: "Admin",
            moderator: "Moderator",
            member: "Member",
        });
        expect(tags).toEqual({
            0: { name: "Member" },
            50: { name: "Moderator" },
            100: { name: "Admin" },
        });
        expect(tagForPowerLevel(tags, 99)?.tag.name).toBe("Moderator");
        expect(tagForPowerLevel(tags, 0)?.tag.name).toBe("Member");
    });
});

describe("serializePowerLevelTags", () => {
    it("uses string keys and omits undefined fields", () => {
        const out = serializePowerLevelTags({
            50: { name: "Mod" },
            100: {
                name: "Admin",
                color: "#ff0000",
                icon: { key: "🛡️" },
            },
        });
        expect(out).toEqual({
            "100": { name: "Admin", color: "#ff0000", icon: { key: "🛡️" } },
            "50": { name: "Mod" },
        });
        expect(out["50"]).not.toHaveProperty("color");
        expect(out["50"]).not.toHaveProperty("icon");
        expect(out["100"].icon).not.toHaveProperty("info");
        expect(JSON.parse(JSON.stringify(out))).toEqual(out);
    });

    it("round-trips through parse", () => {
        const original = parsePowerLevelTags({
            "-1": { name: "Muted", color: "#123456" },
            "0": { name: "Member" },
            "50": {
                name: "Mod",
                icon: {
                    key: "mxc://example.org/icon",
                    info: { w: 16, h: 16, mimetype: "image/png", size: 99 },
                },
            },
            "100": { name: "Admin", color: "#abc", icon: { key: "👑" } },
        });
        const serialized = JSON.parse(
            JSON.stringify(serializePowerLevelTags(original)),
        );
        expect(parsePowerLevelTags(serialized)).toEqual(original);
    });
});

describe("isMxcIcon", () => {
    it("is true only for mxc:// keys", () => {
        expect(isMxcIcon({ key: "mxc://example.org/x" })).toBe(true);
        expect(isMxcIcon({ key: "🛡️" })).toBe(false);
        expect(isMxcIcon({ key: "https://example.org/x.png" })).toBe(false);
        expect(isMxcIcon(undefined)).toBe(false);
        expect(isMxcIcon(null)).toBe(false);
    });
});
