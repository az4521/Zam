/**
 * Anchoring a listbox cursor to the option it was actually placed on.
 *
 * `clampActiveIndex` rescues a cursor that has fallen OUT of range, which is
 * all a list needs if it only ever shrinks. It is not enough for a list that is
 * *replaced* or *reordered* underneath the user: index 3 of the new list is
 * still in range, so the cursor silently comes to rest on a different item,
 * `aria-activedescendant` keeps naming the same option id so nothing is
 * re-announced, and Enter activates something the user never arrowed to.
 *
 * The fix is to remember a stable key for the option the cursor was put on and
 * to refuse to call anything active unless that key is still sitting at that
 * index. When it is not, the answer is "nothing is active" — deliberately not
 * "wherever the anchored item moved to": a cursor that chases items around a
 * list rewriting itself is just as surprising as one that stays put on a
 * stranger, and re-entering with an arrow key costs one keystroke.
 */
import { clampActiveIndex } from "./listboxNavigation";

/**
 * The active index, but only while it still points at the anchored option.
 *
 * `keys` must be the identity of each rendered option, in render order —
 * whatever the component would act on if the user pressed Enter (a URL, an id).
 * Returns `-1` for "nothing active", the same convention as
 * `clampActiveIndex`/`nextActiveIndex`.
 */
export function anchoredActiveIndex(
    current: number,
    anchor: string | null,
    keys: readonly string[],
): number {
    // Not redundant with the key comparison below: a caller that derived its
    // anchor from an out-of-range lookup holds `undefined`, and without the
    // clamp `keys[99] === undefined` would report that stale cursor active.
    // The boundary that matters is `current === keys.length` -- one past the
    // end -- so the clamp has to be exclusive there, not merely generous.
    const index = clampActiveIndex(current, keys.length);
    if (index < 0) return -1;
    return keys[index] === anchor ? index : -1;
}
