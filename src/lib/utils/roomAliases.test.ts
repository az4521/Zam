import { describe, it, expect } from "vitest";
import {
    MAX_ALIAS_LENGTH,
    buildAlias,
    parseAlias,
    validateAliasLocalpart,
    buildCanonicalAliasContent,
    canonicalAliasContentAfterRemoval,
    sortAliasesForDisplay,
} from "./roomAliases";

describe("buildAlias", () => {
    it("joins the parts into #localpart:server", () => {
        expect(buildAlias("my-room", "example.com")).toBe(
            "#my-room:example.com",
        );
    });
});

describe("parseAlias — splits on the FIRST colon so ports survive", () => {
    it("parses a plain alias", () => {
        expect(parseAlias("#my-room:example.com")).toEqual({
            localpart: "my-room",
            serverName: "example.com",
        });
    });

    it("keeps a port in the server name", () => {
        expect(parseAlias("#a:example.com:8448")).toEqual({
            localpart: "a",
            serverName: "example.com:8448",
        });
    });

    it("rejects a missing sigil, missing colon, or empty part", () => {
        expect(parseAlias("my-room:example.com")).toBeNull();
        expect(parseAlias("#my-room")).toBeNull();
        expect(parseAlias("#:example.com")).toBeNull();
        expect(parseAlias("#my-room:")).toBeNull();
    });
});

describe("validateAliasLocalpart", () => {
    it("accepts an ordinary localpart", () => {
        expect(validateAliasLocalpart("my-room", "example.com")).toEqual({
            valid: true,
            reason: null,
        });
    });

    it("rejects an empty localpart", () => {
        const res = validateAliasLocalpart("", "example.com");
        expect(res.valid).toBe(false);
        expect(res.reason).toBe("Enter an address.");
    });

    it("rejects whitespace, ':' and '#'", () => {
        expect(validateAliasLocalpart("my room", "example.com").valid).toBe(
            false,
        );
        expect(validateAliasLocalpart("my:room", "example.com").valid).toBe(
            false,
        );
        expect(validateAliasLocalpart("my#room", "example.com").valid).toBe(
            false,
        );
    });

    it("rejects an alias longer than MAX_ALIAS_LENGTH bytes", () => {
        const long = "a".repeat(MAX_ALIAS_LENGTH);
        const res = validateAliasLocalpart(long, "example.com");
        expect(res.valid).toBe(false);
        expect(res.reason).toContain("too long");
    });

    it("measures length in UTF-8 bytes, not code units", () => {
        // 130 x 2-byte chars = 260 bytes of localpart alone -> over the cap.
        const res = validateAliasLocalpart("é".repeat(130), "example.com");
        expect(res.valid).toBe(false);
        expect(res.reason).toContain("too long");
    });

    it("rejects a duplicate of an existing alias, case-insensitively", () => {
        const res = validateAliasLocalpart("My-Room", "example.com", [
            "#my-room:example.com",
        ]);
        expect(res.valid).toBe(false);
        expect(res.reason).toBe("That address already exists.");
    });
});

describe("buildCanonicalAliasContent — omits empty fields", () => {
    it("returns an empty object when there is no main address and no alternates", () => {
        expect(
            buildCanonicalAliasContent({ alias: null, altAliases: [] }),
        ).toEqual({});
    });

    it("emits alias only when there are no alternates", () => {
        expect(
            buildCanonicalAliasContent({ alias: "#a:s", altAliases: [] }),
        ).toEqual({ alias: "#a:s" });
    });

    it("never repeats the main address inside alt_aliases", () => {
        expect(
            buildCanonicalAliasContent({
                alias: "#a:s",
                altAliases: ["#a:s", "#b:s"],
            }),
        ).toEqual({ alias: "#a:s", alt_aliases: ["#b:s"] });
    });

    it("dedupes and drops empty alternates", () => {
        expect(
            buildCanonicalAliasContent({
                alias: null,
                altAliases: ["#b:s", "#b:s", ""],
            }),
        ).toEqual({ alt_aliases: ["#b:s"] });
    });
});

describe("canonicalAliasContentAfterRemoval", () => {
    it("returns null when the event does not mention the removed alias", () => {
        expect(
            canonicalAliasContentAfterRemoval(
                { alias: "#a:s", alt_aliases: ["#b:s"] },
                "#c:s",
            ),
        ).toBeNull();
    });

    it("clears the main address without promoting an alternate", () => {
        expect(
            canonicalAliasContentAfterRemoval(
                { alias: "#a:s", alt_aliases: ["#b:s"] },
                "#a:s",
            ),
        ).toEqual({ alt_aliases: ["#b:s"] });
    });

    it("drops the alias from alt_aliases and keeps the main address", () => {
        expect(
            canonicalAliasContentAfterRemoval(
                { alias: "#a:s", alt_aliases: ["#b:s", "#c:s"] },
                "#b:s",
            ),
        ).toEqual({ alias: "#a:s", alt_aliases: ["#c:s"] });
    });

    it("returns an empty content object when the last reference goes", () => {
        expect(
            canonicalAliasContentAfterRemoval({ alias: "#a:s" }, "#a:s"),
        ).toEqual({});
    });

    it("tolerates an absent alt_aliases array", () => {
        expect(canonicalAliasContentAfterRemoval({}, "#a:s")).toBeNull();
    });
});

describe("sortAliasesForDisplay", () => {
    it("puts the main address first and sorts the rest A-Z", () => {
        expect(sortAliasesForDisplay(["#c:s", "#a:s", "#b:s"], "#c:s")).toEqual(
            ["#c:s", "#a:s", "#b:s"],
        );
    });

    it("sorts A-Z when there is no main address", () => {
        expect(sortAliasesForDisplay(["#c:s", "#a:s"], null)).toEqual([
            "#a:s",
            "#c:s",
        ]);
    });

    it("dedupes", () => {
        expect(sortAliasesForDisplay(["#a:s", "#a:s"], null)).toEqual(["#a:s"]);
    });
});
