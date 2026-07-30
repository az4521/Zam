import { describe, it, expect, vi } from "vitest";
import {
    releaseSessionResources,
    type SessionResourceSteps,
} from "./sessionTeardown";

const NAMES: (keyof SessionResourceSteps)[] = [
    "leaveCall",
    "disposeSync",
    "stopClient",
    "clearServiceWorkerAuth",
    "unregisterPush",
    "clearNativeSession",
    "deleteCryptoStore",
];

/** Steps that record the order they ran in; `overrides` replaces a step. */
function recorder(overrides: Partial<SessionResourceSteps> = {}): {
    steps: SessionResourceSteps;
    ran: string[];
} {
    const ran: string[] = [];
    const steps = {} as SessionResourceSteps;
    for (const name of NAMES) {
        const override = overrides[name];
        steps[name] = () => {
            ran.push(name);
            return override?.();
        };
    }
    return { steps, ran };
}

describe("releaseSessionResources", () => {
    it("runs every step exactly once, in the safe order", () => {
        const { steps, ran } = recorder();
        releaseSessionResources(steps);
        expect(ran).toEqual([
            "leaveCall",
            "disposeSync",
            "stopClient",
            "clearServiceWorkerAuth",
            "unregisterPush",
            "clearNativeSession",
            "deleteCryptoStore",
        ]);
    });

    it("leaves the call before the client is stopped (audit LIFE-01)", () => {
        const { steps, ran } = recorder();
        releaseSessionResources(steps);
        expect(ran.indexOf("leaveCall")).toBeGreaterThanOrEqual(0);
        expect(ran.indexOf("leaveCall")).toBeLessThan(
            ran.indexOf("stopClient"),
        );
        expect(ran.indexOf("disposeSync")).toBeLessThan(
            ran.indexOf("stopClient"),
        );
    });

    it("keeps tearing down after a step throws", () => {
        const { steps, ran } = recorder({
            leaveCall: () => {
                throw new Error("no call to leave");
            },
        });
        expect(() => releaseSessionResources(steps)).not.toThrow();
        expect(ran).toHaveLength(NAMES.length);
        expect(ran).toContain("stopClient");
    });

    it("keeps tearing down when several steps throw", () => {
        const boom = () => {
            throw new Error("boom");
        };
        const { steps, ran } = recorder({
            leaveCall: boom,
            unregisterPush: boom,
            deleteCryptoStore: boom,
        });
        releaseSessionResources(steps);
        expect(ran).toHaveLength(NAMES.length);
    });

    it("swallows a rejected async step instead of leaking it", async () => {
        const { steps, ran } = recorder({
            clearNativeSession: () => Promise.reject(new Error("offline")),
        });
        releaseSessionResources(steps);
        expect(ran).toHaveLength(NAMES.length);
        // Flush microtasks: an unhandled rejection here would fail the run.
        await Promise.resolve();
        await Promise.resolve();
    });

    it("registers a rejection handler on an async step's promise", () => {
        // A real rejected promise only surfaces as a run-level unhandled
        // rejection, which no assertion can see — so stand a thenable in for
        // it and check the handler that swallows the rejection was attached,
        // and that it tolerates the reason it is handed.
        let onRejected: unknown;
        const { steps, ran } = recorder({
            clearNativeSession: () => ({
                then(_onFulfilled?: unknown, rejected?: unknown): void {
                    onRejected = rejected;
                },
            }),
        });
        releaseSessionResources(steps);
        expect(typeof onRejected).toBe("function");
        expect(() =>
            (onRejected as (reason: unknown) => void)(new Error("offline")),
        ).not.toThrow();
        expect(ran).toHaveLength(NAMES.length);
    });

    it("never awaits a step, so a hung request cannot block the return to login", () => {
        const { steps, ran } = recorder({
            unregisterPush: () => new Promise(() => {}),
        });
        const spy = vi.fn();
        releaseSessionResources(steps);
        spy();
        expect(ran).toHaveLength(NAMES.length);
        expect(spy).toHaveBeenCalled();
    });
});
