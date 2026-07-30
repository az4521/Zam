import { describe, expect, it } from "vitest";
import {
    nextResetPhase,
    resetPhaseView,
    RESET_PHASES,
    type ResetEvent,
    type ResetPhase,
} from "./recoveryReset";

const ALL_EVENTS: ResetEvent[] = [
    { type: "begin" },
    { type: "confirmed" },
    { type: "submit" },
    { type: "succeeded" },
    { type: "failed-before-destroy" },
    { type: "failed-after-destroy" },
    { type: "cancel" },
];

describe("nextResetPhase", () => {
    it("walks confirm → password → destroying", () => {
        expect(nextResetPhase("idle", { type: "begin" })).toBe("confirm");
        expect(nextResetPhase("confirm", { type: "confirmed" })).toBe(
            "password",
        );
        expect(nextResetPhase("password", { type: "submit" })).toBe(
            "destroying",
        );
    });

    it("lets the user back out before anything is destroyed", () => {
        expect(nextResetPhase("confirm", { type: "cancel" })).toBe("idle");
        expect(nextResetPhase("password", { type: "cancel" })).toBe("idle");
    });

    it("returns to the password step when the reset failed before destroying", () => {
        expect(
            nextResetPhase("destroying", { type: "failed-before-destroy" }),
        ).toBe("password");
    });

    it("enters repair when setup failed AFTER the destructive step", () => {
        expect(
            nextResetPhase("destroying", { type: "failed-after-destroy" }),
        ).toBe("repair");
    });

    it("finishes to idle on success from either phase", () => {
        expect(nextResetPhase("destroying", { type: "succeeded" })).toBe(
            "idle",
        );
        expect(nextResetPhase("repairing", { type: "succeeded" })).toBe("idle");
    });

    it("keeps a failed repair in repair — never back to a destructive step", () => {
        expect(nextResetPhase("repair", { type: "submit" })).toBe("repairing");
        expect(
            nextResetPhase("repairing", { type: "failed-before-destroy" }),
        ).toBe("repair");
        expect(
            nextResetPhase("repairing", { type: "failed-after-destroy" }),
        ).toBe("repair");
    });

    it("refuses to let the user walk away from an incomplete reset", () => {
        expect(nextResetPhase("repair", { type: "cancel" })).toBe("repair");
        expect(nextResetPhase("repairing", { type: "cancel" })).toBe(
            "repairing",
        );
    });

    it("cannot reach a destructive phase from repair by ANY event", () => {
        for (const from of ["repair", "repairing"] as ResetPhase[]) {
            for (const event of ALL_EVENTS) {
                const to = nextResetPhase(from, event);
                expect(
                    resetPhaseView(to).allowsDestroy,
                    `${from} + ${event.type} → ${to} must not allow destroy`,
                ).toBe(false);
            }
        }
    });

    it("ignores events that don't apply to the current phase", () => {
        expect(nextResetPhase("idle", { type: "submit" })).toBe("idle");
        expect(nextResetPhase("destroying", { type: "begin" })).toBe(
            "destroying",
        );
    });
});

describe("resetPhaseView", () => {
    it("allows the destructive call only from the password step", () => {
        const allowed = RESET_PHASES.filter(
            (p) => resetPhaseView(p).allowsDestroy,
        );
        expect(allowed).toEqual(["password"]);
    });

    it("allows the non-destructive repair only from repair", () => {
        const allowed = RESET_PHASES.filter(
            (p) => resetPhaseView(p).allowsRepair,
        );
        expect(allowed).toEqual(["repair"]);
    });

    it("marks the in-flight phases busy", () => {
        expect(resetPhaseView("destroying").busy).toBe(true);
        expect(resetPhaseView("repairing").busy).toBe(true);
        expect(resetPhaseView("password").busy).toBe(false);
    });

    it("blocks dismissal once the old recovery is gone", () => {
        expect(resetPhaseView("repair").blocking).toBe(true);
        expect(resetPhaseView("repairing").blocking).toBe(true);
        expect(resetPhaseView("confirm").blocking).toBe(false);
    });
});
