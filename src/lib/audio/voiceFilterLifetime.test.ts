import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const releases = vi.hoisted(() => ({
    deep: vi.fn(),
    fe: vi.fn(),
    feGpu: vi.fn(),
    rnn: vi.fn(),
    agc: vi.fn(),
}));

vi.mock("./deepFilter", () => ({ releaseDeepFilter: releases.deep }));
vi.mock("./fastenhancer", () => ({ releaseFastEnhancer: releases.fe }));
vi.mock("./fastenhancerGpu", () => ({
    releaseFastEnhancerGpu: releases.feGpu,
}));
vi.mock("./rnnoise", () => ({ releaseRnnoise: releases.rnn }));
vi.mock("./agc2", () => ({ releaseAgc2: releases.agc }));

import {
    VOICE_FILTER_RELEASE_GRACE_MS as GRACE,
    acquireVoiceFilters,
    releaseVoiceFilters,
    voiceFilterUsers,
} from "./voiceFilterLifetime";

const everyRelease = () => Object.values(releases);

beforeEach(() => {
    vi.useFakeTimers();
    for (const r of everyRelease()) r.mockClear();
});

afterEach(() => {
    // Drain any pending grace timer so one test's lease can't leak into the
    // next (the module keeps its count between tests).
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
});

describe("voice filter leases", () => {
    it("counts holders and drops to zero only when every lease is released", () => {
        const a = acquireVoiceFilters();
        const b = acquireVoiceFilters();
        expect(voiceFilterUsers()).toBe(2);
        a();
        expect(voiceFilterUsers()).toBe(1);
        b();
        expect(voiceFilterUsers()).toBe(0);
    });

    it("releases a lease at most once", () => {
        const a = acquireVoiceFilters();
        const b = acquireVoiceFilters();
        a();
        a();
        a();
        expect(voiceFilterUsers()).toBe(1);
        b();
        expect(voiceFilterUsers()).toBe(0);
    });

    it("does not release until the grace period has passed", () => {
        const a = acquireVoiceFilters();
        a();
        vi.advanceTimersByTime(GRACE - 1);
        for (const r of everyRelease()) expect(r).not.toHaveBeenCalled();
        vi.advanceTimersByTime(1);
        for (const r of everyRelease()) expect(r).toHaveBeenCalledTimes(1);
    });

    it("a quick re-acquire during the grace cancels the release", () => {
        const a = acquireVoiceFilters();
        a();
        vi.advanceTimersByTime(GRACE / 2);
        const b = acquireVoiceFilters();
        vi.advanceTimersByTime(GRACE * 2);
        for (const r of everyRelease()) expect(r).not.toHaveBeenCalled();
        b();
        vi.advanceTimersByTime(GRACE);
        for (const r of everyRelease()) expect(r).toHaveBeenCalledTimes(1);
    });

    it("does not release while any holder is still active", () => {
        const call = acquireVoiceFilters();
        const chain = acquireVoiceFilters();
        call();
        // The call lease is gone but a chain still uses the filters.
        vi.advanceTimersByTime(GRACE * 3);
        for (const r of everyRelease()) expect(r).not.toHaveBeenCalled();
        chain();
        vi.advanceTimersByTime(GRACE);
        for (const r of everyRelease()) expect(r).toHaveBeenCalledTimes(1);
    });

    it("a timer scheduled before a second holder does not release under it", () => {
        const a = acquireVoiceFilters();
        a();
        vi.advanceTimersByTime(GRACE / 2);
        const b = acquireVoiceFilters();
        // Let the original deadline pass while b is held.
        vi.advanceTimersByTime(GRACE);
        for (const r of everyRelease()) expect(r).not.toHaveBeenCalled();
        b();
    });
});

describe("releaseVoiceFilters", () => {
    it("refuses while a lease is held, so a filter in use is never dropped", () => {
        const a = acquireVoiceFilters();
        expect(releaseVoiceFilters()).toBe(false);
        for (const r of everyRelease()) expect(r).not.toHaveBeenCalled();
        a();
        // Back to zero: a direct call releases now and drops the pending
        // grace timer.
        expect(releaseVoiceFilters()).toBe(true);
        for (const r of everyRelease()) expect(r).toHaveBeenCalledTimes(1);
    });

    it("calls every module's release even when one throws", () => {
        releases.deep.mockImplementationOnce(() => {
            throw new Error("boom");
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(releaseVoiceFilters()).toBe(true);
        for (const r of everyRelease()) expect(r).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });

    it("cancels a pending grace release when called directly", () => {
        const a = acquireVoiceFilters();
        a();
        expect(releaseVoiceFilters()).toBe(true);
        for (const r of everyRelease()) expect(r).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(GRACE * 2);
        // Not a second release from the already-cancelled timer.
        for (const r of everyRelease()) expect(r).toHaveBeenCalledTimes(1);
    });
});
