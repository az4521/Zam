import { describe, it, expect } from "vitest";
import { viaFallbackCandidates } from "./joinFallback";

function notFound(message: string) {
    return { errcode: "M_NOT_FOUND", data: { error: message } };
}

describe("viaFallbackCandidates", () => {
    it("returns the remaining candidates when the error implicates one", () => {
        const err = notFound("Answer from ellis.link: Not found in database");
        expect(
            viaFallbackCandidates(err, [
                "ellis.link",
                "matrix.org",
                "mozilla.org",
            ]),
        ).toEqual(["matrix.org", "mozilla.org"]);
    });

    it("keeps candidate order", () => {
        const err = notFound("Answer from b.org: Not found in database");
        expect(viaFallbackCandidates(err, ["a.org", "b.org", "c.org"])).toEqual(
            ["a.org", "c.org"],
        );
    });

    it("returns all candidates when the message implicates none", () => {
        const err = notFound("Room not found");
        expect(viaFallbackCandidates(err, ["a.org", "b.org"])).toEqual([
            "a.org",
            "b.org",
        ]);
    });

    it("matches implicated servers case-insensitively", () => {
        const err = notFound("Answer from Ellis.LINK: Not found in database");
        expect(viaFallbackCandidates(err, ["ellis.link", "b.org"])).toEqual([
            "b.org",
        ]);
    });

    it("does not treat a longer hostname as implicating a shorter one", () => {
        const err = notFound(
            "Answer from matrix.org.uk: Not found in database",
        );
        expect(viaFallbackCandidates(err, ["matrix.org", "b.org"])).toEqual([
            "matrix.org",
            "b.org",
        ]);
    });

    it("reads the errcode from the response body shape too", () => {
        const err = {
            data: {
                errcode: "M_NOT_FOUND",
                error: "Answer from a.org: Not found in database",
            },
        };
        expect(viaFallbackCandidates(err, ["a.org", "b.org"])).toEqual([
            "b.org",
        ]);
    });

    it("returns [] for other errcodes", () => {
        const err = {
            errcode: "M_FORBIDDEN",
            data: { error: "You are not invited to this room" },
        };
        expect(viaFallbackCandidates(err, ["a.org", "b.org"])).toEqual([]);
    });

    it("returns [] for errors without an errcode", () => {
        expect(
            viaFallbackCandidates(new Error("boom"), ["a.org", "b.org"]),
        ).toEqual([]);
        expect(viaFallbackCandidates(null, ["a.org", "b.org"])).toEqual([]);
    });

    it("returns [] when there is at most one candidate", () => {
        const err = notFound("Answer from a.org: Not found in database");
        expect(viaFallbackCandidates(err, ["a.org"])).toEqual([]);
        expect(viaFallbackCandidates(err, [])).toEqual([]);
        expect(viaFallbackCandidates(err, undefined)).toEqual([]);
    });

    it("returns [] when every candidate is implicated", () => {
        const err = notFound("Answers from a.org and b.org: not found");
        expect(viaFallbackCandidates(err, ["a.org", "b.org"])).toEqual([]);
    });
});
