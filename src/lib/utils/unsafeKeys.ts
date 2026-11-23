/**
 * Keys that must never be copied into a plain object built from remote JSON.
 * Assigning `obj["__proto__"] = v` rewrites the object's prototype instead of
 * adding a property, and `constructor` / `prototype` shadow built-ins, so a
 * homeserver-supplied account-data key with one of these names could corrupt
 * the parsed result. Parsers skip them.
 */
const UNSAFE_KEYS: ReadonlySet<string> = new Set([
    "__proto__",
    "constructor",
    "prototype",
]);

export function isUnsafeKey(key: string): boolean {
    return UNSAFE_KEYS.has(key);
}
