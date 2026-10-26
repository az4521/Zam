import { describe, it, expect, afterEach, vi } from "vitest";
import { mount, unmount, flushSync } from "svelte";

vi.mock("$lib/matrix/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("$lib/matrix/client")>()),
    getRoom: () => ({
        getMember: (id: string) =>
            id === "@old:example.org" ? { name: "Old Zam" } : null,
    }),
}));

import CallEncryptionBadge from "./CallEncryptionBadge.svelte";
import { voiceCallState } from "$lib/stores/voiceCall.svelte";

let instance: Record<string, unknown> | null = null;
let host: HTMLElement | null = null;

function render(showLabel = true) {
    host = document.createElement("div");
    document.body.appendChild(host);
    instance = mount(CallEncryptionBadge, {
        target: host,
        props: { roomId: "!room:example.org", showLabel },
    });
    flushSync();
    return host.querySelector('[role="img"]');
}

afterEach(() => {
    voiceCallState.encryption = null;
    if (instance) unmount(instance);
    instance = null;
    host?.remove();
    host = null;
});

describe("CallEncryptionBadge", () => {
    it("shows nothing outside a call", () => {
        expect(render()).toBeNull();
    });

    it("says an encrypted call is encrypted", () => {
        voiceCallState.encryption = { encrypted: true, unencrypted: [] };
        const badge = render();
        expect(badge?.getAttribute("aria-label")).toContain(
            "End-to-end encrypted",
        );
        expect(host!.textContent).toContain("Encrypted");
    });

    it("names who isn't encrypted, and that they can't hear us", () => {
        voiceCallState.encryption = {
            encrypted: true,
            unencrypted: ["@old:example.org", "@stranger:example.org"],
        };
        const label = render()?.getAttribute("aria-label") ?? "";
        expect(label).toContain("except Old Zam, @stranger:example.org");
        expect(label).toContain("they can't hear or see you");
        expect(host!.textContent).toContain("Partly encrypted");
    });

    it("says a plain call isn't end-to-end encrypted, without a label", () => {
        voiceCallState.encryption = { encrypted: false, unencrypted: [] };
        const badge = render();
        expect(badge?.getAttribute("aria-label")).toContain(
            "Not end-to-end encrypted",
        );
        expect(host!.textContent?.trim()).toBe("");
    });
});
