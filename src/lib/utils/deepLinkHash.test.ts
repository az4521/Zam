import { describe, it, expect } from "vitest";
import { parseDeepLinkHash } from "./deepLinkHash";

describe("parseDeepLinkHash", () => {
    it("parses room + event with the leading #", () => {
        expect(
            parseDeepLinkHash("#room=!abc:example.org&event=$evt:example.org"),
        ).toEqual({ roomId: "!abc:example.org", eventId: "$evt:example.org" });
    });

    it("URL-decodes percent-encoded room and event ids", () => {
        expect(
            parseDeepLinkHash(
                "#room=%21abc%3Aexample.org&event=%24evt%3Aexample.org",
            ),
        ).toEqual({ roomId: "!abc:example.org", eventId: "$evt:example.org" });
    });

    it("returns just the room when there is no event", () => {
        expect(parseDeepLinkHash("#room=!abc:example.org")).toEqual({
            roomId: "!abc:example.org",
        });
    });

    it("accepts a fragment without the leading #", () => {
        expect(parseDeepLinkHash("room=!abc:example.org")).toEqual({
            roomId: "!abc:example.org",
        });
    });

    it("is order-independent and ignores extra params", () => {
        expect(parseDeepLinkHash("#event=$x:h&foo=bar&room=!a:h")).toEqual({
            roomId: "!a:h",
            eventId: "$x:h",
        });
    });

    it("drops a malformed event id but keeps the room", () => {
        expect(
            parseDeepLinkHash("#room=!abc:example.org&event=notanevent"),
        ).toEqual({ roomId: "!abc:example.org" });
    });

    it("returns null for an empty string", () => {
        expect(parseDeepLinkHash("")).toBeNull();
    });

    it("returns null for a bare #", () => {
        expect(parseDeepLinkHash("#")).toBeNull();
    });

    it("returns null when the room value is empty", () => {
        expect(parseDeepLinkHash("#room=")).toBeNull();
    });

    it("returns null when there is no room param", () => {
        expect(parseDeepLinkHash("#foo=bar")).toBeNull();
    });

    it("returns null when the room value is not a valid room id", () => {
        expect(parseDeepLinkHash("#room=login")).toBeNull();
    });

    it("returns null for null/undefined input", () => {
        expect(parseDeepLinkHash(null)).toBeNull();
        expect(parseDeepLinkHash(undefined)).toBeNull();
    });
});
