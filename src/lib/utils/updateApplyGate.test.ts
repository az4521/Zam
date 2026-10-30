import { describe, expect, it } from "vitest";
import { canApplyUpdateNow } from "$lib/utils/updateApplyGate";
import { AUTO_AWAY_MS } from "$lib/utils/presence";

const quiet = {
    inCall: false,
    ringing: false,
    windowVisible: false,
    idleMs: 0,
};

describe("canApplyUpdateNow", () => {
    it("applies when the window is out of sight", () => {
        expect(canApplyUpdateNow(quiet)).toBe(true);
    });

    it("waits while the window is visible and the user is active", () => {
        expect(
            canApplyUpdateNow({ ...quiet, windowVisible: true, idleMs: 1000 }),
        ).toBe(false);
    });

    it("applies on a visible window once the user has been away long enough", () => {
        expect(
            canApplyUpdateNow({
                ...quiet,
                windowVisible: true,
                idleMs: AUTO_AWAY_MS,
            }),
        ).toBe(true);
        expect(
            canApplyUpdateNow({
                ...quiet,
                windowVisible: true,
                idleMs: AUTO_AWAY_MS - 1,
            }),
        ).toBe(false);
    });

    it("never applies in a call, however idle or hidden", () => {
        expect(canApplyUpdateNow({ ...quiet, inCall: true, idleMs: 1e9 })).toBe(
            false,
        );
    });

    it("never applies while a call is ringing", () => {
        expect(canApplyUpdateNow({ ...quiet, ringing: true })).toBe(false);
    });
});
