import { describe, it, expect } from "vitest";
import {
    isKnockJoinRule,
    getErrcode,
    shouldOfferKnock,
    matrixErrorMessage,
    buildKnockOpts,
} from "./knock";

describe("isKnockJoinRule", () => {
    it("accepts knock", () => {
        expect(isKnockJoinRule("knock")).toBe(true);
    });

    it("accepts knock_restricted", () => {
        expect(isKnockJoinRule("knock_restricted")).toBe(true);
    });

    it.each(["invite", "public", "restricted", "private", ""])(
        "rejects %j",
        (rule) => {
            expect(isKnockJoinRule(rule)).toBe(false);
        },
    );

    it("rejects null and undefined", () => {
        expect(isKnockJoinRule(null)).toBe(false);
        expect(isKnockJoinRule(undefined)).toBe(false);
    });
});

describe("getErrcode", () => {
    it("reads a top-level errcode (MatrixError shape)", () => {
        expect(getErrcode({ errcode: "M_FORBIDDEN" })).toBe("M_FORBIDDEN");
    });

    it("falls back to data.errcode", () => {
        expect(getErrcode({ data: { errcode: "M_NOT_FOUND" } })).toBe(
            "M_NOT_FOUND",
        );
    });

    it("prefers the top-level errcode over data.errcode", () => {
        expect(
            getErrcode({
                errcode: "M_FORBIDDEN",
                data: { errcode: "M_UNKNOWN" },
            }),
        ).toBe("M_FORBIDDEN");
    });

    it.each([null, undefined, "boom", 42, {}, new Error("plain")])(
        "returns undefined for %j",
        (err) => {
            expect(getErrcode(err)).toBeUndefined();
        },
    );

    it("ignores non-string errcodes", () => {
        expect(getErrcode({ errcode: 403 })).toBeUndefined();
    });
});

describe("shouldOfferKnock", () => {
    const forbidden = { errcode: "M_FORBIDDEN" };

    it("offers on M_FORBIDDEN when the join rule is knock", () => {
        expect(shouldOfferKnock(forbidden, "knock")).toBe(true);
    });

    it("offers on M_FORBIDDEN when the join rule is knock_restricted", () => {
        expect(shouldOfferKnock(forbidden, "knock_restricted")).toBe(true);
    });

    it("offers on M_FORBIDDEN when the join rule is unknown", () => {
        expect(shouldOfferKnock(forbidden, undefined)).toBe(true);
        expect(shouldOfferKnock(forbidden, null)).toBe(true);
    });

    it("does not offer when the join rule is known and not knock", () => {
        expect(shouldOfferKnock(forbidden, "invite")).toBe(false);
        expect(shouldOfferKnock(forbidden, "public")).toBe(false);
        expect(shouldOfferKnock(forbidden, "restricted")).toBe(false);
    });

    it("does not offer for other errcodes, even on knock rooms", () => {
        expect(shouldOfferKnock({ errcode: "M_NOT_FOUND" }, "knock")).toBe(
            false,
        );
        expect(shouldOfferKnock({ errcode: "M_UNKNOWN" }, "knock")).toBe(
            false,
        );
    });

    it("does not offer for errors without an errcode", () => {
        expect(shouldOfferKnock(new Error("network down"), "knock")).toBe(
            false,
        );
        expect(shouldOfferKnock(null, "knock")).toBe(false);
        expect(shouldOfferKnock(undefined, undefined)).toBe(false);
    });
});

describe("matrixErrorMessage", () => {
    it("prefers the server's human-readable error", () => {
        expect(
            matrixErrorMessage(
                { data: { error: "You are not invited to this room." } },
                "fallback",
            ),
        ).toBe("You are not invited to this room.");
    });

    it("falls back to the error message", () => {
        expect(matrixErrorMessage(new Error("boom"), "fallback")).toBe("boom");
    });

    it("uses the fallback for junk input", () => {
        expect(matrixErrorMessage(null, "fallback")).toBe("fallback");
        expect(matrixErrorMessage(undefined, "fallback")).toBe("fallback");
        expect(matrixErrorMessage({}, "fallback")).toBe("fallback");
        expect(matrixErrorMessage("boom", "fallback")).toBe("fallback");
    });

    it("skips empty server error strings", () => {
        expect(matrixErrorMessage({ data: { error: "" } }, "fallback")).toBe(
            "fallback",
        );
    });
});

describe("buildKnockOpts", () => {
    it("returns empty opts when nothing is given", () => {
        expect(buildKnockOpts()).toEqual({});
        expect(buildKnockOpts("", [])).toEqual({});
    });

    it("trims the reason and omits whitespace-only reasons", () => {
        expect(buildKnockOpts("  let me in  ")).toEqual({
            reason: "let me in",
        });
        expect(buildKnockOpts("   ")).toEqual({});
    });

    it("passes via servers only when non-empty", () => {
        expect(buildKnockOpts(undefined, ["a.org", "b.org"])).toEqual({
            viaServers: ["a.org", "b.org"],
        });
        expect(buildKnockOpts(undefined, [])).toEqual({});
    });

    it("combines reason and via servers", () => {
        expect(buildKnockOpts("hi", ["a.org"])).toEqual({
            reason: "hi",
            viaServers: ["a.org"],
        });
    });
});
