import { describe, expect, it } from "vitest";
import { parseLoginUsername } from "./loginIdentity";

describe("parseLoginUsername", () => {
    it("splits a full Matrix user ID into a localpart and homeserver", () => {
        expect(parseLoginUsername("@alice:matrix.example.org")).toEqual({
            username: "alice",
            homeserver: "matrix.example.org",
        });
    });

    it("preserves a homeserver port", () => {
        expect(parseLoginUsername("@alice:matrix.example.org:8448")).toEqual({
            username: "alice",
            homeserver: "matrix.example.org:8448",
        });
    });

    it("trims a plain username without inventing a homeserver", () => {
        expect(parseLoginUsername("  alice  ")).toEqual({
            username: "alice",
            homeserver: null,
        });
    });

    it("leaves incomplete or URL-shaped IDs in the username field", () => {
        expect(parseLoginUsername("@alice")).toEqual({
            username: "@alice",
            homeserver: null,
        });
        expect(parseLoginUsername("@alice:https://matrix.example.org")).toEqual(
            {
                username: "@alice:https://matrix.example.org",
                homeserver: null,
            },
        );
    });
});
