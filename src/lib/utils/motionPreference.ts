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
 *
 * The effective decision (`reducedMotionActive` / `motionOK`) also OR-s in the
 * in-app "Reduce motion" toggle (`settingsState.reduceMotion`) so the user can
 * force reduction even when the OS asks for none; the OS query still wins on its
 * own. The declarative CSS half of the toggle lives in `app.css` under
 * `:root[data-reduce-motion="true"]`, applied via `applyReduceMotion` (theme.ts).
 */
import { settingsState } from "$lib/stores/settings.svelte";

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
 * Effective reduced-motion decision: active when EITHER the in-app toggle asks
 * for it OR the OS `prefers-reduced-motion` query does. The toggle can only ADD
 * reduction — a user with the OS preference always gets reduced motion, no
 * matter the toggle. Pure so it is unit-testable in isolation.
 */
export function resolveReducedMotion(
    reduceMotionSetting: boolean,
    osReducedMotion: boolean,
): boolean {
    return reduceMotionSetting || osReducedMotion;
}

/** Live reduced-motion state = the app toggle OR the OS query. */
export function reducedMotionActive(): boolean {
    return resolveReducedMotion(
        settingsState.reduceMotion,
        prefersReducedMotion(),
    );
}

/**
 * Positive gate for callers that animate (e.g. a `transition:` duration).
 * `motionOK() ? 150 : 0`. The inverse of reducedMotionActive().
 */
export function motionOK(): boolean {
    return !reducedMotionActive();
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
    return reducedMotionActive() ? "auto" : "smooth";
}
