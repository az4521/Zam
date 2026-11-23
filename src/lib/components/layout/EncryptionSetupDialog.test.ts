import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { flushSync, mount, unmount, tick } from "svelte";

// The guided encryption setup: which screen each account posture lands on,
// and that a password sign-in's password is reused instead of asked again.

const h = vi.hoisted(() => ({
    status: {
        read: "ok",
        crossSigningReady: false,
        privateKeysInSecretStorage: false,
        secretStorageReady: false,
        defaultKeyId: null as string | null,
        passphraseRecovery: false,
        thisDeviceVerified: false,
        crossSigningUnpublished: false,
    },
    onServer: false as boolean | null,
    remembered: null as string | null,
    setupRecovery: vi.fn(),
    unlockWithRecoveryKey: vi.fn(),
    onboarding: {
        encryptionSetupOpen: true,
        automatic: false,
        resumeAfterVerification: false,
        unlockReason: null as string | null,
    },
    afterUnlock: null as (() => void) | null,
    fromOtherDevice: null as
        | ((signal: AbortSignal) => Promise<"ready" | "no-devices" | "timeout">)
        | null,
    keptForVerification: null as (() => void) | null,
    verifyWithAnotherDevice: vi.fn(),
}));

vi.mock("$lib/matrix/crypto", () => ({
    getSecurityStatus: async () => ({ ...h.status }),
    getBackupStatus: async () => ({
        read: "ok",
        exists: false,
        active: false,
        trusted: false,
        matchesDecryptionKey: false,
        count: null,
        sessionsRemaining: null,
        version: null,
    }),
    accountHasCrossSigning: async () => h.onServer,
    getCryptoInitError: () => null,
    setupRecovery: h.setupRecovery,
    unlockWithRecoveryKey: h.unlockWithRecoveryKey,
    unlockWithPassphrase: vi.fn(),
}));
vi.mock("$lib/stores/auth.svelte", () => ({
    auth: { userId: "@me:example.org" },
    isOAuthSession: () => false,
}));
vi.mock("$lib/stores/verificationStatus.svelte", () => ({
    refreshVerificationStatus: vi.fn(),
}));
vi.mock("$lib/stores/verification.svelte", () => ({
    verifyWithAnotherDevice: h.verifyWithAnotherDevice,
}));
vi.mock("$lib/stores/interface.svelte", () => ({
    openAppSettingsTab: vi.fn(),
}));
vi.mock("$lib/stores/onboarding.svelte", () => ({
    onboardingState: h.onboarding,
    takeAfterUnlock: () => {
        const run = h.afterUnlock;
        h.afterUnlock = null;
        return run;
    },
    unlockFromOtherDevice: () => h.fromOtherDevice,
    keepAfterUnlockForVerification: () => {
        h.keptForVerification = h.afterUnlock;
        h.afterUnlock = null;
    },
    closeEncryptionSetup: vi.fn(),
    forgetSignInPassword: vi.fn(),
    peekSignInPassword: () => h.remembered,
}));

import EncryptionSetupDialog from "./EncryptionSetupDialog.svelte";
import { closeEncryptionSetup } from "$lib/stores/onboarding.svelte";

async function settle() {
    for (let i = 0; i < 5; i++) {
        await tick();
        await Promise.resolve();
    }
    flushSync();
}

function buttonLabels(): string[] {
    return [...document.body.querySelectorAll("button")].map(
        (b) => b.textContent?.trim() ?? "",
    );
}

describe("EncryptionSetupDialog", () => {
    let component: ReturnType<typeof mount> | null = null;

    beforeEach(() => {
        h.status.secretStorageReady = false;
        h.status.defaultKeyId = null;
        h.status.thisDeviceVerified = false;
        h.onServer = false;
        h.remembered = null;
        h.setupRecovery.mockReset();
        h.unlockWithRecoveryKey.mockReset();
        h.onboarding.unlockReason = null;
        h.afterUnlock = null;
        h.fromOtherDevice = null;
        h.keptForVerification = null;
        h.verifyWithAnotherDevice.mockReset();
        h.onboarding.resumeAfterVerification = false;
    });

    afterEach(() => {
        if (component) unmount(component);
        component = null;
        document.body.innerHTML = "";
    });

    it("offers recovery setup on a brand-new account", async () => {
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        expect(document.body.textContent).toContain("Secure your messages");
        expect(buttonLabels()).toContain("Set up recovery");
    });

    it("verifies instead of setting up over another session's identity", async () => {
        h.onServer = true;
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        expect(document.body.textContent).toContain("Confirm it's you");
        expect(buttonLabels()).toContain("Use another device");
        expect(buttonLabels()).not.toContain("Set up recovery");
        expect(buttonLabels()).not.toContain("Use recovery key");
    });

    it("offers the recovery key when the account has recovery", async () => {
        h.onServer = true;
        h.status.secretStorageReady = true;
        h.status.defaultKeyId = "K";
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        expect(buttonLabels()).toEqual(
            expect.arrayContaining(["Use another device", "Use recovery key"]),
        );
    });

    it("reuses the sign-in password and shows the new key", async () => {
        h.remembered = "hunter2";
        h.setupRecovery.mockResolvedValue({
            recoveryKey: "EsTabcdefgh",
            hasPassphrase: false,
        });
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        const setUp = [...document.body.querySelectorAll("button")].find(
            (b) => b.textContent?.trim() === "Set up recovery",
        )!;
        setUp.click();
        await settle();
        expect(h.setupRecovery).toHaveBeenCalledWith(
            "hunter2",
            undefined,
            expect.any(Function),
        );
        expect(document.body.textContent).toContain("Save your recovery key");
        expect(document.body.querySelector("input[type=password]")).toBeNull();
    });

    it("asks for the password when none is remembered", async () => {
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        [...document.body.querySelectorAll("button")]
            .find((b) => b.textContent?.trim() === "Set up recovery")!
            .click();
        await settle();
        expect(h.setupRecovery).not.toHaveBeenCalled();
        expect(
            document.body.querySelector("input[type=password]"),
        ).not.toBeNull();
    });

    it("says all set on a verified session opened from the nudge", async () => {
        h.onServer = true;
        h.status.secretStorageReady = true;
        h.status.defaultKeyId = "K";
        h.status.thisDeviceVerified = true;
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        expect(document.body.textContent).toContain("You're all set");
    });

    // A verified session can still have secret storage locked (after a
    // restart). Opened to unlock it, the dialog must ask for the key rather
    // than claim all is set, and resume the feature once the key is in.
    it("asks for the key when opened to unlock, even when verified", async () => {
        h.onServer = true;
        h.status.secretStorageReady = true;
        h.status.defaultKeyId = "K";
        h.status.thisDeviceVerified = true;
        h.onboarding.unlockReason = "privateData.unlockToEncrypt";
        const resumed = vi.fn();
        h.afterUnlock = resumed;
        h.unlockWithRecoveryKey.mockResolvedValue({
            total: 0,
            imported: 0,
            sessionVerified: true,
        });
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        expect(document.body.textContent).toContain("Enter your recovery key");
        expect(document.body.textContent).not.toContain("You're all set");
        expect(resumed).not.toHaveBeenCalled();

        const input = document.body.querySelector(
            "input[type=text]",
        ) as HTMLInputElement;
        input.value =
            "EsTc 3gpd 5JNe ZFqb 4GzC Hf7k LRr2 9oVm XEdA bU1s w8iT h6Ky";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await settle();
        [...document.body.querySelectorAll("button")]
            .find((b) => b.textContent?.trim() === "Continue")!
            .click();
        await settle();
        expect(h.unlockWithRecoveryKey).toHaveBeenCalled();
        expect(resumed).toHaveBeenCalledTimes(1);
        expect(document.body.textContent).not.toContain("You're all set");
        expect(closeEncryptionSetup).toHaveBeenCalled();
    });

    // A verified session can get the feature's key from another of its
    // sessions instead of typing the recovery key.
    it("gets the key from another device on a verified session", async () => {
        h.onServer = true;
        h.status.secretStorageReady = true;
        h.status.defaultKeyId = "K";
        h.status.thisDeviceVerified = true;
        h.onboarding.unlockReason = "privateData.unlockToDecrypt";
        const resumed = vi.fn();
        h.afterUnlock = resumed;
        h.fromOtherDevice = vi.fn(async () => "ready" as const);
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        expect(buttonLabels()).not.toContain("Use another device");
        [...document.body.querySelectorAll("button")]
            .find(
                (b) => b.textContent?.trim() === "Get it from another device",
            )!
            .click();
        await settle();
        expect(h.fromOtherDevice).toHaveBeenCalledTimes(1);
        expect(resumed).toHaveBeenCalledTimes(1);
        expect(closeEncryptionSetup).toHaveBeenCalled();
    });

    it("says so when no device answers, and stays on the key prompt", async () => {
        h.onServer = true;
        h.status.secretStorageReady = true;
        h.status.defaultKeyId = "K";
        h.status.thisDeviceVerified = true;
        h.onboarding.unlockReason = "privateData.unlockToDecrypt";
        const resumed = vi.fn();
        h.afterUnlock = resumed;
        h.fromOtherDevice = vi.fn(async () => "no-devices" as const);
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        [...document.body.querySelectorAll("button")]
            .find(
                (b) => b.textContent?.trim() === "Get it from another device",
            )!
            .click();
        await settle();
        expect(resumed).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain(
            "no other verified device to ask",
        );
        expect(document.body.textContent).toContain("Enter your recovery key");
    });

    // An unverified session's key would reach no other session: it is offered
    // device verification, and the feature resumes once that ends.
    it("offers device verification on an unverified session and keeps the feature's action", async () => {
        h.onServer = true;
        h.status.secretStorageReady = true;
        h.status.defaultKeyId = "K";
        h.status.thisDeviceVerified = false;
        h.onboarding.unlockReason = "privateData.unlockToEncrypt";
        const resumed = vi.fn();
        h.afterUnlock = resumed;
        h.fromOtherDevice = vi.fn(async () => "ready" as const);
        h.verifyWithAnotherDevice.mockResolvedValue(undefined);
        component = mount(EncryptionSetupDialog, { target: document.body });
        await settle();
        expect(buttonLabels()).not.toContain("Get it from another device");
        [...document.body.querySelectorAll("button")]
            .find((b) => b.textContent?.trim() === "Use another device")!
            .click();
        await settle();
        expect(h.verifyWithAnotherDevice).toHaveBeenCalledTimes(1);
        expect(h.keptForVerification).toBe(resumed);
        expect(h.onboarding.resumeAfterVerification).toBe(true);
        expect(resumed).not.toHaveBeenCalled();
    });
});
