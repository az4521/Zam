import { describe, it, expect } from "vitest";
import {
    joinConsentState,
    requestJoinConsent,
    resolveJoinConsent,
} from "./joinConsent.svelte";

const descriptor = {
    display: "#dev:matrix.org",
    resolvedRoomId: "!room:matrix.org",
    serverMismatch: false,
};

describe("joinConsent store", () => {
    it("exposes the pending descriptor while a request is open", () => {
        const p = requestJoinConsent(descriptor);
        expect(joinConsentState.pending?.display).toBe("#dev:matrix.org");
        resolveJoinConsent(false);
        return expect(p).resolves.toBe(false);
    });

    it("resolves true on confirm and clears pending", async () => {
        const p = requestJoinConsent(descriptor);
        resolveJoinConsent(true);
        await expect(p).resolves.toBe(true);
        expect(joinConsentState.pending).toBeNull();
    });

    it("resolves false on cancel", async () => {
        const p = requestJoinConsent(descriptor);
        resolveJoinConsent(false);
        await expect(p).resolves.toBe(false);
        expect(joinConsentState.pending).toBeNull();
    });

    it("supersedes an open request, resolving the previous one false", async () => {
        const first = requestJoinConsent(descriptor);
        const second = requestJoinConsent({
            ...descriptor,
            display: "#other:matrix.org",
        });
        await expect(first).resolves.toBe(false);
        expect(joinConsentState.pending?.display).toBe("#other:matrix.org");
        resolveJoinConsent(true);
        await expect(second).resolves.toBe(true);
    });

    it("resolveJoinConsent with no pending request is a no-op", () => {
        expect(() => resolveJoinConsent(true)).not.toThrow();
        expect(joinConsentState.pending).toBeNull();
    });
});
