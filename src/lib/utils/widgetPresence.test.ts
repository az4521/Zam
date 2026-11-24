import { describe, it, expect } from "vitest";
import { widgetPresenceEntry, widgetPresenceKey } from "./widgetPresence";

describe("widgetPresenceKey", () => {
    it("is stable and eight hex digits", () => {
        const a = widgetPresenceKey("!room:srv", "w1");
        expect(a).toMatch(/^[0-9a-f]{8}$/);
        expect(widgetPresenceKey("!room:srv", "w1")).toBe(a);
    });

    it("differs by room and by widget", () => {
        const a = widgetPresenceKey("!room:srv", "w1");
        expect(widgetPresenceKey("!other:srv", "w1")).not.toBe(a);
        expect(widgetPresenceKey("!room:srv", "w2")).not.toBe(a);
    });

    it("never contains the room id", () => {
        expect(widgetPresenceKey("!secret:srv", "w1")).not.toContain("secret");
    });
});

describe("widgetPresenceEntry", () => {
    const key = "0a1b2c3d";

    it("builds an activity named after the widget", () => {
        expect(
            widgetPresenceEntry(
                { name: "  Chess  ", avatarUrl: null },
                key,
                5,
                9,
            ),
        ).toEqual({
            kind: "activity",
            id: `widget-${key}`,
            name: "Chess",
            since: 5,
            expiry: 9,
            buttons: [],
        });
    });

    it("returns null for an empty name", () => {
        expect(
            widgetPresenceEntry({ name: "   ", avatarUrl: null }, key, 1, 2),
        ).toBeNull();
    });

    it("truncates a long name", () => {
        const e = widgetPresenceEntry(
            { name: "x".repeat(300), avatarUrl: null },
            key,
            1,
            2,
        );
        expect(e?.name).toHaveLength(128);
    });

    it("uses the avatar only when it is an mxc URL", () => {
        const mxc = widgetPresenceEntry(
            { name: "W", avatarUrl: "mxc://srv/abc" },
            key,
            1,
            2,
        );
        expect(mxc?.largeIconUrl).toBe("mxc://srv/abc");
        const http = widgetPresenceEntry(
            { name: "W", avatarUrl: "https://evil.example/x.png" },
            key,
            1,
            2,
        );
        expect(http).not.toHaveProperty("largeIconUrl");
    });

    it("does not carry the widget url or room id", () => {
        const e = widgetPresenceEntry(
            { name: "W", avatarUrl: null },
            key,
            1,
            2,
        );
        expect(JSON.stringify(e)).not.toMatch(/https?:|!|:srv/);
    });
});
