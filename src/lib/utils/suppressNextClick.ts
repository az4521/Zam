/**
 * Swallow the next `click` after an autocomplete picker commits on
 * `pointerdown`.
 *
 * The composer's mention / slash / emoji pickers each commit their selection in
 * a `pointerdown` handler and then unmount the picker (they set their query
 * state to `null`). That unmount happens BEFORE `pointerup`, so the browser
 * retargets the trailing `click` to whatever element is now under the cursor —
 * typically a link in a timeline message behind or below the picker — and
 * opens it. Calling `preventDefault()` on the `pointerdown` does NOT suppress
 * that retargeted click.
 *
 * `suppressNextClick()` arms a one-shot capture-phase listener that cancels the
 * next `click` (preventDefault + stopPropagation) and then disposes itself, so
 * the gesture that picked a suggestion never activates the element behind it.
 * A capture-phase listener on `window` is the first listener invoked for any
 * dispatched click, so it wins before the target's own handlers run.
 */

export type Disposer = () => void;

export interface SuppressNextClickOptions {
    /** Event target to guard. Defaults to `window`. */
    target?: EventTarget;
    /**
     * Auto-dispose after this many milliseconds if no click arrives, so a stray
     * armed guard (e.g. the pointer was released off-target and no click fired)
     * never swallows an unrelated later click. Set to `0` to disable. Default
     * 1000.
     */
    timeoutMs?: number;
}

/**
 * Arm a one-shot capture-phase click guard.
 *
 * @returns a disposer that cancels the arming early (e.g. on teardown). Calling
 * it after the guard has already fired or been disposed is a safe no-op.
 */
export function suppressNextClick(
    options: SuppressNextClickOptions = {},
): Disposer {
    const target: EventTarget =
        options.target ?? (typeof window !== "undefined" ? window : undefined!);
    const timeoutMs = options.timeoutMs ?? 1000;

    // No DOM to guard (SSR / non-browser): return an inert disposer.
    if (!target || typeof target.addEventListener !== "function") {
        return () => {};
    }

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function dispose(): void {
        if (disposed) return;
        disposed = true;
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
        }
        target.removeEventListener("click", onClick, true);
    }

    function onClick(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        dispose();
    }

    target.addEventListener("click", onClick, true);

    if (timeoutMs > 0 && typeof setTimeout === "function") {
        timer = setTimeout(dispose, timeoutMs);
    }

    return dispose;
}
