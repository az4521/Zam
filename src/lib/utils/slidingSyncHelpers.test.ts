import { describe, it, expect } from "vitest";
import {
    isSlidingSyncUnsupportedError,
    nextWindowEnd,
} from "./slidingSyncHelpers";

describe("nextWindowEnd", () => {
    it("grows by one step", () => {
        expect(nextWindowEnd(29, 1000, 100)).toBe(129);
    });

    it("clamps to the last index", () => {
        expect(nextWindowEnd(129, 150, 100)).toBe(149);
    });

    it("stops once the window covers every room", () => {
        expect(nextWindowEnd(149, 150, 100)).toBeNull();
        expect(nextWindowEnd(500, 150, 100)).toBeNull();
    });

    it("does nothing before the server has reported a total", () => {
        expect(nextWindowEnd(29, 0, 100)).toBeNull();
        expect(nextWindowEnd(undefined, 500, 100)).toBeNull();
    });
});

describe("isSlidingSyncUnsupportedError", () => {
    it("treats missing-endpoint responses as unsupported", () => {
        expect(isSlidingSyncUnsupportedError({ httpStatus: 404 })).toBe(true);
        expect(isSlidingSyncUnsupportedError({ httpStatus: 405 })).toBe(true);
        expect(isSlidingSyncUnsupportedError({ httpStatus: 501 })).toBe(true);
        expect(
            isSlidingSyncUnsupportedError({ errcode: "M_UNRECOGNIZED" }),
        ).toBe(true);
    });

    it("does not treat transient or auth failures as unsupported", () => {
        expect(isSlidingSyncUnsupportedError({ httpStatus: 500 })).toBe(false);
        expect(isSlidingSyncUnsupportedError({ httpStatus: 429 })).toBe(false);
        expect(isSlidingSyncUnsupportedError({ httpStatus: 401 })).toBe(false);
        expect(isSlidingSyncUnsupportedError(new Error("network"))).toBe(false);
        expect(isSlidingSyncUnsupportedError(null)).toBe(false);
    });
});
