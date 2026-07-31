/**
 * Single source of truth for the user's `prefers-reduced-motion` setting.
 *
 * CSS handles declarative animation via the media block in `src/app.css`;
 * this module exists for the *programmatic* half — `scrollTo`/`scrollIntoView`
 * calls pass `behavior: "smooth"`, which CSS cannot override.
 *
 * Deliberately un-memoised and un-subscribed: every caller is an event handler
 * that runs at interaction time, so reading the live value costs one cheap
 * `matchMedia` call and picks up a mid-session preference change for free.
 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
    // Guarded for SSR/prerender (no `window`) and for the jsdom default,
    // where `matchMedia` is not implemented. Both mean "no stated
    // preference", which is `false` — never assume reduced.
    try {
        if (typeof matchMedia !== "function") return false;
        return matchMedia(REDUCED_MOTION_QUERY).matches === true;
    } catch {
        return false;
    }
}

/**
 * The `behavior` to hand a `scrollTo`/`scrollIntoView` call.
 * Only ever downgrades: an explicit `"instant"`/`"auto"` caller is honoured
 * as-is, because those callers are correcting position, not animating.
 */
export function scrollBehavior(
    preferred: ScrollBehavior = "smooth",
): ScrollBehavior {
    if (preferred !== "smooth") return preferred;
    return prefersReducedMotion() ? "auto" : "smooth";
}
