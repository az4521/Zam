import { describe, it, expect } from "vitest";
import { addToMDirect } from "./mDirect";

describe("addToMDirect — record a room under a DM partner in m.direct", () => {
    it("adds a room under the partner, creating the map/list as needed", () => {
        expect(addToMDirect(undefined, "@p:hs", "!r:hs")).toEqual({
            "@p:hs": ["!r:hs"],
        });
        expect(
            addToMDirect({ "@p:hs": ["!old:hs"] }, "@p:hs", "!r:hs"),
        ).toEqual({ "@p:hs": ["!old:hs", "!r:hs"] });
    });

    it("is idempotent and preserves other partners", () => {
        const cur = { "@p:hs": ["!r:hs"], "@q:hs": ["!z:hs"] };
        expect(addToMDirect(cur, "@p:hs", "!r:hs")).toEqual(cur);
    });

    it("returns a new object and does not mutate the input", () => {
        const cur = { "@p:hs": ["!old:hs"] };
        const out = addToMDirect(cur, "@p:hs", "!r:hs");
        expect(out).not.toBe(cur);
        expect(out["@p:hs"]).not.toBe(cur["@p:hs"]);
        // input untouched
        expect(cur).toEqual({ "@p:hs": ["!old:hs"] });
    });
});
