import { describe, it, expect } from "vitest";
import {
    IDLE_SESSION_STARTUP,
    isLiveAttempt,
    reduceSessionStartup,
    type SessionStartupState,
} from "./sessionStartup";

const EXPIRED = "Your session has expired. Please sign in again.";
const FAILED = "Failed to reconnect. Please log in again.";

function starting(): SessionStartupState {
    return reduceSessionStartup(IDLE_SESSION_STARTUP, { type: "begin" });
}

describe("reduceSessionStartup", () => {
    it("opens an attempt with a fresh monotonic id", () => {
        const state = starting();
        expect(state.phase).toBe("starting");
        expect(state.attempt).toBe(1);
        expect(state.error).toBeNull();
    });

    it("mints a new id for every attempt and clears a previous error", () => {
        const failed = reduceSessionStartup(starting(), {
            type: "failed",
            attempt: 1,
            error: FAILED,
        });
        const next = reduceSessionStartup(failed, { type: "begin" });
        expect(next.attempt).toBe(2);
        expect(next.phase).toBe("starting");
        expect(next.error).toBeNull();
    });

    it("activates the session when the live attempt succeeds", () => {
        const state = reduceSessionStartup(starting(), {
            type: "succeeded",
            attempt: 1,
        });
        expect(state.phase).toBe("active");
        expect(state.attempt).toBe(1);
        expect(state.error).toBeNull();
    });

    it("ignores a success from an attempt that is not the live one", () => {
        const state = starting();
        expect(
            reduceSessionStartup(state, { type: "succeeded", attempt: 0 }),
        ).toBe(state);
    });

    it("drops a startup that finishes after the session expired", () => {
        const expired = reduceSessionStartup(starting(), {
            type: "invalidated",
            error: EXPIRED,
        });
        expect(expired.phase).toBe("failed");
        expect(expired.attempt).toBe(2);
        // The in-flight attempt 1 resolves late — it must not resurrect it.
        const late = reduceSessionStartup(expired, {
            type: "succeeded",
            attempt: 1,
        });
        expect(late).toBe(expired);
        expect(late.error).toBe(EXPIRED);
    });

    it("records a failure from the live attempt", () => {
        const state = reduceSessionStartup(starting(), {
            type: "failed",
            attempt: 1,
            error: FAILED,
        });
        expect(state.phase).toBe("failed");
        expect(state.error).toBe(FAILED);
    });

    it("does not let a stale failure overwrite the expiry message", () => {
        const expired = reduceSessionStartup(starting(), {
            type: "invalidated",
            error: EXPIRED,
        });
        expect(
            reduceSessionStartup(expired, {
                type: "failed",
                attempt: 1,
                error: FAILED,
            }),
        ).toBe(expired);
    });

    it("invalidates a session that was already active", () => {
        const active = reduceSessionStartup(starting(), {
            type: "succeeded",
            attempt: 1,
        });
        const expired = reduceSessionStartup(active, {
            type: "invalidated",
            error: EXPIRED,
        });
        expect(expired.phase).toBe("failed");
        expect(expired.attempt).toBe(2);
        expect(expired.error).toBe(EXPIRED);
    });

    it("supersedes an attempt that is still starting with a new id", () => {
        // Double sign-in: the second submit opens attempt 2 while attempt 1 is
        // still in flight, so the two must not share an id.
        const first = starting();
        const second = reduceSessionStartup(first, { type: "begin" });
        expect(second.phase).toBe("starting");
        expect(second.attempt).toBe(2);
        // Attempt 1 finishing late must not commit over the newer attempt…
        expect(
            reduceSessionStartup(second, { type: "succeeded", attempt: 1 }),
        ).toBe(second);
        // …while attempt 2 still activates normally.
        const active = reduceSessionStartup(second, {
            type: "succeeded",
            attempt: 2,
        });
        expect(active.phase).toBe("active");
        expect(active.attempt).toBe(2);
    });

    it("never reuses an attempt id across expiry and restart", () => {
        const expired = reduceSessionStartup(starting(), {
            type: "invalidated",
            error: EXPIRED,
        });
        expect(reduceSessionStartup(expired, { type: "begin" }).attempt).toBe(
            3,
        );
    });
});

describe("isLiveAttempt", () => {
    it("is true only for the attempt currently starting", () => {
        const state = starting();
        expect(isLiveAttempt(state, 1)).toBe(true);
        expect(isLiveAttempt(state, 2)).toBe(false);
    });

    it("is false once the attempt committed, so it cannot commit twice", () => {
        const active = reduceSessionStartup(starting(), {
            type: "succeeded",
            attempt: 1,
        });
        expect(isLiveAttempt(active, 1)).toBe(false);
    });

    it("is false for the idle state", () => {
        expect(isLiveAttempt(IDLE_SESSION_STARTUP, 0)).toBe(false);
    });
});
