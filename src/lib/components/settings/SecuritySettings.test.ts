import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushSync, mount, unmount } from "svelte";

// Regression cover for audit CRYPTO-02: a failed crypto read must never render
// as "nothing is set up", and must never leave the destructive affordances
// ("Set up recovery", "Reset recovery") live on top of a posture we didn't read.
//
// The SDK boundary is mocked, so this mounts the real component with no
// matrix-js-sdk in the graph.

const h = vi.hoisted(() => ({
    getSecurityStatus: vi.fn(),
    getBackupStatus: vi.fn(),
}));

vi.mock("$lib/matrix/crypto", () => ({
    getSecurityStatus: h.getSecurityStatus,
    getBackupStatus: h.getBackupStatus,
    setupRecovery: vi.fn(),
    resetRecovery: vi.fn(),
    unlockWithRecoveryKey: vi.fn(),
    unlockWithPassphrase: vi.fn(),
}));

import SecuritySettings from "./SecuritySettings.svelte";
import { bumpSecurityTick } from "$lib/stores/security.svelte";

const okStatus = {
    read: "ok" as const,
    crossSigningReady: true,
    privateKeysInSecretStorage: true,
    secretStorageReady: true,
    defaultKeyId: "abcdef",
    passphraseRecovery: false,
    thisDeviceVerified: true,
};
const okBackup = {
    read: "ok" as const,
    exists: true,
    active: true,
    trusted: true,
    matchesDecryptionKey: true,
    count: 12,
    sessionsRemaining: 0,
    version: "3",
};
const erroredStatus = {
    read: "error" as const,
    crossSigningReady: false,
    privateKeysInSecretStorage: false,
    secretStorageReady: false,
    defaultKeyId: null,
    passphraseRecovery: false,
    thisDeviceVerified: false,
};
const erroredBackup = {
    read: "error" as const,
    exists: false,
    active: false,
    trusted: false,
    matchesDecryptionKey: false,
    count: null,
    sessionsRemaining: null,
    version: null,
};

let target: HTMLDivElement;
let app: Record<string, unknown> | null = null;

/** Let the tick-driven $effect's two awaited reads settle, then re-render. */
async function settle() {
    for (let i = 0; i < 4; i++) {
        await Promise.resolve();
        flushSync();
    }
}

async function render() {
    app = mount(SecuritySettings, { target });
    await settle();
}

const text = () => target.textContent ?? "";
const buttonByText = (label: string) =>
    [...target.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes(label),
    );

beforeEach(() => {
    vi.clearAllMocks();
    target = document.createElement("div");
    document.body.appendChild(target);
});

afterEach(() => {
    if (app) unmount(app);
    app = null;
    target.remove();
});

describe("SecuritySettings read honesty", () => {
    it("renders the account's posture when the read lands", async () => {
        h.getSecurityStatus.mockResolvedValue(okStatus);
        h.getBackupStatus.mockResolvedValue(okBackup);
        await render();

        expect(text()).toContain("Set up");
        expect(text()).not.toContain("Couldn't read");
        expect(text()).not.toContain("Showing the last reading");
    });

    it("says the read failed instead of claiming nothing is set up", async () => {
        h.getSecurityStatus.mockResolvedValue(erroredStatus);
        h.getBackupStatus.mockResolvedValue(erroredBackup);
        await render();

        expect(text()).toContain(
            "Couldn't read this account's encryption status",
        );
        // The all-false payload behind a failed read must not reach the rows.
        expect(text()).not.toContain("Not set up");
        expect(text()).not.toContain("Unverified");
        // …nor may it invite the user to create recovery over existing keys.
        expect(buttonByText("Set up recovery")).toBeUndefined();
        // Nothing ever loaded, so there is no earlier reading to flag as stale.
        expect(text()).not.toContain("Showing the last reading");
    });

    it("keeps the last good reading and flags it stale when a later read fails", async () => {
        h.getSecurityStatus.mockResolvedValue(okStatus);
        h.getBackupStatus.mockResolvedValue(okBackup);
        await render();
        expect(text()).toContain("Recovery is set up");

        h.getSecurityStatus.mockResolvedValue(erroredStatus);
        h.getBackupStatus.mockResolvedValue(erroredBackup);
        bumpSecurityTick();
        await settle();

        // The reading the user had is still there, marked as possibly out of date…
        expect(text()).toContain("Showing the last reading that loaded");
        expect(text()).toContain(
            "Couldn't read this account's encryption status",
        );
        expect(text()).not.toContain("Not set up");
        // …and the destructive door is shut while we can't confirm the posture.
        const reset = buttonByText("Reset recovery");
        expect(reset).toBeDefined();
        expect(reset?.disabled).toBe(true);
    });

    it("offers reset only on a reading that landed", async () => {
        h.getSecurityStatus.mockResolvedValue(okStatus);
        h.getBackupStatus.mockResolvedValue(okBackup);
        await render();

        expect(buttonByText("Reset recovery")?.disabled).toBe(false);
    });

    // loadStatus() is fired from a tick-driven $effect and awaits two reads, so
    // two runs can be in flight at once and the later-RESOLVING one is not
    // necessarily the later-STARTING one. An older reading landing last must not
    // win — least of all by re-opening the destructive door on a posture that
    // has since failed to read.
    it("ignores a slow earlier read that resolves after a newer one", async () => {
        let releaseFirst: (v: unknown) => void = () => {};
        h.getSecurityStatus.mockReturnValueOnce(
            new Promise((resolve) => {
                releaseFirst = resolve;
            }),
        );
        h.getBackupStatus.mockResolvedValue(okBackup);
        await render();
        expect(text()).toContain("Loading encryption status");

        // A newer read starts and fails while the first is still outstanding.
        h.getSecurityStatus.mockResolvedValue(erroredStatus);
        h.getBackupStatus.mockResolvedValue(erroredBackup);
        bumpSecurityTick();
        await settle();
        expect(text()).toContain(
            "Couldn't read this account's encryption status",
        );

        // The stale run finally lands with a successful-looking payload.
        releaseFirst(okStatus);
        await settle();

        expect(text()).toContain(
            "Couldn't read this account's encryption status",
        );
        expect(buttonByText("Reset recovery")).toBeUndefined();
    });

    it("explains an unavailable session rather than blaming the account", async () => {
        h.getSecurityStatus.mockResolvedValue({
            ...erroredStatus,
            read: "unavailable" as const,
        });
        h.getBackupStatus.mockResolvedValue({
            ...erroredBackup,
            read: "unavailable" as const,
        });
        await render();

        expect(text()).toContain("Encryption isn't ready on this session yet");
        expect(text()).not.toContain("Not set up");
        expect(buttonByText("Set up recovery")).toBeUndefined();
    });
});
