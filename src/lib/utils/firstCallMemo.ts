/**
 * Make a method's FIRST call reuse a request that was started earlier.
 *
 * The caller starts `early` before the method is needed (so its round trip
 * overlaps other startup work) and installs the wrapper in place of the method.
 * The first call then waits on `early` and returns its value; if `early`
 * rejected, that call falls through to `original` instead. Every later call
 * goes straight to `original`. Pure: no SDK imports.
 */
export function firstCallWrapper<A extends unknown[], R>(
    original: (...args: A) => Promise<R>,
    early: Promise<R>,
): (...args: A) => Promise<R> {
    // Nothing may surface as an unhandled rejection if the wrapper is never
    // called (e.g. the session ends first); a real call still sees the failure
    // through the fall-through below.
    early.catch(() => {});
    let spent = false;
    return (...args: A) => {
        if (spent) return original(...args);
        spent = true;
        return early.then(
            (value) => value,
            () => original(...args),
        );
    };
}
