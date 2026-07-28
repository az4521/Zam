import { describe, it, expect, afterEach, vi } from "vitest";
import { settingsState, setShowReadReceiptAvatars } from "./settings.svelte";

const KEY = "settings:showReadReceiptAvatars";

// The module-level store persists across tests — restore the default after each.
afterEach(() => {
    setShowReadReceiptAvatars(true);
    localStorage.removeItem(KEY);
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
