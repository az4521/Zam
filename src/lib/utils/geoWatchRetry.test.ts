import { describe, it, expect } from "vitest";
import {
    planWatchRestart,
    GEO_WATCH_ERROR_THRESHOLD,
    GEO_WATCH_RETRY_BASE_MS,
    GEO_WATCH_RETRY_MAX_MS,
    GEO_WATCH_RETRY_MAX_ATTEMPTS,
} from "./geoWatchRetry";

describe("planWatchRestart", () => {
    it("does nothing for a routine blip below the error threshold", () => {
        expect(planWatchRestart(0, 0)).toBeNull();
        expect(planWatchRestart(GEO_WATCH_ERROR_THRESHOLD - 1, 0)).toBeNull();
    });

    it("schedules the first restart at the base delay once the watch has dropped", () => {
        expect(planWatchRestart(GEO_WATCH_ERROR_THRESHOLD, 0)).toBe(
            GEO_WATCH_RETRY_BASE_MS,
        );
        // More errors past the threshold do not change the (first) backoff.
        expect(planWatchRestart(GEO_WATCH_ERROR_THRESHOLD + 5, 0)).toBe(
            GEO_WATCH_RETRY_BASE_MS,
        );
    });

    it("doubles the backoff for each prior restart", () => {
        expect(planWatchRestart(GEO_WATCH_ERROR_THRESHOLD, 1)).toBe(
            GEO_WATCH_RETRY_BASE_MS * 2,
        );
        expect(planWatchRestart(GEO_WATCH_ERROR_THRESHOLD, 2)).toBe(
            GEO_WATCH_RETRY_BASE_MS * 4,
        );
        expect(planWatchRestart(GEO_WATCH_ERROR_THRESHOLD, 3)).toBe(
            GEO_WATCH_RETRY_BASE_MS * 8,
        );
    });

    it("caps the backoff at the ceiling", () => {
        // A high attempt whose exponential would exceed the ceiling is clamped.
        expect(
            planWatchRestart(
                GEO_WATCH_ERROR_THRESHOLD,
                GEO_WATCH_RETRY_MAX_ATTEMPTS - 1,
            ),
        ).toBe(GEO_WATCH_RETRY_MAX_MS);
    });

    it("gives up (returns null) once the attempt cap is reached", () => {
        expect(
            planWatchRestart(
                GEO_WATCH_ERROR_THRESHOLD,
                GEO_WATCH_RETRY_MAX_ATTEMPTS,
            ),
        ).toBeNull();
        expect(
            planWatchRestart(
                GEO_WATCH_ERROR_THRESHOLD,
                GEO_WATCH_RETRY_MAX_ATTEMPTS + 3,
            ),
        ).toBeNull();
    });

    it("rejects garbage inputs rather than scheduling a bogus restart", () => {
        expect(planWatchRestart(Number.NaN, 0)).toBeNull();
        expect(
            planWatchRestart(GEO_WATCH_ERROR_THRESHOLD, Number.NaN),
        ).toBeNull();
        expect(planWatchRestart(Number.POSITIVE_INFINITY, 0)).toBeNull();
        expect(planWatchRestart(GEO_WATCH_ERROR_THRESHOLD, -1)).toBeNull();
    });

    it("honours a custom threshold, base, ceiling and cap", () => {
        // Threshold of 1 fires on the first error.
        expect(planWatchRestart(1, 0, { errorThreshold: 1 })).toBe(
            GEO_WATCH_RETRY_BASE_MS,
        );
        // Custom base + ceiling.
        expect(
            planWatchRestart(1, 3, {
                errorThreshold: 1,
                baseMs: 1000,
                maxMs: 5000,
            }),
        ).toBe(5000); // 1000 * 2^3 = 8000, clamped to 5000
        // Custom cap.
        expect(
            planWatchRestart(1, 2, { errorThreshold: 1, maxAttempts: 2 }),
        ).toBeNull();
    });

    it("exports sane defaults", () => {
        expect(GEO_WATCH_ERROR_THRESHOLD).toBeGreaterThanOrEqual(1);
        expect(GEO_WATCH_RETRY_BASE_MS).toBeGreaterThan(0);
        expect(GEO_WATCH_RETRY_MAX_MS).toBeGreaterThanOrEqual(
            GEO_WATCH_RETRY_BASE_MS,
        );
        expect(GEO_WATCH_RETRY_MAX_ATTEMPTS).toBeGreaterThanOrEqual(1);
    });
});
