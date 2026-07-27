import { describe, it, expect, afterEach } from "vitest";
import { settingsState, setShowReadReceiptAvatars } from "./settings.svelte";

const KEY = "settings:showReadReceiptAvatars";

// The module-level store persists across tests — restore the default after each.
afterEach(() => {
    setShowReadReceiptAvatars(true);
    localStorage.removeItem(KEY);
});

describe("showReadReceiptAvatars", () => {
    it("defaults to true so existing users keep the avatars", () => {
        expect(settingsState.showReadReceiptAvatars).toBe(true);
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
