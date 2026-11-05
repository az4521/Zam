import { describe, it, expect } from "vitest";
import {
    SETTINGS_TABS,
    SETTINGS_GROUPS,
    DEFAULT_SETTINGS_TAB,
    settingsTabLabel,
    settingsNavView,
    isSettingsTabAvailable,
    visibleSettingsGroups,
    type SettingsTab,
} from "./settingsNav";

describe("SETTINGS_TABS", () => {
    it("lists the fifteen settings categories in display order", () => {
        expect(SETTINGS_TABS.map((t) => t.id)).toEqual([
            "account",
            "security",
            "privacy",
            "rich-presence",
            "general",
            "appearance",
            "messages-media",
            "notifications",
            "voice",
            "keybinds",
            "emotes",
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

describe("platform-gated tabs", () => {
    const web = { desktopTray: false, nativeApp: false, richPresence: false };
    const desktop = { desktopTray: true, nativeApp: false, richPresence: true };

    it("hides General and Rich presence off the desktop app", () => {
        expect(isSettingsTabAvailable("general", web)).toBe(false);
        expect(isSettingsTabAvailable("rich-presence", web)).toBe(false);
        const ids = visibleSettingsGroups(web).flatMap((g) =>
            g.tabs.map((t) => t.id),
        );
        expect(ids).not.toContain("general");
        expect(ids).not.toContain("rich-presence");
        expect(ids).toContain("plugins");
    });
    it("shows General and Rich presence in packaged desktop", () => {
        expect(isSettingsTabAvailable("general", desktop)).toBe(true);
        expect(isSettingsTabAvailable("rich-presence", desktop)).toBe(true);
        expect(visibleSettingsGroups(desktop)).toEqual(SETTINGS_GROUPS);
    });
    it("puts General first under App and Rich presence last under Account", () => {
        const [account, app] = SETTINGS_GROUPS;
        expect(account.tabs.at(-1)?.id).toBe("rich-presence");
        expect(app.tabs[0].id).toBe("general");
    });
    it("keeps every other tab regardless of platform", () => {
        for (const t of SETTINGS_TABS) {
            if (t.id === "general" || t.id === "rich-presence") continue;
            expect(isSettingsTabAvailable(t.id, web)).toBe(true);
        }
    });
});
