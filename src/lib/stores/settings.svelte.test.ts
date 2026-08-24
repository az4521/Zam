import { describe, it, expect, afterEach, vi } from "vitest";
import {
    settingsState,
    setShowReadReceiptAvatars,
    setReduceMotion,
    setLinkPreviewMedia,
    setLinkPreviewsEnabled,
    saveThemePreset,
    deleteThemePreset,
    setActivePreset,
    activePresetColors,
    customizationSnapshot,
    saveCustomPreset,
    deleteCustomPreset,
    forkActivePreset,
    setTheme,
    renameCustomPreset,
} from "./settings.svelte";
import { auth } from "$lib/stores/auth.svelte";
import * as themeModule from "$lib/utils/theme";

const KEY = "settings:showReadReceiptAvatars";

/**
 * A signed-in user id, for the "is not account-scoped" tests only.
 *
 * Those tests are worthless without one: `auth.userId` is null in this
 * environment (nothing signs in, and vitest.config.ts has no setupFiles), and
 * scopedKey(base, null) returns the BARE key — so an account-scoped writer
 * would write to exactly the key they assert on and the regression would sail
 * through. A real user id is what makes the scoped key observable.
 */
const SCOPED_USER = "@alice:example.org";

// The module-level store persists across tests — restore the default after
// each. auth.userId is reset here (not in a nested hook) so no test can leak a
// signed-in user id into the next one, whichever describe set it.
afterEach(() => {
    setShowReadReceiptAvatars(true);
    localStorage.removeItem(KEY);
    auth.userId = null;
});

/**
 * Re-import the store with localStorage pre-seeded, so we observe the value it
 * reads at boot rather than one a setter left behind. Asserting on the
 * already-imported instance would pass even if the field were a hardcoded
 * literal — i.e. even if the setting silently didn't survive a reload.
 */
async function bootWith(stored: string | null) {
    if (stored === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, stored);
    vi.resetModules();
    return await import("./settings.svelte");
}

describe("showReadReceiptAvatars", () => {
    it("defaults to true so existing users keep the avatars", async () => {
        const fresh = await bootWith(null);
        expect(fresh.settingsState.showReadReceiptAvatars).toBe(true);
    });

    it("reads a stored 'false' back at boot, so the toggle survives a reload", async () => {
        const fresh = await bootWith("false");
        expect(fresh.settingsState.showReadReceiptAvatars).toBe(false);
    });

    it("writes the value to localStorage under the device-global key", () => {
        setShowReadReceiptAvatars(false);
        expect(localStorage.getItem(KEY)).toBe("false");
        setShowReadReceiptAvatars(true);
        expect(localStorage.getItem(KEY)).toBe("true");
    });

    it("updates the store state", () => {
        setShowReadReceiptAvatars(false);
        expect(settingsState.showReadReceiptAvatars).toBe(false);
        setShowReadReceiptAvatars(true);
        expect(settingsState.showReadReceiptAvatars).toBe(true);
    });

    it("is not account-scoped: the key carries no user id suffix", () => {
        auth.userId = SCOPED_USER;
        setShowReadReceiptAvatars(false);
        const keys = Object.keys(localStorage).filter((k) =>
            k.includes("showReadReceiptAvatars"),
        );
        expect(keys).toEqual([KEY]);
    });

    it("does not disturb the read-receipt privacy setting", () => {
        const before = settingsState.privateReadReceipts;
        setShowReadReceiptAvatars(false);
        expect(settingsState.privateReadReceipts).toBe(before);
    });
});

describe("reduceMotion", () => {
    const RM_KEY = "settings:reduceMotion";

    afterEach(() => {
        setReduceMotion(false);
        localStorage.removeItem(RM_KEY);
        delete document.documentElement.dataset.reduceMotion;
    });

    async function bootReduceMotionWith(stored: string | null) {
        if (stored === null) localStorage.removeItem(RM_KEY);
        else localStorage.setItem(RM_KEY, stored);
        vi.resetModules();
        return await import("./settings.svelte");
    }

    it("defaults to false so motion stays on for existing users", async () => {
        const fresh = await bootReduceMotionWith(null);
        expect(fresh.settingsState.reduceMotion).toBe(false);
    });

    it("reads a stored 'true' back at boot, so the toggle survives a reload", async () => {
        const fresh = await bootReduceMotionWith("true");
        expect(fresh.settingsState.reduceMotion).toBe(true);
    });

    it("writes the value to localStorage under the device-global key", () => {
        setReduceMotion(true);
        expect(localStorage.getItem(RM_KEY)).toBe("true");
        setReduceMotion(false);
        expect(localStorage.getItem(RM_KEY)).toBe("false");
    });

    it("updates the store state", () => {
        setReduceMotion(true);
        expect(settingsState.reduceMotion).toBe(true);
        setReduceMotion(false);
        expect(settingsState.reduceMotion).toBe(false);
    });

    it("is not account-scoped: the key carries no user id suffix", () => {
        auth.userId = SCOPED_USER;
        setReduceMotion(true);
        const keys = Object.keys(localStorage).filter((k) =>
            k.includes("reduceMotion"),
        );
        expect(keys).toEqual([RM_KEY]);
    });

    it("reflects the preference onto the root element as data-reduce-motion", () => {
        setReduceMotion(true);
        expect(document.documentElement.dataset.reduceMotion).toBe("true");
        setReduceMotion(false);
        expect(document.documentElement.dataset.reduceMotion).toBeUndefined();
    });
});

describe("linkPreviewMedia", () => {
    const LP_KEY = "settings:linkPreviewMedia";

    afterEach(() => {
        setLinkPreviewMedia("all");
        localStorage.removeItem(LP_KEY);
    });

    async function bootLinkPreviewWith(stored: string | null) {
        if (stored === null) localStorage.removeItem(LP_KEY);
        else localStorage.setItem(LP_KEY, stored);
        vi.resetModules();
        return await import("./settings.svelte");
    }

    it("defaults to 'proxied' so third-party hosts never learn the reader's IP by default", async () => {
        const fresh = await bootLinkPreviewWith(null);
        expect(fresh.settingsState.linkPreviewMedia).toBe("proxied");
    });

    it("reads a stored value back at boot, so the choice survives a reload", async () => {
        const fresh = await bootLinkPreviewWith("proxied");
        expect(fresh.settingsState.linkPreviewMedia).toBe("proxied");
    });

    it("falls back to the default when localStorage holds junk", async () => {
        const fresh = await bootLinkPreviewWith("garbage");
        expect(fresh.settingsState.linkPreviewMedia).toBe("proxied");
    });

    it("writes the value under the device-global key", () => {
        setLinkPreviewMedia("none");
        expect(localStorage.getItem(LP_KEY)).toBe("none");
        expect(settingsState.linkPreviewMedia).toBe("none");
    });

    it("is not account-scoped: the key carries no user id suffix", () => {
        auth.userId = SCOPED_USER;
        setLinkPreviewMedia("proxied");
        const keys = Object.keys(localStorage).filter((k) =>
            k.includes("linkPreviewMedia"),
        );
        expect(keys).toEqual([LP_KEY]);
    });

    it("normalizes a bad value passed to the setter", () => {
        setLinkPreviewMedia("nonsense" as never);
        expect(settingsState.linkPreviewMedia).toBe("proxied");
        expect(localStorage.getItem(LP_KEY)).toBe("proxied");
    });
});

describe("linkPreviewsEnabled", () => {
    const LPE_KEY = "settings:linkPreviewsEnabled";

    afterEach(() => {
        setLinkPreviewsEnabled(true);
        localStorage.removeItem(LPE_KEY);
    });

    async function bootLinkPreviewsEnabledWith(stored: string | null) {
        if (stored === null) localStorage.removeItem(LPE_KEY);
        else localStorage.setItem(LPE_KEY, stored);
        vi.resetModules();
        return await import("./settings.svelte");
    }

    it("defaults to true so link previews load by default", async () => {
        const fresh = await bootLinkPreviewsEnabledWith(null);
        expect(fresh.settingsState.linkPreviewsEnabled).toBe(true);
    });

    it("reads a stored 'false' back at boot, so the toggle survives a reload", async () => {
        const fresh = await bootLinkPreviewsEnabledWith("false");
        expect(fresh.settingsState.linkPreviewsEnabled).toBe(false);
    });

    it("writes the value to localStorage under the device-global key", () => {
        setLinkPreviewsEnabled(false);
        expect(localStorage.getItem(LPE_KEY)).toBe("false");
        setLinkPreviewsEnabled(true);
        expect(localStorage.getItem(LPE_KEY)).toBe("true");
    });

    it("updates the store state", () => {
        setLinkPreviewsEnabled(false);
        expect(settingsState.linkPreviewsEnabled).toBe(false);
        setLinkPreviewsEnabled(true);
        expect(settingsState.linkPreviewsEnabled).toBe(true);
    });

    it("is not account-scoped: the key carries no user id suffix", () => {
        auth.userId = SCOPED_USER;
        setLinkPreviewsEnabled(false);
        const keys = Object.keys(localStorage).filter((k) =>
            k.includes("linkPreviewsEnabled"),
        );
        expect(keys).toEqual([LPE_KEY]);
    });
});

const ENCRYPT_DMS_KEY = "settings:encryptNewDms";
// Distinct from the SCOPED_USER above (R7's link-preview suite): both suites
// landed in this file from different branches and each asserts on its own
// account-scoped key, so they must not share an id.
const ENCRYPT_SCOPED_USER = "@precedence:example.org";
const SCOPED_ENCRYPT_DMS_KEY = `${ENCRYPT_DMS_KEY}:${ENCRYPT_SCOPED_USER}`;

/**
 * Same trick as bootWith above, for the account-scoped encryption setting. In a
 * unit test auth.userId is null, so scopedKey() collapses to the bare key.
 */
async function bootWithEncryptDms(stored: string | null) {
    if (stored === null) localStorage.removeItem(ENCRYPT_DMS_KEY);
    else localStorage.setItem(ENCRYPT_DMS_KEY, stored);
    vi.resetModules();
    return await import("./settings.svelte");
}

describe("encryptNewDms", () => {
    // clear(), not removeItem(): the scoped test below calls
    // reloadAccountSettings() with a non-null auth.userId, and readScoped()
    // ADOPTS any bare `settings:*` key it finds into that account's scope and
    // deletes the original. Nothing collides today, but leaving those adopted
    // keys behind would make this file order-dependent.
    afterEach(() => {
        localStorage.clear();
    });

    it("defaults to on for an account that never touched the toggle", async () => {
        const fresh = await bootWithEncryptDms(null);
        expect(fresh.settingsState.encryptNewDms).toBe(true);
    });

    // The whole point of the default flip: it must not override a choice.
    it("keeps an explicit off, so the new default cannot overrule the user", async () => {
        const fresh = await bootWithEncryptDms("false");
        expect(fresh.settingsState.encryptNewDms).toBe(false);
    });

    it("keeps an explicit on", async () => {
        const fresh = await bootWithEncryptDms("true");
        expect(fresh.settingsState.encryptNewDms).toBe(true);
    });

    // A value that is neither "true" nor "false" is a corrupt/foreign write,
    // not an absent key — readAccountBool treats it as off rather than silently
    // turning encryption on for a value nobody wrote.
    it("treats an unrecognised stored value as off, not as absent", async () => {
        const fresh = await bootWithEncryptDms("yes");
        expect(fresh.settingsState.encryptNewDms).toBe(false);
    });

    it("persists an explicit off through the setter", async () => {
        const fresh = await bootWithEncryptDms(null);
        fresh.setEncryptNewDms(false);
        expect(localStorage.getItem(ENCRYPT_DMS_KEY)).toBe("false");
        expect(fresh.settingsState.encryptNewDms).toBe(false);
    });

    // The path a real session takes. settingsState is built at module init, when
    // auth.userId is still null — so the boot read hits the BARE key and a
    // per-account choice is invisible until reloadAccountSettings() runs (from
    // AppShell on mount, and again on every account switch). That reload is
    // where an explicit off has to win for a logged-in account; assert it there
    // rather than at boot, so this stays a precedence test and not a second
    // assertion about the default.
    it("keeps an explicit off under the account-scoped key after a reload", async () => {
        localStorage.removeItem(ENCRYPT_DMS_KEY);
        localStorage.setItem(SCOPED_ENCRYPT_DMS_KEY, "false");
        vi.resetModules();
        const fresh = await import("./settings.svelte");
        const { auth } = await import("./auth.svelte");
        auth.userId = ENCRYPT_SCOPED_USER;
        try {
            fresh.reloadAccountSettings();
            expect(fresh.settingsState.encryptNewDms).toBe(false);
        } finally {
            auth.userId = null;
        }
    });
});

describe("themePresets (legacy, pre-unified)", () => {
    afterEach(() => {
        settingsState.themePresets = {};
        settingsState.activePreset = "";
        localStorage.clear();
    });

    it("saveThemePreset stores the preset and makes it available", () => {
        saveThemePreset("A", { accent: "#010203" });
        // Now wraps as {base, colors}
        expect(settingsState.themePresets.A).toEqual({
            base: "dark",
            colors: { accent: "#010203" },
        });
    });

    it("setActivePreset sets the active preset name", () => {
        saveThemePreset("A", { accent: "#010203" });
        setActivePreset("A");
        expect(settingsState.activePreset).toBe("A");
    });

    it("activePresetColors returns the colors for the active preset", () => {
        saveThemePreset("A", { accent: "#010203" });
        setActivePreset("A");
        expect(activePresetColors()).toEqual({ accent: "#010203" });
    });

    it("activePresetColors returns null when no preset is active", () => {
        expect(activePresetColors()).toBe(null);
    });

    it("activePresetColors returns null when active preset does not exist", () => {
        setActivePreset("nonexistent");
        expect(activePresetColors()).toBe(null);
    });

    it("customizationSnapshot includes themePresets and activePreset", () => {
        saveThemePreset("A", { accent: "#010203" });
        setActivePreset("A");
        const snap = customizationSnapshot();
        // Now in {base, colors} format
        expect(snap.themePresets).toEqual({
            A: { base: "dark", colors: { accent: "#010203" } },
        });
        expect(snap.activePreset).toBe("A");
    });

    it("deleteThemePreset removes the preset", () => {
        saveThemePreset("A", { accent: "#010203" });
        deleteThemePreset("A");
        expect(settingsState.themePresets.A).toBeUndefined();
    });

    it("deleteThemePreset clears active when deleting the active preset", () => {
        saveThemePreset("A", { accent: "#010203" });
        setActivePreset("A");
        deleteThemePreset("A");
        expect(settingsState.activePreset).toBe("");
        expect(activePresetColors()).toBe(null);
    });

    it("deleteThemePreset does not clear active when deleting a different preset", () => {
        saveThemePreset("A", { accent: "#010203" });
        saveThemePreset("B", { accent: "#040506" });
        setActivePreset("A");
        deleteThemePreset("B");
        expect(settingsState.activePreset).toBe("A");
    });
});

describe("unified theming (base + overlay)", () => {
    afterEach(() => {
        settingsState.themePresets = {};
        settingsState.activePreset = "";
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("setActivePreset with a built-in applies its base and writes themeBase", () => {
        const applyPresetSpy = vi.spyOn(themeModule, "applyPreset");
        setActivePreset("Default AMOLED");
        expect(settingsState.activePreset).toBe("Default AMOLED");
        expect(localStorage.getItem("settings:themeBase")).toBe("amoled");
        expect(applyPresetSpy).toHaveBeenCalledWith("amoled", null);
    });

    it("setActivePreset with a custom preset applies its base and colors", () => {
        const applyPresetSpy = vi.spyOn(themeModule, "applyPreset");
        saveCustomPreset("MyTheme", "light", { accent: "#123456" });
        setActivePreset("MyTheme");
        expect(settingsState.activePreset).toBe("MyTheme");
        expect(localStorage.getItem("settings:themeBase")).toBe("light");
        expect(applyPresetSpy).toHaveBeenCalledWith("light", {
            accent: "#123456",
        });
    });

    it("saveCustomPreset stores a preset with base and colors", () => {
        saveCustomPreset("Custom", "dark", {
            background: "#111111",
            accent: "#ff0000",
        });
        expect(settingsState.themePresets.Custom).toEqual({
            base: "dark",
            colors: { background: "#111111", accent: "#ff0000" },
        });
    });

    it("saveCustomPreset sanitizes colors", () => {
        saveCustomPreset("Custom", "light", {
            accent: "#abc",
            bogus: "nope",
        } as any);
        expect(settingsState.themePresets.Custom).toEqual({
            base: "light",
            colors: { accent: "#aabbcc" },
        });
    });

    it("saveCustomPreset refuses to shadow a built-in name", () => {
        expect(() => saveCustomPreset("Default Dark", "light", {})).toThrow();
    });

    it("deleteCustomPreset removes a custom preset", () => {
        saveCustomPreset("Custom", "dark", { accent: "#123456" });
        deleteCustomPreset("Custom");
        expect(settingsState.themePresets.Custom).toBeUndefined();
    });

    it("deleteCustomPreset refuses to delete a built-in", () => {
        deleteCustomPreset("Default Dark");
        // Should be a no-op - just verify it doesn't throw or corrupt state
        expect(settingsState.activePreset).toBe("");
    });

    it("deleteCustomPreset resets to Default Dark when deleting the active preset", () => {
        saveCustomPreset("Custom", "light", { accent: "#abcdef" });
        setActivePreset("Custom");
        deleteCustomPreset("Custom");
        expect(settingsState.activePreset).toBe("Default Dark");
        expect(settingsState.themePresets.Custom).toBeUndefined();
    });

    it("forkActivePreset creates a new custom preset from a built-in", () => {
        setActivePreset("Default Light");
        forkActivePreset("My Light", { accent: "#fedcba" });
        expect(settingsState.themePresets["My Light"]).toEqual({
            base: "light",
            colors: { accent: "#fedcba" },
        });
        // Built-in should remain untouched (it's not stored, just resolved)
        expect(settingsState.themePresets["Default Light"]).toBeUndefined();
    });

    it("forkActivePreset dedupes the name if shadowing a built-in", () => {
        setActivePreset("Default Dark");
        forkActivePreset("Default Dark", { accent: "#abcdef" });
        expect(settingsState.themePresets["Default Dark (Copy)"]).toEqual({
            base: "dark",
            colors: { accent: "#abcdef" },
        });
    });

    it("compat: setTheme(base) switches to the matching built-in preset", () => {
        setTheme("amoled");
        expect(settingsState.activePreset).toBe("Default AMOLED");
    });

    it("compat: settingsState.theme returns the active base", () => {
        setActivePreset("Default Light");
        expect(settingsState.theme).toBe("light");
        saveCustomPreset("MyAmoled", "amoled", { accent: "#abcdef" });
        setActivePreset("MyAmoled");
        expect(settingsState.theme).toBe("amoled");
    });

    it("migration: legacy settings:theme migrates to activePreset on boot", async () => {
        localStorage.setItem("settings:theme", "light");
        localStorage.removeItem("settings:activePreset");
        vi.resetModules();
        const fresh = await import("./settings.svelte");
        expect(fresh.settingsState.activePreset).toBe("Default Light");
    });

    it("readThemePresets back-compat: wraps old colors-only shape as {base:dark, colors}", async () => {
        localStorage.setItem(
            "settings:themePresets",
            JSON.stringify({ OldPreset: { accent: "#123456" } }),
        );
        vi.resetModules();
        const fresh = await import("./settings.svelte");
        expect(fresh.settingsState.themePresets.OldPreset).toEqual({
            base: "dark",
            colors: { accent: "#123456" },
        });
    });

    it("renameCustomPreset moves base and colors to the new key", () => {
        saveCustomPreset("OldName", "light", { accent: "#123456" });
        const result = renameCustomPreset("OldName", "NewName");
        expect(result).toBe(true);
        expect(settingsState.themePresets.NewName).toEqual({
            base: "light",
            colors: { accent: "#123456" },
        });
        expect(settingsState.themePresets.OldName).toBeUndefined();
    });

    it("renameCustomPreset updates activePreset when renaming the active preset", () => {
        saveCustomPreset("Current", "dark", { background: "#111111" });
        setActivePreset("Current");
        const result = renameCustomPreset("Current", "Renamed");
        expect(result).toBe(true);
        expect(settingsState.activePreset).toBe("Renamed");
        expect(settingsState.themePresets.Renamed).toEqual({
            base: "dark",
            colors: { background: "#111111" },
        });
    });

    it("renameCustomPreset returns false for built-in presets", () => {
        const result = renameCustomPreset("Default Dark", "NewName");
        expect(result).toBe(false);
        expect(settingsState.themePresets.NewName).toBeUndefined();
    });

    it("renameCustomPreset returns false when oldName does not exist", () => {
        const result = renameCustomPreset("Nonexistent", "NewName");
        expect(result).toBe(false);
        expect(settingsState.themePresets.NewName).toBeUndefined();
    });

    it("renameCustomPreset returns false when newName collides with a built-in", () => {
        saveCustomPreset("Custom", "dark", { accent: "#123456" });
        const result = renameCustomPreset("Custom", "Default Dark");
        expect(result).toBe(false);
        expect(settingsState.themePresets.Custom).toEqual({
            base: "dark",
            colors: { accent: "#123456" },
        });
        expect(settingsState.themePresets["Default Dark"]).toBeUndefined();
    });

    it("renameCustomPreset returns false when newName collides with another custom preset", () => {
        saveCustomPreset("First", "dark", { accent: "#111111" });
        saveCustomPreset("Second", "light", { accent: "#222222" });
        const result = renameCustomPreset("First", "Second");
        expect(result).toBe(false);
        expect(settingsState.themePresets.First).toEqual({
            base: "dark",
            colors: { accent: "#111111" },
        });
        expect(settingsState.themePresets.Second).toEqual({
            base: "light",
            colors: { accent: "#222222" },
        });
    });

    it("renameCustomPreset returns false when newName is empty after trimming", () => {
        saveCustomPreset("Custom", "dark", { accent: "#123456" });
        const result = renameCustomPreset("Custom", "   ");
        expect(result).toBe(false);
        expect(settingsState.themePresets.Custom).toEqual({
            base: "dark",
            colors: { accent: "#123456" },
        });
    });

    it("renameCustomPreset returns true and no-ops when newName equals oldName", () => {
        saveCustomPreset("Same", "dark", { accent: "#123456" });
        const result = renameCustomPreset("Same", "Same");
        expect(result).toBe(true);
        expect(settingsState.themePresets.Same).toEqual({
            base: "dark",
            colors: { accent: "#123456" },
        });
    });
});
