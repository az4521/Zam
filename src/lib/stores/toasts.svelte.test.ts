import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toastsState, showErrorToast, dismissToast } from "./toasts.svelte";

describe("toasts with an optional action", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        toastsState.toasts = [];
    });
    afterEach(() => vi.useRealTimers());

    it("keeps the plain one-argument form working", () => {
        showErrorToast("plain");
        expect(toastsState.toasts).toHaveLength(1);
        expect(toastsState.toasts[0].message).toBe("plain");
        expect(toastsState.toasts[0].action).toBeUndefined();
    });

    it("carries a label and a callback when given one", () => {
        const run = vi.fn();
        showErrorToast("with action", { label: "Retry", run });
        expect(toastsState.toasts[0].action?.label).toBe("Retry");
        toastsState.toasts[0].action?.run();
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("hands back the caller's own callback, unwrapped by $state", () => {
        const run = vi.fn();
        showErrorToast("with action", { label: "Retry", run });
        // A $state deep proxy must not wrap the function value: the keyed
        // {#each} in ErrorToasts.svelte reads it straight off the toast.
        expect(toastsState.toasts[0].action?.run).toBe(run);
    });

    it("still auto-expires a plain toast", () => {
        showErrorToast("plain");
        vi.advanceTimersByTime(8000);
        expect(toastsState.toasts).toEqual([]);
    });

    it("still auto-expires an action toast", () => {
        showErrorToast("with action", { label: "Retry", run: () => {} });
        vi.advanceTimersByTime(8000);
        expect(toastsState.toasts).toEqual([]);
    });

    it("reassigns the array instead of mutating it in place", () => {
        // The keyed {#each} over $state depends on the reassignment.
        const before = toastsState.toasts;
        showErrorToast("a");
        expect(toastsState.toasts).not.toBe(before);
        expect(before).toHaveLength(0);
    });

    it("dismisses only the named toast", () => {
        showErrorToast("a");
        showErrorToast("b");
        dismissToast(toastsState.toasts[0].id);
        expect(toastsState.toasts.map((t) => t.message)).toEqual(["b"]);
    });

    it("gives every toast a distinct id", () => {
        showErrorToast("a");
        showErrorToast("b", { label: "Retry", run: () => {} });
        const [a, b] = toastsState.toasts;
        expect(a.id).not.toBe(b.id);
    });
});
