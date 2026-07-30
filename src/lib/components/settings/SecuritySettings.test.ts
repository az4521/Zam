import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flushSync, mount, unmount } from "svelte";

// Regression cover for audit CRYPTO-02: a failed crypto read must never render
// as "nothing is set up", and must never leave the destructive affordances
// ("Set up recovery", "Reset recovery") live on top of a posture we didn't read.
//
// The SDK boundary is mocked, so this mounts the real component with no
// matrix-js-sdk in the graph.

const h = vi.hoisted(() => {
    /**
     * Faithful stand-in for crypto.ts's marker error: `resetEncryption()`
     * succeeded and minting the replacement recovery did not. The real class and
     * its predicate are covered in `src/lib/matrix/crypto.test.ts`; here they
     * only need to be distinguishable from an ordinary Error.
     */
    class RecoverySetupIncompleteError extends Error {
        constructor(message: string) {
            super(message);
            this.name = "RecoverySetupIncompleteError";
        }
    }
    return {
        getSecurityStatus: vi.fn(),
        getBackupStatus: vi.fn(),
        setupRecovery: vi.fn(),
        resetRecovery: vi.fn(),
        RecoverySetupIncompleteError,
    };
});

vi.mock("$lib/matrix/crypto", () => ({
    getSecurityStatus: h.getSecurityStatus,
    getBackupStatus: h.getBackupStatus,
    setupRecovery: h.setupRecovery,
    resetRecovery: h.resetRecovery,
    // Deliberately NOT a vi.fn: `vi.resetAllMocks()` in beforeEach would strip
    // the implementation and every failure would classify as "before destroy".
    isRecoverySetupIncomplete: (e: unknown) =>
        e instanceof h.RecoverySetupIncompleteError,
    unlockWithRecoveryKey: vi.fn(),
    unlockWithPassphrase: vi.fn(),
}));

import SecuritySettings from "./SecuritySettings.svelte";
import { bumpSecurityTick } from "$lib/stores/security.svelte";
import { formatRecoveryKey } from "$lib/utils/recoveryKey";

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
const unavailableStatus = { ...erroredStatus, read: "unavailable" as const };
const unavailableBackup = { ...erroredBackup, read: "unavailable" as const };

const READ_FAILED = "Couldn't read this account's encryption status";
const STALE_MARKER = "Showing the last reading that loaded";

let target: HTMLDivElement;
let app: Record<string, unknown> | null = null;

/**
 * Wait until the panel actually renders what the test is about.
 *
 * Condition-based on purpose: `loadStatus()` runs from a tick-driven `$effect`
 * and awaits two reads, so draining a COUNTED number of microtasks would pin
 * these tests to the exact number of awaits inside it — add one and every
 * negative assertion below would run against a half-rendered panel and pass
 * silently. `vi.waitFor` retries until the DOM says what we're waiting for.
 */
async function until(assertion: () => void) {
    await vi.waitFor(() => {
        flushSync();
        assertion();
    });
}

/**
 * Yield to the MACROtask queue, which drains every already-queued promise
 * continuation first — categorically, not by count. Needed for the one
 * assertion that is about state NOT changing, which no condition can wait for.
 */
async function drained() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
}

function render() {
    app = mount(SecuritySettings, { target });
}

const text = () => target.textContent ?? "";
/**
 * textContent with runs of whitespace collapsed. Sentences long enough to wrap
 * in the markup arrive with Prettier's line breaks and indentation inside them,
 * so a needle that spans a wrap only matches against this.
 */
const flat = () => (target.textContent ?? "").replace(/\s+/g, " ");
const buttonByText = (label: string) =>
    [...target.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes(label),
    );

/** Click a button by its label, failing loudly if the UI never offered it. */
function click(label: string) {
    const button = buttonByText(label);
    if (!button) throw new Error(`no button labelled "${label}" is rendered`);
    button.click();
    flushSync();
}

/** Type into a field the way a user does, so `bind:value` actually updates. */
function type(placeholder: string, value: string) {
    const input = target.querySelector<HTMLInputElement>(
        `input[placeholder="${placeholder}"]`,
    );
    if (!input) throw new Error(`no input placeholdered "${placeholder}"`);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
}
/** The <section> that renders a given claim, so an assertion can be scoped. */
const sectionWith = (needle: string) =>
    [...target.querySelectorAll("section")].find((s) =>
        (s.textContent ?? "").includes(needle),
    );

beforeEach(() => {
    // resetAllMocks, not clearAllMocks: clearing keeps the previous test's
    // mockResolvedValue, so a test that set only one of the two reads would
    // silently inherit the other test's posture. Every test sets both.
    vi.resetAllMocks();
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
        render();

        // "Recovery key ID:" is rendered by the status rows alone, and they only
        // render from a reading that landed. Asserting on "Set up" would be
        // vacuous — the page's static header copy says "Set up recovery so your
        // cross-signing identity…" whatever the read did.
        await until(() => expect(text()).toContain("Recovery key ID:"));

        expect(text()).toContain("Recovery is set up");
        expect(text()).not.toContain(READ_FAILED);
        expect(text()).not.toContain(STALE_MARKER);
    });

    it("says the read failed instead of claiming nothing is set up", async () => {
        h.getSecurityStatus.mockResolvedValue(erroredStatus);
        h.getBackupStatus.mockResolvedValue(erroredBackup);
        render();

        await until(() => expect(text()).toContain(READ_FAILED));

        // The all-false payload behind a failed read must not reach the rows.
        expect(text()).not.toContain("Not set up");
        expect(text()).not.toContain("Unverified");
        // …nor may it invite the user to create recovery over existing keys.
        expect(buttonByText("Set up recovery")).toBeUndefined();
        // Nothing ever loaded, so there is no earlier reading to flag as stale.
        expect(text()).not.toContain(STALE_MARKER);
    });

    it("keeps the last good reading and flags it stale when a later read fails", async () => {
        h.getSecurityStatus.mockResolvedValue(okStatus);
        h.getBackupStatus.mockResolvedValue(okBackup);
        render();
        await until(() => expect(text()).toContain("Recovery is set up"));

        h.getSecurityStatus.mockResolvedValue(erroredStatus);
        h.getBackupStatus.mockResolvedValue(erroredBackup);
        bumpSecurityTick();
        await until(() => expect(text()).toContain(READ_FAILED));

        // The reading the user had is still there, marked as possibly out of date…
        expect(text()).toContain(STALE_MARKER);
        expect(text()).not.toContain("Not set up");
        // …including the "Recovery is set up" panel, which renders from that same
        // retained payload and would otherwise read as a current positive claim.
        expect(sectionWith("Recovery is set up")?.textContent).toContain(
            STALE_MARKER,
        );
        // …and the destructive door is shut while we can't confirm the posture.
        const reset = buttonByText("Reset recovery");
        expect(reset).toBeDefined();
        expect(reset?.disabled).toBe(true);
    });

    it("offers reset only on a reading that landed", async () => {
        h.getSecurityStatus.mockResolvedValue(okStatus);
        h.getBackupStatus.mockResolvedValue(okBackup);
        render();

        await until(() =>
            expect(buttonByText("Reset recovery")?.disabled).toBe(false),
        );
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
        render();
        await until(() =>
            expect(text()).toContain("Loading encryption status"),
        );

        // A newer read starts and fails while the first is still outstanding.
        h.getSecurityStatus.mockResolvedValue(erroredStatus);
        h.getBackupStatus.mockResolvedValue(erroredBackup);
        bumpSecurityTick();
        await until(() => expect(text()).toContain(READ_FAILED));

        // The stale run finally lands with a successful-looking payload.
        releaseFirst(okStatus);
        await drained();

        expect(text()).toContain(READ_FAILED);
        expect(text()).not.toContain("Recovery key ID:");
        expect(buttonByText("Reset recovery")).toBeUndefined();
    });

    it("explains an unavailable session rather than blaming the account", async () => {
        h.getSecurityStatus.mockResolvedValue(unavailableStatus);
        h.getBackupStatus.mockResolvedValue(unavailableBackup);
        render();

        await until(() =>
            expect(text()).toContain(
                "Encryption isn't ready on this session yet",
            ),
        );

        expect(text()).not.toContain("Not set up");
        expect(buttonByText("Set up recovery")).toBeUndefined();
    });

    it("keeps a retained reading when the session goes unavailable", async () => {
        h.getSecurityStatus.mockResolvedValue(okStatus);
        h.getBackupStatus.mockResolvedValue(okBackup);
        render();
        await until(() => expect(text()).toContain("Recovery key ID:"));

        h.getSecurityStatus.mockResolvedValue(unavailableStatus);
        h.getBackupStatus.mockResolvedValue(unavailableBackup);
        bumpSecurityTick();
        await until(() => expect(text()).toContain(STALE_MARKER));

        // Shown-and-labelled, not blanked: an unavailable session says nothing
        // about the ACCOUNT, so the reading we already have survives.
        expect(text()).toContain("Recovery key ID:");
        expect(text()).toContain("Encryption isn't ready on this session yet");
        expect(buttonByText("Reset recovery")?.disabled).toBe(true);
    });
});

// Regression cover for audit CRYPTO-01. `resetRecovery()` destroys the old
// recovery key and backup and only THEN mints the replacement, so a failure in
// the second half leaves the account with NO recovery — and the old UI dropped
// the user back on the password step, whose submit re-ran the destructive half.
const REPAIR_COPY = "but the new recovery wasn't created";
const NEW_KEY = "EsTbrandnewrecoverykey";
const RESET_BUTTON = "Reset & create new key";
const REPAIR_BUTTON = "Finish setting up recovery";

/** Read a field's current value, to prove typed input survived a failure. */
const fieldValue = (placeholder: string) =>
    target.querySelector<HTMLInputElement>(
        `input[placeholder="${placeholder}"]`,
    )?.value;

/** Mount on a healthy account and walk to the reset flow's password step. */
async function reachResetPassword() {
    h.getSecurityStatus.mockResolvedValue(okStatus);
    h.getBackupStatus.mockResolvedValue(okBackup);
    render();
    await until(() =>
        expect(buttonByText("Reset recovery")?.disabled).toBe(false),
    );
    click("Reset recovery");
    click("Continue");
    type("Account password", "hunter2");
}

/** …and past the destructive step, which destroyed and then failed. */
async function reachRepair(message = "secret storage upload rejected") {
    h.resetRecovery.mockRejectedValue(
        new h.RecoverySetupIncompleteError(message),
    );
    await reachResetPassword();
    click(RESET_BUTTON);
    await until(() => expect(flat()).toContain(REPAIR_COPY));
}

describe("SecuritySettings reset-recovery phases", () => {
    it("says the reset half-completed instead of looking like a plain retry", async () => {
        await reachRepair();

        // Its own words: not the generic error the password step showed, which
        // is what made re-submitting (and wiping again) the obvious next move.
        expect(flat()).toContain("Your old recovery key and backup were reset");
        expect(flat()).toContain("secret storage upload rejected");

        // No route back to the destructive call, by any control on screen…
        expect(buttonByText(RESET_BUTTON)).toBeUndefined();
        expect(buttonByText("Reset recovery")).toBeUndefined();
        // …and no way to dismiss an account that currently has no recovery.
        expect(buttonByText("Cancel")).toBeUndefined();
        expect(buttonByText(REPAIR_BUTTON)).toBeDefined();
    });

    it("repairs with the setup half alone — resetRecovery is never called twice", async () => {
        h.setupRecovery.mockResolvedValue({
            recoveryKey: NEW_KEY,
            hasPassphrase: false,
        });
        await reachRepair();

        click(REPAIR_BUTTON);
        await until(() => expect(flat()).toContain("Save your recovery key"));

        // THE finding: the repair runs the non-destructive half only.
        expect(h.setupRecovery).toHaveBeenCalledTimes(1);
        expect(h.resetRecovery).toHaveBeenCalledTimes(1);
        expect(flat()).toContain(formatRecoveryKey(NEW_KEY));
        // The flow is finished, so the password is out of memory and off screen.
        expect(fieldValue("Account password")).toBeUndefined();
        expect(flat()).not.toContain(REPAIR_COPY);
    });

    it("keeps a repair that fails again in repair, with the typed password intact", async () => {
        h.setupRecovery.mockRejectedValue(new Error("still no secret storage"));
        await reachRepair();

        click(REPAIR_BUTTON);
        await until(() => expect(flat()).toContain("still no secret storage"));

        expect(flat()).toContain(REPAIR_COPY);
        expect(buttonByText(RESET_BUTTON)).toBeUndefined();
        expect(buttonByText(REPAIR_BUTTON)).toBeDefined();
        expect(h.resetRecovery).toHaveBeenCalledTimes(1);
        // A rejected retry costs the user nothing they'd already given us.
        expect(fieldValue("Account password")).toBe("hunter2");
    });

    // The other half of the distinction: a reset that threw BEFORE destroying
    // anything must stay an ordinary retry, or the repair panel would be its own
    // new lie ("we destroyed your recovery" when we didn't).
    it("leaves a failure before the destructive step retryable", async () => {
        h.resetRecovery.mockRejectedValue(new Error("Incorrect password"));
        await reachResetPassword();

        click(RESET_BUTTON);
        await until(() => expect(flat()).toContain("Incorrect password"));

        expect(flat()).not.toContain(REPAIR_COPY);
        expect(buttonByText(RESET_BUTTON)).toBeDefined();
        expect(buttonByText("Cancel")).toBeDefined();
        expect(fieldValue("Account password")).toBe("hunter2");
    });

    // A tick-driven read lands on its own schedule. Once the old recovery is
    // gone, no reading may unmount the panel that says so — the "fresh account"
    // reading that follows a successful destroy would otherwise swap in the
    // Set-up wizard (whose Cancel walks away with no recovery at all).
    it("survives a background read that says the account is fresh", async () => {
        await reachRepair();

        h.getSecurityStatus.mockResolvedValue({
            ...okStatus,
            secretStorageReady: false,
            privateKeysInSecretStorage: false,
            defaultKeyId: null,
        });
        h.getBackupStatus.mockResolvedValue({ ...okBackup, exists: false });
        bumpSecurityTick();
        await drained();

        expect(flat()).toContain(REPAIR_COPY);
        expect(buttonByText("Set up recovery")).toBeUndefined();
        expect(buttonByText(RESET_BUTTON)).toBeUndefined();

        // …and a read that fails outright must not blank it either.
        h.getSecurityStatus.mockResolvedValue(erroredStatus);
        h.getBackupStatus.mockResolvedValue(erroredBackup);
        bumpSecurityTick();
        await until(() => expect(flat()).toContain(READ_FAILED));

        expect(flat()).toContain(REPAIR_COPY);
        expect(buttonByText(REPAIR_BUTTON)).toBeDefined();
    });

    // What stops a re-wipe after the component UNMOUNTS mid-repair (settings
    // closed and reopened, back-navigation): `resetStep` is component state, so
    // the remount starts at `idle` — and what it offers is then decided by the
    // READ. A successful destroy leaves the account with no 4S key, which
    // renders the non-destructive Set-up wizard; the destructive entry button
    // lives only inside the "Recovery is set up" panel, which that reading
    // cannot produce.
    it("offers only the non-destructive setup on a remount with no recovery", async () => {
        h.getSecurityStatus.mockResolvedValue({
            ...okStatus,
            secretStorageReady: false,
            privateKeysInSecretStorage: false,
            defaultKeyId: null,
        });
        h.getBackupStatus.mockResolvedValue({
            ...okBackup,
            exists: false,
            active: false,
            matchesDecryptionKey: false,
            count: null,
            version: null,
        });
        render();

        await until(() =>
            expect(buttonByText("Set up recovery")).toBeDefined(),
        );

        expect(buttonByText(RESET_BUTTON)).toBeUndefined();
        expect(buttonByText("Reset recovery")).toBeUndefined();
    });

    it("cannot start a second destructive call while the first is in flight", async () => {
        h.resetRecovery.mockReturnValue(new Promise(() => {}));
        await reachResetPassword();

        click(RESET_BUTTON);

        // The destructive control is gone as a target: it now reads as busy and
        // is disabled, and the phase refuses a second submit regardless.
        expect(buttonByText(RESET_BUTTON)).toBeUndefined();
        const busy = buttonByText("Resetting…");
        expect(busy?.disabled).toBe(true);
        busy?.click();
        flushSync();
        expect(h.resetRecovery).toHaveBeenCalledTimes(1);
    });

    it("cannot start a second repair while the first is in flight", async () => {
        h.setupRecovery.mockReturnValue(new Promise(() => {}));
        await reachRepair();

        click(REPAIR_BUTTON);

        expect(buttonByText(REPAIR_BUTTON)).toBeUndefined();
        const busy = buttonByText("Working…");
        expect(busy?.disabled).toBe(true);
        busy?.click();
        flushSync();
        expect(h.setupRecovery).toHaveBeenCalledTimes(1);
        expect(h.resetRecovery).toHaveBeenCalledTimes(1);
    });
});
