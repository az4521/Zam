import { describe, it, expect } from "vitest";
import tailwindConfig from "../../../tailwind.config.js";

/**
 * `theme.extend.backgroundColor.zam` and `theme.extend.textColor.zam`
 * REPLACE the `zam` key for those two utility families — they do not merge
 * with `theme.extend.colors.zam`. Any key not restated there stops
 * resolving, and Tailwind emits no rule for it: `text-zam-textMuted` simply
 * produces nothing, the element keeps whatever it inherits, and `npm run build`
 * exits 0. That is rubric item 6, and it is the widest-blast-radius silent
 * change on this branch — dropping `...zamBrand` from `textColor.zam`
 * kills every `text-zam-*` class in the app with the whole suite green.
 *
 * The spread in tailwind.config.js is what prevents it. This asserts the
 * outcome of the spread (key-set parity) rather than its syntax, so refactoring
 * the config is free while silently narrowing the palette is not. Reading the
 * imported object, not the file text: a regex over the source would pass on a
 * spread that a typo had made a no-op.
 */
const config = tailwindConfig as unknown as {
    theme?: {
        extend?: Record<string, { zam?: Record<string, unknown> }>;
    };
};

function zamKeys(group: string): string[] {
    const map = config.theme?.extend?.[group]?.zam;
    if (!map || typeof map !== "object")
        throw new Error(
            `theme.extend.${group}.zam is missing from tailwind.config.js`,
        );
    return Object.keys(map);
}

describe("tailwind zam palette", () => {
    const brandKeys = zamKeys("colors");

    it("defines the brand palette", () => {
        // Count guard: an empty (or half-parsed) brand map would make every
        // subset check below pass vacuously.
        expect(
            brandKeys.length,
            "theme.extend.colors.zam is empty — the assertions below would pass on nothing",
        ).toBeGreaterThan(15);
        // Two keys with real usage that prove the override maps cannot be
        // trimmed to just accent/danger: `bg-zam-textPrimary` (14 sites)
        // and `text-zam-backgroundTertiary`.
        expect(brandKeys).toContain("textPrimary");
        expect(brandKeys).toContain("backgroundTertiary");
    });

    for (const group of ["backgroundColor", "textColor"]) {
        it(`${group}.zam restates every brand key`, () => {
            const keys = zamKeys(group);
            const missing = brandKeys.filter((k) => !keys.includes(k));
            expect(
                missing,
                `theme.extend.${group}.zam drops ${missing.join(", ")} — every \`${group === "textColor" ? "text" : "bg"}-zam-*\` class for those keys silently emits no rule, and the build still succeeds`,
            ).toEqual([]);
        });
    }
});
