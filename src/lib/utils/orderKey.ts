/**
 * Pure, SDK-free, UI-free lexicographic fractional-index core for room ordering.
 *
 * Two order surfaces exist in Matrix:
 *  - `m.space.child` `order`: a printable-ASCII string (\x20–\x7E, length ≤ 50),
 *    compared LEXICOGRAPHICALLY by code point. `keyBetween` / `rebalancedKeys`.
 *  - `m.tag` `order`: spec'd as a number in [0,1], but foreign clients set
 *    arbitrary strings. `numberBetween` / `rebalancedNumbers` handle the numeric
 *    half; `compareOrder` is the never-throwing comparator used for display sort.
 *
 * Nothing here touches matrix-js-sdk or the DOM.
 */

export const ORDER_MIN_CHAR = 0x20; // ' '
export const ORDER_MAX_CHAR = 0x7e; // '~'
export const ORDER_MAX_LEN = 50;

/** Thrown when an order value cannot be produced and the caller must rebalance. */
export class OrderRebalanceError extends Error {
    constructor(message = "order rebalance required") {
        super(message);
        this.name = "OrderRebalanceError";
    }
}

// ---------------------------------------------------------------------------
// Raw-value validators (for user-typed order editors)
// ---------------------------------------------------------------------------

/**
 * True when `v` is a spec-legal `m.tag` order: a finite number in `[0, 1]`.
 * Used to gate raw, user-supplied tag-order input before it is written.
 */
export function isValidTagOrder(v: number): boolean {
    return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
}

/**
 * True when `s` is a spec-legal `m.space.child` `order`: at most
 * `ORDER_MAX_LEN` characters, every one printable ASCII (`\x20`–`\x7E`).
 * The empty string is valid (it clears the order). Used to gate raw,
 * user-supplied child-order input before it is written.
 */
export function isValidChildOrder(s: string): boolean {
    if (typeof s !== "string") return false;
    if (s.length > ORDER_MAX_LEN) return false;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        if (c < ORDER_MIN_CHAR || c > ORDER_MAX_CHAR) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// compareOrder
// ---------------------------------------------------------------------------

/** A value is "missing" if it is null/undefined/empty or not a string/number. */
function isMissing(v: unknown): boolean {
    if (v === null || v === undefined || v === "") return true;
    return typeof v !== "string" && typeof v !== "number";
}

/**
 * The finite numeric value of a present order, or `null` when it is non-numeric.
 * A whitespace-only string is non-numeric (guard against `Number("  ") === 0`).
 */
function numericValue(v: string | number): number | null {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}

/**
 * Never-throwing comparator for order values (`m.tag` order or anything else).
 *
 * - Missing values (null/undefined/""/non-string-non-number) sort LAST; two
 *   missings are equal.
 * - Both numeric → numeric compare (so `"10" > "2"`).
 * - Both non-numeric → code-point compare of the raw string form.
 * - Mixed → numeric sorts before non-numeric.
 */
export function compareOrder(x: unknown, y: unknown): number {
    const xMissing = isMissing(x);
    const yMissing = isMissing(y);
    if (xMissing && yMissing) return 0;
    if (xMissing) return 1;
    if (yMissing) return -1;

    // Both present: safe to treat as string | number.
    const xv = x as string | number;
    const yv = y as string | number;
    const nx = numericValue(xv);
    const ny = numericValue(yv);
    const xNumeric = nx !== null;
    const yNumeric = ny !== null;

    if (xNumeric && yNumeric) {
        return nx! < ny! ? -1 : nx! > ny! ? 1 : 0;
    }
    if (xNumeric) return -1; // numeric before non-numeric
    if (yNumeric) return 1;

    const sx = String(xv);
    const sy = String(yv);
    return sx < sy ? -1 : sx > sy ? 1 : 0;
}

/**
 * Comparator for m.space.child `order`, which the Matrix spec sorts PURE
 * lexicographically by Unicode code point (NOT numeric-aware — that is
 * compareOrder, for m.tag). Missing (null/undefined/""/non-string) sorts LAST;
 * two missings compare equal. Never throws. Matches keyBetween/rebalancedKeys
 * generation and the homeserver sort.
 */
export function compareOrderLex(x: unknown, y: unknown): number {
    const xMissing = typeof x !== "string" || x === "";
    const yMissing = typeof y !== "string" || y === "";
    if (xMissing && yMissing) return 0;
    if (xMissing) return 1; // missing sorts after a present value
    if (yMissing) return -1;

    // Both present strings: compare raw by code point (no numeric parsing).
    return x < y ? -1 : x > y ? 1 : 0;
}

// ---------------------------------------------------------------------------
// keyBetween / rebalancedKeys (lexicographic string keys)
// ---------------------------------------------------------------------------

function clampCode(code: number): number {
    if (code < ORDER_MIN_CHAR) return ORDER_MIN_CHAR;
    if (code > ORDER_MAX_CHAR) return ORDER_MAX_CHAR;
    return code;
}

/**
 * A key that sorts strictly between `a` and `b` by code point, drawn from the
 * printable-ASCII digit range. `null` = open end (head when `a`, tail when `b`).
 *
 * Throws `OrderRebalanceError` when neighbours collide / are out of order
 * (code-point compare), when no key sorts strictly between them (e.g. `b` is the
 * floor-valued successor of `a`, or out-of-range chars clamp to the same bound),
 * or when the required key would exceed `ORDER_MAX_LEN`. Robust to arbitrary
 * neighbour strings otherwise — out-of-range chars are clamped for the walk.
 */
export function keyBetween(a: string | null, b: string | null): string {
    if (a === null && b === null) return "U";

    // Guard by CODE POINT (keyBetween deals only in strings): equal or
    // descending non-null neighbours cannot bracket a strict-between key.
    if (a !== null && b !== null && !(a < b)) {
        throw new OrderRebalanceError("order keys collide or are out of order");
    }

    let prefix = "";
    let key = "";
    let i = 0;
    for (;;) {
        if (prefix.length >= ORDER_MAX_LEN) {
            throw new OrderRebalanceError("order key exceeds max length");
        }
        const ca =
            a !== null && i < a.length
                ? clampCode(a.charCodeAt(i))
                : ORDER_MIN_CHAR;
        const cb =
            b !== null && i < b.length
                ? clampCode(b.charCodeAt(i))
                : ORDER_MAX_CHAR;

        if (cb - ca > 1) {
            const mid = Math.floor((ca + cb) / 2);
            key = prefix + String.fromCharCode(mid);
            break;
        }
        // Adjacent or equal at this position: fix the floor digit and descend.
        prefix += String.fromCharCode(ca);
        i += 1;
    }

    // Mandatory post-condition backstop: the produced key MUST be strictly
    // between `a` and `b` by CODE POINT. When `a` is exhausted/floored against a
    // floor-valued `b`, or when out-of-range chars clamp to the same bound, the
    // walk can fabricate a key past the boundary (raw vs clamped disagree). Turn
    // every "no representable key exists" case into a rebalance signal rather
    // than silently corrupting the order.
    if ((a !== null && !(a < key)) || (b !== null && !(key < b))) {
        throw new OrderRebalanceError("no order key fits between neighbours");
    }

    return key;
}

/**
 * `n` strictly-increasing, spec-legal keys spread evenly across the digit range,
 * for rebalancing a whole section. Widens to multi-char keys when `n` exceeds
 * the single-char capacity. `0 → []`.
 */
export function rebalancedKeys(n: number): string[] {
    if (n <= 0) return [];

    const digits = ORDER_MAX_CHAR - ORDER_MIN_CHAR + 1; // 95
    let width = 1;
    let capacity = digits;
    while (capacity < n + 1) {
        width += 1;
        capacity *= digits;
    }

    const encode = (value: number): string => {
        let v = value;
        let s = "";
        for (let k = 0; k < width; k++) {
            const d = v % digits;
            s = String.fromCharCode(ORDER_MIN_CHAR + d) + s;
            v = Math.floor(v / digits);
        }
        return s;
    };

    const out: string[] = [];
    let prev = -1;
    for (let i = 0; i < n; i++) {
        // Interior slots (i+1)/(n+1) leave head/tail room; bump on any rounding
        // collision and clamp to keep values strictly increasing and in range.
        let value = Math.round(((i + 1) * capacity) / (n + 1));
        if (value <= prev) value = prev + 1;
        if (value > capacity - 1) value = capacity - 1;
        prev = value;
        out.push(encode(value));
    }
    return out;
}

// ---------------------------------------------------------------------------
// numberBetween / rebalancedNumbers (m.tag numeric orders)
// ---------------------------------------------------------------------------

/**
 * A numeric `m.tag` order strictly between `before` and `after`, both in [0,1].
 * `null` = open end (head → `(0, after)`, tail → `(before, 1)`).
 *
 * Throws `OrderRebalanceError` when a bound is non-finite (`NaN`/`±Infinity`),
 * when `before >= after`, or when double precision is exhausted (the midpoint is
 * not strictly between the bounds).
 */
export function numberBetween(
    before: number | null,
    after: number | null,
): number {
    if (before === null && after === null) return 0.5;

    // A non-finite bound (NaN/±Infinity) can never bracket a meaningful midpoint
    // — reject it up front rather than propagate NaN through the arithmetic.
    if (
        (before !== null && !Number.isFinite(before)) ||
        (after !== null && !Number.isFinite(after))
    ) {
        throw new OrderRebalanceError("numeric order bounds must be finite");
    }

    if (before === null) {
        const mid = after! / 2;
        if (!(mid > 0 && mid < after!)) {
            throw new OrderRebalanceError("numeric order precision exhausted");
        }
        return mid;
    }

    if (after === null) {
        const mid = (before + 1) / 2;
        if (!(mid > before && mid < 1)) {
            throw new OrderRebalanceError("numeric order precision exhausted");
        }
        return mid;
    }

    if (before >= after) {
        throw new OrderRebalanceError(
            "numeric orders collide or are out of order",
        );
    }
    const mid = (before + after) / 2;
    if (mid <= before || mid >= after) {
        throw new OrderRebalanceError("numeric order precision exhausted");
    }
    return mid;
}

/**
 * `n` strictly-increasing, symmetric `m.tag` orders in (0,1) — `o[i] = (i+1)/(n+1)`
 * so `o[i] + o[n-1-i] === 1`. `0 → []`, `1 → [0.5]`.
 */
export function rebalancedNumbers(n: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
        out.push((i + 1) / (n + 1));
    }
    return out;
}
