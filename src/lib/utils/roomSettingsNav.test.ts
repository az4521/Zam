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
            "notifications",
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
            "notifications",
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

describe("plugin tabs", () => {
    const plug = { id: "plugin:3" as const, label: "Plug" };

    it("come after Zam's own tabs, in the given order", () => {
        const other = { id: "plugin:4" as const, label: "Other" };
        const core = roomSettingsTabs({ isSpace: false }).map((t) => t.id);
        const ids = roomSettingsTabs({
            isSpace: false,
            pluginTabs: [plug, other],
        }).map((t) => t.id);
        expect(ids).toEqual([...core, "plugin:3", "plugin:4"]);
    });

    it("come after Rooms on a space", () => {
        const ids = roomSettingsTabs({
            isSpace: true,
            pluginTabs: [plug],
        }).map((t) => t.id);
        expect(ids.at(-1)).toBe("plugin:3");
        expect(ids.at(-2)).toBe("rooms");
    });

    it("keep a selected plugin tab on desktop when the room offers it", () => {
        expect(
            roomSettingsNavView({
                isMobile: false,
                isSpace: false,
                selectedTab: "plugin:3",
                pluginTabs: [plug],
            }),
        ).toEqual({ mode: "desktop", tab: "plugin:3" });
    });

    it("drop a selected plugin tab that the room does not offer", () => {
        expect(
            roomSettingsNavView({
                isMobile: false,
                isSpace: false,
                selectedTab: "plugin:3",
                pluginTabs: [],
            }),
        ).toEqual({ mode: "desktop", tab: DEFAULT_ROOM_SETTINGS_TAB });
        expect(
            roomSettingsNavView({
                isMobile: true,
                isSpace: false,
                selectedTab: "plugin:3",
            }),
        ).toEqual({ mode: "list" });
    });

    it("open a plugin tab's detail page on mobile", () => {
        expect(
            roomSettingsNavView({
                isMobile: true,
                isSpace: false,
                selectedTab: "plugin:3",
                pluginTabs: [plug],
            }),
        ).toEqual({ mode: "detail", tab: "plugin:3" });
    });

    it("resolve a plugin tab's label from the plugin tabs", () => {
        expect(roomSettingsTabLabel("plugin:3", [plug])).toBe("Plug");
    });

    it("fall back to the id when no plugin tab carries it", () => {
        expect(roomSettingsTabLabel("plugin:3", [])).toBe("plugin:3");
    });
});
