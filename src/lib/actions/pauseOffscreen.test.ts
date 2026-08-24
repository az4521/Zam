import { describe, it, expect } from "vitest";
import { shouldPauseVideo } from "./pauseOffscreen";

describe("shouldPauseVideo — pause only a playing video that left the viewport", () => {
    it("pauses a playing video that is off-screen", () => {
        expect(
            shouldPauseVideo({
                isIntersecting: false,
                paused: false,
                ended: false,
            }),
        ).toBe(true);
    });

    it("leaves a playing video alone while it is still visible", () => {
        expect(
            shouldPauseVideo({
                isIntersecting: true,
                paused: false,
                ended: false,
            }),
        ).toBe(false);
    });

    it("does not touch an already-paused off-screen video (never fights the user, never auto-resumes)", () => {
        expect(
            shouldPauseVideo({
                isIntersecting: false,
                paused: true,
                ended: false,
            }),
        ).toBe(false);
    });

    it("does not touch a finished off-screen video", () => {
        expect(
            shouldPauseVideo({
                isIntersecting: false,
                paused: false,
                ended: true,
            }),
        ).toBe(false);
    });

    it("does not act on a paused visible video", () => {
        expect(
            shouldPauseVideo({
                isIntersecting: true,
                paused: true,
                ended: false,
            }),
        ).toBe(false);
    });
});
