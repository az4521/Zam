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

const ENCRYPT_DMS_KEY = "settings:encryptNewDms";
const SCOPED_USER = "@precedence:example.org";
const SCOPED_ENCRYPT_DMS_KEY = `${ENCRYPT_DMS_KEY}:${SCOPED_USER}`;

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
        auth.userId = SCOPED_USER;
        try {
            fresh.reloadAccountSettings();
            expect(fresh.settingsState.encryptNewDms).toBe(false);
        } finally {
            auth.userId = null;
        }
    });
});
