import { describe, it, expect } from "vitest";
import { resolveDisplayName } from "./displayName";

describe("resolveDisplayName", () => {
    const uid = "@alice:example.org";

    it("returns the display name in default mode", () => {
        expect(resolveDisplayName({ userId: uid, displayName: "Alice" })).toBe(
            "Alice",
        );
    });

    it("returns the full MXID when preferId is set, even with a name", () => {
        expect(
            resolveDisplayName(
                { userId: uid, displayName: "Alice" },
                { preferId: true },
            ),
        ).toBe(uid);
    });

    it("falls back to the MXID when there is no display name", () => {
        expect(resolveDisplayName({ userId: uid })).toBe(uid);
        expect(
            resolveDisplayName({ userId: uid, displayName: undefined }),
        ).toBe(uid);
        expect(resolveDisplayName({ userId: uid, displayName: null })).toBe(
            uid,
        );
    });

    it("treats a name equal to the userId as no display name", () => {
        expect(resolveDisplayName({ userId: uid, displayName: uid })).toBe(uid);
    });

    it("treats a whitespace-only name as no display name", () => {
        expect(resolveDisplayName({ userId: uid, displayName: "   " })).toBe(
            uid,
        );
    });

    it("trims surrounding whitespace from the display name", () => {
        expect(
            resolveDisplayName({ userId: uid, displayName: "  Alice  " }),
        ).toBe("Alice");
    });

    it("strips a trailing disambiguation suffix in default mode", () => {
        const name = "Alice (@alice2:example.org)";
        expect(resolveDisplayName({ userId: uid, displayName: name })).toBe(
            "Alice",
        );
    });

    it("resolves a bridged ghost's display name over its synthetic MXID", () => {
        expect(
            resolveDisplayName({
                userId: "@_ooye_alice:matrix.crafty.moe",
                displayName: "Alice (Discord)",
            }),
        ).toBe("Alice (Discord)");
    });

    it("keeps real parentheticals that are not MXID suffixes", () => {
        expect(
            resolveDisplayName({ userId: uid, displayName: "Bob (dev)" }),
        ).toBe("Bob (dev)");
    });

    it("strips suffix with a port", () => {
        expect(
            resolveDisplayName({
                userId: uid,
                displayName: "Carol (@carol:example.org:8448)",
            }),
        ).toBe("Carol");
    });

    it("does not strip under preferId mode", () => {
        expect(
            resolveDisplayName(
                { userId: uid, displayName: "Alice (@alice2:example.org)" },
                { preferId: true },
            ),
        ).toBe(uid);
    });

    it("falls back to userId when name is only the suffix", () => {
        expect(resolveDisplayName({ userId: uid, displayName: "(@x:y)" })).toBe(
            uid,
        );
    });

    it("returns the full MXID under preferId even when no name is set", () => {
        expect(resolveDisplayName({ userId: uid }, { preferId: true })).toBe(
            uid,
        );
    });
});
