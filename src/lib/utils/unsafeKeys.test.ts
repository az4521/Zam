import { describe, it, expect } from "vitest";
import { isUnsafeKey } from "./unsafeKeys";
import { addToMDirect } from "./mDirect";
import { sanitizeCustomization } from "./customization";

describe("isUnsafeKey", () => {
    it("flags prototype-shaped keys and nothing else", () => {
        expect(isUnsafeKey("__proto__")).toBe(true);
        expect(isUnsafeKey("constructor")).toBe(true);
        expect(isUnsafeKey("prototype")).toBe(true);
        expect(isUnsafeKey("!room:example.org")).toBe(false);
        expect(isUnsafeKey("@alice:example.org")).toBe(false);
    });

    it("keeps a remote __proto__ key out of parsed account data", () => {
        // JSON.parse keeps "__proto__" as an own property, as a remote would send it.
        const hostile = JSON.parse(
            '{"__proto__": {"polluted": true}, "@a:x": ["!r:x"]}',
        ) as Record<string, string[]>;
        const out = addToMDirect(hostile, "@b:x", "!s:x");
        expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        expect(Object.keys(out)).toEqual(["@a:x", "@b:x"]);
        expect(
            sanitizeCustomization({
                themePresets: JSON.parse(
                    '{"__proto__": {"base": "dark", "colors": {}}, "good": {"base": "dark", "colors": {}}}',
                ),
            }).themePresets,
        ).toEqual({ good: { base: "dark", colors: expect.any(Object) } });
    });
});
