import { describe, it, expect, vi, afterEach } from "vitest";
import { flushSync, mount, unmount } from "svelte";

// SAS picks each of its 7 emoji independently from 64, so the same emoji can
// show up twice. The grid used to key on symbol + name and threw Svelte's
// each_key_duplicate mid-verification (reported 2026-10-17).

const h = vi.hoisted(() => ({
    view: {
        phase: 4, // Started
        isSelfVerification: true,
        otherUserId: "@me:example.org",
        otherDeviceId: "OTHER",
        sasEmoji: [] as [string, string][],
    },
}));

vi.mock("$lib/stores/verification.svelte", () => ({
    verificationState: {
        verificationTick: 0,
        active: { view: () => h.view },
    },
    closeActive: vi.fn(),
}));

import VerificationModal from "./VerificationModal.svelte";

describe("VerificationModal SAS emoji", () => {
    let component: ReturnType<typeof mount> | null = null;

    afterEach(() => {
        if (component) unmount(component);
        component = null;
        document.body.innerHTML = "";
    });

    it("renders a repeated emoji instead of throwing", () => {
        h.view.sasEmoji = [
            ["🐶", "dog"],
            ["🐱", "cat"],
            ["🐶", "dog"],
            ["🦁", "lion"],
            ["🐎", "horse"],
            ["🦄", "unicorn"],
            ["🐷", "pig"],
        ];
        component = mount(VerificationModal, { target: document.body });
        flushSync();

        const dogs = [...document.body.querySelectorAll("span")].filter(
            (s) => s.textContent === "🐶",
        );
        expect(dogs).toHaveLength(2);
    });
});
