import { describe, it, expect } from "vitest";
import {
    DEFAULT_ROOM_SETTINGS_TAB,
    roomSettingsNavView,
    roomSettingsTabLabel,
    roomSettingsTabs,
} from "./roomSettingsNav";

describe("roomSettingsTabs", () => {
    it("offers a non-space room every tab except Rooms", () => {
        const ids = roomSettingsTabs({ isSpace: false }).map((t) => t.id);
        expect(ids).toEqual([
            "general",
            "access",
            "security",
            "permissions",
            "members",
            "emotes",
        ]);
    });

    it("hides Security on a space and offers Rooms instead", () => {
        const ids = roomSettingsTabs({ isSpace: true }).map((t) => t.id);
        expect(ids).toEqual([
            "general",
            "access",
            "permissions",
            "members",
            "emotes",
            "rooms",
        ]);
    });

    it("labels every tab it offers", () => {
        for (const isSpace of [false, true]) {
            for (const tab of roomSettingsTabs({ isSpace })) {
                expect(tab.label).toBeTruthy();
                expect(roomSettingsTabLabel(tab.id)).toBe(tab.label);
            }
        }
    });
});

describe("roomSettingsTabLabel", () => {
    it("falls back to the id so a new tab can never render an empty header", () => {
        expect(roomSettingsTabLabel("nope" as never)).toBe("nope");
    });
});

describe("roomSettingsNavView", () => {
    it("shows the sidebar layout on desktop with nothing selected", () => {
        expect(
            roomSettingsNavView({
                isMobile: false,
                isSpace: false,
                selectedTab: null,
            }),
        ).toEqual({ mode: "desktop", tab: DEFAULT_ROOM_SETTINGS_TAB });
    });

    it("shows the selected tab on desktop", () => {
        expect(
            roomSettingsNavView({
                isMobile: false,
                isSpace: false,
                selectedTab: "members",
            }),
        ).toEqual({ mode: "desktop", tab: "members" });
    });

    it("shows the category list on mobile with nothing selected", () => {
        expect(
            roomSettingsNavView({
                isMobile: true,
                isSpace: false,
                selectedTab: null,
            }),
        ).toEqual({ mode: "list" });
    });

    it("drills into the selected tab on mobile", () => {
        expect(
            roomSettingsNavView({
                isMobile: true,
                isSpace: false,
                selectedTab: "access",
            }),
        ).toEqual({ mode: "detail", tab: "access" });
    });

    it("ignores a selection this room cannot show (rooms on a non-space)", () => {
        expect(
            roomSettingsNavView({
                isMobile: true,
                isSpace: false,
                selectedTab: "rooms",
            }),
        ).toEqual({ mode: "list" });
        expect(
            roomSettingsNavView({
                isMobile: false,
                isSpace: false,
                selectedTab: "rooms",
            }),
        ).toEqual({ mode: "desktop", tab: DEFAULT_ROOM_SETTINGS_TAB });
    });

    it("ignores a selection this space cannot show (security on a space)", () => {
        expect(
            roomSettingsNavView({
                isMobile: true,
                isSpace: true,
                selectedTab: "security",
            }),
        ).toEqual({ mode: "list" });
        expect(
            roomSettingsNavView({
                isMobile: false,
                isSpace: true,
                selectedTab: "security",
            }),
        ).toEqual({ mode: "desktop", tab: DEFAULT_ROOM_SETTINGS_TAB });
    });

    it("keeps a selection that is valid for both kinds", () => {
        expect(
            roomSettingsNavView({
                isMobile: true,
                isSpace: true,
                selectedTab: "emotes",
            }),
        ).toEqual({ mode: "detail", tab: "emotes" });
    });
});
