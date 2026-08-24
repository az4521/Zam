import { describe, expect, it, afterEach, vi } from "vitest";
import {
    REDUCED_MOTION_QUERY,
    prefersReducedMotion,
    resolveReducedMotion,
    reducedMotionActive,
    motionOK,
    scrollBehavior,
} from "./motionPreference";
import { setReduceMotion } from "$lib/stores/settings.svelte";

function stubMatchMedia(matches: boolean) {
    const spy = vi.fn((query: string) => ({ matches, media: query }));
    vi.stubGlobal("matchMedia", spy);
    return spy;
}

afterEach(() => {
    vi.unstubAllGlobals();
    setReduceMotion(false);
});

describe("prefersReducedMotion", () => {
    it("is true when the user asked for reduced motion", () => {
        stubMatchMedia(true);
        expect(prefersReducedMotion()).toBe(true);
    });

    it("is false when the user did not", () => {
        stubMatchMedia(false);
        expect(prefersReducedMotion()).toBe(false);
    });

    it("queries the standard media feature", () => {
        const spy = stubMatchMedia(true);
        prefersReducedMotion();
        expect(spy).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
        expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
    });

    it("defaults to allowing motion when matchMedia is unavailable", () => {
        vi.stubGlobal("matchMedia", undefined);
        expect(prefersReducedMotion()).toBe(false);
    });

    it("defaults to allowing motion when matchMedia throws", () => {
        vi.stubGlobal("matchMedia", () => {
            throw new Error("nope");
        });
        expect(prefersReducedMotion()).toBe(false);
    });
});

describe("resolveReducedMotion", () => {
    it("is false only when neither the toggle nor the OS asks", () => {
        expect(resolveReducedMotion(false, false)).toBe(false);
    });

    it("is true when the app toggle asks, even if the OS does not", () => {
        expect(resolveReducedMotion(true, false)).toBe(true);
    });

    it("is true when the OS asks, even if the app toggle is off", () => {
        expect(resolveReducedMotion(false, true)).toBe(true);
    });

    it("is true when both ask", () => {
        expect(resolveReducedMotion(true, true)).toBe(true);
    });
});

describe("reducedMotionActive / motionOK (setting + OS)", () => {
    it("follows the OS query when the toggle is off", () => {
        setReduceMotion(false);
        stubMatchMedia(true);
        expect(reducedMotionActive()).toBe(true);
        expect(motionOK()).toBe(false);
    });

    it("allows motion when neither the toggle nor the OS asks", () => {
        setReduceMotion(false);
        stubMatchMedia(false);
        expect(reducedMotionActive()).toBe(false);
        expect(motionOK()).toBe(true);
    });

    it("forces reduced motion when the toggle is on and the OS is not", () => {
        setReduceMotion(true);
        stubMatchMedia(false);
        expect(reducedMotionActive()).toBe(true);
        expect(motionOK()).toBe(false);
    });

    it("downgrades smooth scroll to auto when the toggle forces reduction", () => {
        setReduceMotion(true);
        stubMatchMedia(false);
        expect(scrollBehavior("smooth")).toBe("auto");
    });
});

describe("scrollBehavior", () => {
    it("downgrades smooth to auto under reduced motion", () => {
        stubMatchMedia(true);
        expect(scrollBehavior("smooth")).toBe("auto");
    });

    it("keeps smooth when motion is allowed", () => {
        stubMatchMedia(false);
        expect(scrollBehavior("smooth")).toBe("smooth");
    });

    it("defaults to smooth when no preference is passed", () => {
        stubMatchMedia(false);
        expect(scrollBehavior()).toBe("smooth");
    });

    it("never upgrades an explicit instant/auto request", () => {
        stubMatchMedia(false);
        expect(scrollBehavior("instant")).toBe("instant");
        expect(scrollBehavior("auto")).toBe("auto");
    });

    it("leaves instant alone under reduced motion too", () => {
        stubMatchMedia(true);
        expect(scrollBehavior("instant")).toBe("instant");
    });
});
