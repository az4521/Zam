import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    releaseSessionResources,
    TEARDOWN_ORDER,
    type SessionResourceSteps,
} from "./sessionTeardown";

/**
 * Taken from the module rather than re-listed, so this file cannot drift from
 * the real order; the EXPECTED order is spelled out literally in the first
 * test, which is where the assertion belongs.
 */
const NAMES: readonly (keyof SessionResourceSteps)[] = TEARDOWN_ORDER;

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
            clearNativeSession: boom,
        });
        releaseSessionResources(steps);
        expect(ran).toHaveLength(NAMES.length);
    });

    it("swallows a rejected async step instead of leaking it", async () => {
        // Reject from a step with others QUEUED BEHIND IT, so the length
        // assertion below proves they still ran. The last step would satisfy
        // it for free.
        const { steps, ran } = recorder({
            clearServiceWorkerAuth: () => Promise.reject(new Error("offline")),
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
        releaseSessionResources(steps);
        // Returning at all is half the point; the other half is that the
        // steps queued behind the hung one still ran.
        expect(ran).toHaveLength(NAMES.length);
    });
});

/**
 * A POLICY pin, not a mechanism one — the user settled this on 2026-07-30 and
 * the whole point of the item is that it stays settled: an expired session
 * KEEPS its crypto store, and only an explicit sign-out wipes it (which it
 * still does, via `client.clearStores({ cryptoDatabasePrefix })` in
 * `logout()`). A single `M_UNKNOWN_TOKEN` — a password changed on another
 * client, this device deleted elsewhere, a server hiccup — must not destroy
 * key material that nothing can bring back.
 *
 * These assertions are cheap and dull on purpose: re-adding the wipe is a
 * decision the user has already made once, so making it should cost a red
 * test rather than pass as tidying up.
 */
describe("session expiry keeps the crypto store (user decision, 2026-07-30)", () => {
    it("runs no crypto-store wipe among the teardown steps", () => {
        // Not just the old name: any step that wipes crypto would re-open this.
        expect(TEARDOWN_ORDER.filter((n) => /crypto/i.test(n))).toEqual([]);
    });

    it("leaves the expiry handler with nothing that deletes the store", () => {
        // `handleSessionExpired` lives in a route component with no test
        // harness, and it could re-acquire the wipe WITHOUT going through the
        // typed step list above — so read the source. This catches the three
        // ways that file could reach a wipe today: the helper by any import
        // name, a raw IndexedDB delete, and the SDK's own store clear. It is
        // not a proof of absence — a future fourth way would slip past — but
        // every route that exists now costs a red test. Prose counts, so if
        // you need to NAME these APIs, name them in `sessionTeardown.ts`, not
        // in the route: a comment reinforcing the policy would fail this.
        //
        // NB: resolve via dirname(), not `new URL("…", import.meta.url)` —
        // Vite rewrites that literal pattern into an *asset* reference
        // ("http://localhost:3000/src/routes/+page.svelte"), and fileURLToPath
        // then throws "The URL must be of scheme file" (same trap as
        // themeParity.test.ts). Not process.cwd() either: a policy pin must
        // fail for policy reasons, not because vitest was invoked elsewhere.
        const page = readFileSync(
            resolve(
                dirname(fileURLToPath(import.meta.url)),
                "../../routes/+page.svelte",
            ),
            "utf8",
        );
        expect(page).not.toContain("deleteCryptoStore");
        expect(page).not.toMatch(/deleteDatabase|clearStores/);
    });
});
