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
const buttonByText = (label: string) =>
    [...target.querySelectorAll("button")].find((b) =>
        (b.textContent ?? "").includes(label),
    );
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
