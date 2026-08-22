import { describe, it, expect, beforeEach } from "vitest";
import {
    sessionHealthState,
    setSessionCryptoStatus,
    markSyncStoreFallback,
    resetSyncStoreFallback,
    dismissCryptoBanner,
    shouldShowCryptoBanner,
} from "./sessionHealth.svelte";

beforeEach(() => {
    // Reset the singleton between tests.
    setSessionCryptoStatus(null);
    resetSyncStoreFallback();
});

describe("sessionHealth crypto status", () => {
    it("starts hidden while crypto status is unknown (null)", () => {
        expect(sessionHealthState.cryptoAvailable).toBeNull();
        expect(shouldShowCryptoBanner()).toBe(false);
    });

    it("shows the banner when crypto init failed", () => {
        setSessionCryptoStatus(false);
        expect(shouldShowCryptoBanner()).toBe(true);
    });

    it("hides the banner when crypto is available", () => {
        setSessionCryptoStatus(true);
        expect(shouldShowCryptoBanner()).toBe(false);
    });

    it("stays hidden once dismissed", () => {
        setSessionCryptoStatus(false);
        dismissCryptoBanner();
        expect(shouldShowCryptoBanner()).toBe(false);
    });

    it("clears the dismiss flag when status recovers (account switch / re-init)", () => {
        setSessionCryptoStatus(false);
        dismissCryptoBanner();
        setSessionCryptoStatus(null);
        expect(sessionHealthState.cryptoBannerDismissed).toBe(false);
        setSessionCryptoStatus(false);
        expect(shouldShowCryptoBanner()).toBe(true);
    });
});

describe("sessionHealth sync-store fallback", () => {
    it("defaults to no fallback", () => {
        expect(sessionHealthState.syncStoreFallback).toBe(false);
    });
    it("marks and resets the fallback flag", () => {
        markSyncStoreFallback();
        expect(sessionHealthState.syncStoreFallback).toBe(true);
        resetSyncStoreFallback();
        expect(sessionHealthState.syncStoreFallback).toBe(false);
    });
});
