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
    unlockWithRecoveryKey: vi.fn(),
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
    verifyWithAnotherDevice: vi.fn(),
}));
vi.mock("$lib/stores/interface.svelte", () => ({
    openAppSettingsTab: vi.fn(),
}));
vi.mock("$lib/stores/onboarding.svelte", () => ({
    onboardingState: {
        encryptionSetupOpen: true,
        automatic: false,
        resumeAfterVerification: false,
    },
    closeEncryptionSetup: vi.fn(),
    forgetSignInPassword: vi.fn(),
    peekSignInPassword: () => h.remembered,
}));

import EncryptionSetupDialog from "./EncryptionSetupDialog.svelte";

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
});
