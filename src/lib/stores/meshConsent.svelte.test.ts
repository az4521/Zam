import { describe, it, expect, afterEach } from "vitest";
import {
    meshConsentState,
    requestMeshConsent,
    resolveMeshConsent,
} from "./meshConsent.svelte";
import { settingsState } from "./settings.svelte";

describe("meshConsent store", () => {
    afterEach(() => {
        settingsState.meshRelayOnly = false;
        resolveMeshConsent("cancel");
    });

    it("asks when the connection may be direct", async () => {
        const p = requestMeshConsent({ joining: true, publishing: true });
        expect(meshConsentState.pending).not.toBeNull();
        resolveMeshConsent("allow");
        await expect(p).resolves.toBe("allow");
    });

    it("asks when relayed but a direct fallback is allowed", () => {
        void requestMeshConsent({
            joining: true,
            publishing: true,
            relayed: true,
        });
        expect(meshConsentState.pending?.relayed).toBe(true);
    });

    it("allows without asking when every connection must go through our relay", async () => {
        settingsState.meshRelayOnly = true;
        await expect(
            requestMeshConsent({
                joining: true,
                publishing: true,
                relayed: true,
            }),
        ).resolves.toBe("allow");
        expect(meshConsentState.pending).toBeNull();
    });

    it("still asks when a relay is required but we have none", () => {
        settingsState.meshRelayOnly = true;
        void requestMeshConsent({ joining: true, publishing: true });
        expect(meshConsentState.pending).not.toBeNull();
    });
});
