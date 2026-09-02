import { describe, it, expect } from "vitest";
import {
    SETTINGS_TABS,
    SETTINGS_GROUPS,
    DEFAULT_SETTINGS_TAB,
    settingsTabLabel,
    settingsNavView,
    type SettingsTab,
} from "./settingsNav";

describe("SETTINGS_TABS", () => {
    it("lists the thirteen settings categories in display order", () => {
        expect(SETTINGS_TABS.map((t) => t.id)).toEqual([
            "account",
            "security",
            "privacy",
            "appearance",
            "messages-media",
            "notifications",
            "voice",
            "emotes",
            "general",
            "plugins",
            "server",
            "about",
            "debug",
        ]);
    });

    it("gives every tab a non-empty label", () => {
        for (const tab of SETTINGS_TABS) {
            expect(tab.label.length).toBeGreaterThan(0);
        }
    });

    it("has no duplicate ids", () => {
        const ids = SETTINGS_TABS.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("defaults to the account tab", () => {
        expect(DEFAULT_SETTINGS_TAB).toBe("account");
        expect(SETTINGS_TABS.some((t) => t.id === DEFAULT_SETTINGS_TAB)).toBe(
            true,
        );
    });
});

describe("SETTINGS_GROUPS", () => {
    it("has the correct group titles", () => {
        expect(SETTINGS_GROUPS.map((g) => g.title)).toEqual([
            "Account",
            "App",
            "Advanced",
        ]);
    });

    it("flattens to SETTINGS_TABS", () => {
        expect(SETTINGS_GROUPS.flatMap((g) => g.tabs)).toEqual(SETTINGS_TABS);
    });

    it("has no duplicate ids across all groups", () => {
        const ids = SETTINGS_GROUPS.flatMap((g) => g.tabs).map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe("settingsTabLabel", () => {
    it("returns the table's label", () => {
        expect(settingsTabLabel("voice")).toBe("Voice & Video");
        expect(settingsTabLabel("emotes")).toBe("Emotes");
    });

    it("falls back to the raw id for an unknown tab", () => {
        expect(settingsTabLabel("nope" as SettingsTab)).toBe("nope");
    });
});

describe("settingsNavView", () => {
    it("shows the desktop split view with the default tab when nothing is selected", () => {
        expect(settingsNavView({ isMobile: false, selectedTab: null })).toEqual(
            {
                mode: "desktop",
                tab: "account",
            },
        );
    });

    it("shows the desktop split view with the selected tab", () => {
        expect(
            settingsNavView({ isMobile: false, selectedTab: "security" }),
        ).toEqual({ mode: "desktop", tab: "security" });
    });

    it("shows the mobile category list when nothing is selected", () => {
        expect(settingsNavView({ isMobile: true, selectedTab: null })).toEqual({
            mode: "list",
        });
    });

    it("shows the mobile detail sub-page when a tab is selected", () => {
        expect(
            settingsNavView({ isMobile: true, selectedTab: "debug" }),
        ).toEqual({ mode: "detail", tab: "debug" });
    });

    it("keeps the drilled-into tab when the viewport grows to desktop", () => {
        expect(
            settingsNavView({ isMobile: false, selectedTab: "privacy" }),
        ).toEqual({ mode: "desktop", tab: "privacy" });
    });
});
