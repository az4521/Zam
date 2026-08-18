import { describe, expect, it } from "vitest";
import {
    securitySetupState,
    securityPanelView,
    type SecurityPosture,
} from "./securityStatusView";

const base: SecurityPosture = {
    read: "ok",
    backupRead: "ok",
    secretStorageReady: false,
    defaultKeyId: null,
    thisDeviceVerified: false,
    backupExists: false,
    backupActive: false,
    hasLastGood: false,
};

describe("securitySetupState", () => {
    it("is loading before the first read lands", () => {
        expect(
            securitySetupState({ ...base, read: null, backupRead: null }),
        ).toBe("loading");
    });

    it("is unavailable when crypto never initialised on this session", () => {
        expect(securitySetupState({ ...base, read: "unavailable" })).toBe(
            "unavailable",
        );
    });

    it("is read-failed when the status read threw", () => {
        expect(securitySetupState({ ...base, read: "error" })).toBe(
            "read-failed",
        );
    });

    it("is read-failed when only the BACKUP read threw", () => {
        expect(securitySetupState({ ...base, backupRead: "error" })).toBe(
            "read-failed",
        );
    });

    it("is fresh on an account with no recovery at all", () => {
        expect(securitySetupState(base)).toBe("fresh");
    });

    it("is partial when recovery exists but this session is unverified", () => {
        expect(
            securitySetupState({
                ...base,
                secretStorageReady: true,
                defaultKeyId: "key1",
                thisDeviceVerified: false,
            }),
        ).toBe("partial");
    });

    it("is partial when a 4S key exists but secret storage is incomplete", () => {
        expect(
            securitySetupState({
                ...base,
                defaultKeyId: "key1",
                thisDeviceVerified: true,
            }),
        ).toBe("partial");
    });

    it("is partial when a backup exists that this session is not using", () => {
        expect(
            securitySetupState({
                ...base,
                secretStorageReady: true,
                defaultKeyId: "key1",
                thisDeviceVerified: true,
                backupExists: true,
                backupActive: false,
            }),
        ).toBe("partial");
    });

    it("is ready when recovery, verification and backup all line up", () => {
        expect(
            securitySetupState({
                ...base,
                secretStorageReady: true,
                defaultKeyId: "key1",
                thisDeviceVerified: true,
                backupExists: true,
                backupActive: true,
            }),
        ).toBe("ready");
    });
});

describe("securityPanelView", () => {
    it("never claims authority or offers destructive actions while loading", () => {
        const v = securityPanelView({ ...base, read: null, backupRead: null });
        expect(v).toEqual({
            state: "loading",
            authoritative: false,
            stale: false,
            allowDestructive: false,
            notice: null,
        });
    });

    it("says the read failed — not that nothing is set up", () => {
        const v = securityPanelView({ ...base, read: "error" });
        expect(v.state).toBe("read-failed");
        expect(v.authoritative).toBe(false);
        expect(v.allowDestructive).toBe(false);
        expect(v.notice).toBe(
            "Couldn't read this account's encryption status. Nothing here is reliable until it loads - don't set up or reset recovery yet.",
        );
    });

    it("marks a retained earlier reading as stale", () => {
        const v = securityPanelView({
            ...base,
            read: "error",
            hasLastGood: true,
        });
        expect(v.stale).toBe(true);
        expect(v.allowDestructive).toBe(false);
    });

    // An unavailable session says exactly as little about the ACCOUNT as a read
    // that threw, so it is no reason to throw away a reading we already have:
    // the two non-authoritative outcomes retain-and-label symmetrically.
    it("keeps a retained reading, labelled stale, when the session goes unavailable", () => {
        const v = securityPanelView({
            ...base,
            read: "unavailable",
            hasLastGood: true,
        });
        expect(v.state).toBe("unavailable");
        expect(v.stale).toBe(true);
        expect(v.authoritative).toBe(false);
        expect(v.allowDestructive).toBe(false);
        expect(v.notice).toBe(
            "Encryption isn't ready on this session yet. Reload if this persists.",
        );
    });

    it("has nothing to call stale before the first read lands", () => {
        const v = securityPanelView({
            ...base,
            read: null,
            backupRead: null,
            hasLastGood: true,
        });
        expect(v.state).toBe("loading");
        expect(v.stale).toBe(false);
    });

    it("explains an unavailable session without blaming the account", () => {
        const v = securityPanelView({ ...base, read: "unavailable" });
        expect(v.state).toBe("unavailable");
        expect(v.notice).toBe(
            "Encryption isn't ready on this session yet. Reload if this persists.",
        );
    });

    it("allows destructive actions only on an authoritative read", () => {
        const fresh = securityPanelView(base);
        expect(fresh).toEqual({
            state: "fresh",
            authoritative: true,
            stale: false,
            allowDestructive: true,
            notice: null,
        });
    });
});
