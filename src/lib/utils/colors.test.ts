import { describe, it, expect } from "vitest";
import { getAvatarInitials, getAvatarColor, AVATAR_PALETTE } from "./colors";

describe("getAvatarInitials", () => {
    it("returns '?' for null, undefined, and empty string", () => {
        expect(getAvatarInitials(null)).toBe("?");
        expect(getAvatarInitials(undefined)).toBe("?");
        expect(getAvatarInitials("")).toBe("?");
        expect(getAvatarInitials("   ")).toBe("?");
    });

    it("extracts first letter from single word", () => {
        expect(getAvatarInitials("Alice")).toBe("A");
        expect(getAvatarInitials("bob")).toBe("B");
    });

    it("extracts first and last initials from multi-word names", () => {
        expect(getAvatarInitials("Alice Smith")).toBe("AS");
        expect(getAvatarInitials("Bob van der Berg")).toBe("BB");
        expect(getAvatarInitials("a b c d e")).toBe("AE");
    });

    it("strips @ prefix from Matrix IDs before extracting initials", () => {
        expect(getAvatarInitials("@alice:matrix.org")).toBe("A");
        expect(getAvatarInitials("@bob:server")).toBe("B");
    });

    it("handles Matrix ID with display name override (multi-word after @)", () => {
        // If someone has "@Alice Smith:server" as their ID (unusual but possible)
        const result = getAvatarInitials("@Alice Smith:server");
        // Should strip @, take up to :, get "Alice Smith", then first+last
        expect(result).toBe("AS");
    });

    it("uppercases the result", () => {
        expect(getAvatarInitials("alice")).toBe("A");
        expect(getAvatarInitials("alice bob")).toBe("AB");
    });

    it("handles single-character names", () => {
        expect(getAvatarInitials("A")).toBe("A");
        expect(getAvatarInitials("x")).toBe("X");
    });

    it("returns '?' when name is just '@' or '@:'", () => {
        expect(getAvatarInitials("@")).toBe("?");
        expect(getAvatarInitials("@:server")).toBe("?");
    });
});

describe("getAvatarColor", () => {
    it("returns a palette entry for any seed", () => {
        const color = getAvatarColor("test");
        expect(AVATAR_PALETTE).toContain(color);
    });

    it("is deterministic (same seed returns same color)", () => {
        const seed = "alice@matrix.org";
        const color1 = getAvatarColor(seed);
        const color2 = getAvatarColor(seed);
        expect(color1).toBe(color2);
    });

    it("distributes different seeds across the palette", () => {
        // With 8 palette colors, 8 different seeds should hit at least 3 different colors
        const seeds = ["a", "b", "c", "d", "e", "f", "g", "h"];
        const colors = new Set(seeds.map(getAvatarColor));
        expect(colors.size).toBeGreaterThanOrEqual(3);
    });

    it("treats null/undefined as the seed '?'", () => {
        const nullColor = getAvatarColor(null);
        const undefinedColor = getAvatarColor(undefined);
        const fallbackColor = getAvatarColor("?");
        expect(nullColor).toBe(fallbackColor);
        expect(undefinedColor).toBe(fallbackColor);
    });

    it("returns a valid CSS variable reference", () => {
        const color = getAvatarColor("test");
        expect(color).toMatch(/^var\(--avatar-color-\d\)$/);
    });
});
