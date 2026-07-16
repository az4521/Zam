import { describe, it, expect } from "vitest";
import { getCryptoDbName } from "./cryptoStore";

describe("getCryptoDbName — per-account rust-crypto store name", () => {
    it("builds a name mirroring the sync db name, suffixed :crypto", () => {
        expect(getCryptoDbName("@alice:example.org", "DEV1")).toBe(
            "matrix-client:%40alice%3Aexample.org:DEV1:crypto",
        );
    });

    it("URL-encodes user id and device id so separators can't collide", () => {
        expect(getCryptoDbName("@a:b", "d/e")).toBe(
            "matrix-client:%40a%3Ab:d%2Fe:crypto",
        );
    });

    it("differs from the sync store name for the same account", () => {
        const name = getCryptoDbName("@u:h", "D");
        expect(name.endsWith(":crypto")).toBe(true);
        expect(name).not.toContain(":sync");
    });

    it("gives distinct names to two devices of the same user", () => {
        expect(getCryptoDbName("@u:h", "A")).not.toBe(
            getCryptoDbName("@u:h", "B"),
        );
    });
});
