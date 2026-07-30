import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, unmount, flushSync } from "svelte";
import ErrorToasts from "./ErrorToasts.svelte";
import { toastsState, showErrorToast } from "$lib/stores/toasts.svelte";

// Mounted with Svelte 5's own `mount()` — no testing-library dependency.
function render() {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const component = mount(ErrorToasts, { target });
    flushSync();
    return {
        target,
        destroy: () => {
            unmount(component);
            target.remove();
        },
    };
}

describe("ErrorToasts action button", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        toastsState.toasts = [];
    });
    afterEach(() => {
        toastsState.toasts = [];
        vi.useRealTimers();
    });

    it("renders no action button for a plain toast", () => {
        showErrorToast("plain");
        const { target, destroy } = render();
        flushSync();
        expect(target.querySelector('[role="alert"]')).not.toBeNull();
        expect(
            target.querySelector('button[aria-label="Dismiss"]'),
        ).not.toBeNull();
        // Only the dismiss button.
        expect(target.querySelectorAll("button")).toHaveLength(1);
        destroy();
    });

    it("renders the action label and runs the callback exactly once", () => {
        const run = vi.fn();
        showErrorToast("boom", { label: "Retry", run });
        const { target, destroy } = render();
        flushSync();

        const buttons = [...target.querySelectorAll("button")];
        const actionButton = buttons.find(
            (b) => b.textContent?.trim() === "Retry",
        );
        expect(actionButton).toBeDefined();

        actionButton!.click();
        flushSync();

        expect(run).toHaveBeenCalledTimes(1);
        // Clicking the action also dismisses the toast it belonged to.
        expect(toastsState.toasts).toEqual([]);
        destroy();
    });

    it("dismisses without running the action when the X is clicked", () => {
        const run = vi.fn();
        showErrorToast("boom", { label: "Retry", run });
        const { target, destroy } = render();
        flushSync();

        target
            .querySelector<HTMLButtonElement>('button[aria-label="Dismiss"]')!
            .click();
        flushSync();

        expect(run).not.toHaveBeenCalled();
        expect(toastsState.toasts).toEqual([]);
        destroy();
    });

    it("renders plain and action toasts side by side in order", () => {
        // Seeded before mount: jsdom has no Element.animate, so the fly
        // transition must not run (intros are skipped on initial mount).
        showErrorToast("first");
        showErrorToast("second", { label: "Retry", run: () => {} });
        const { target, destroy } = render();
        flushSync();

        const alerts = [...target.querySelectorAll('[role="alert"]')];
        expect(alerts.map((a) => a.querySelector("span")?.textContent)).toEqual(
            ["first", "second"],
        );
        // Plain toast: dismiss only. Action toast: Retry + dismiss.
        expect(alerts[0].querySelectorAll("button")).toHaveLength(1);
        expect(alerts[1].querySelectorAll("button")).toHaveLength(2);
        destroy();
    });
});
