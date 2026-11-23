import { describe, it, expect } from "vitest";
import { parseAddWidgetArg, parseWidgetAddress } from "./widgetAdd";

describe("parseWidgetAddress", () => {
    it("accepts http and https addresses and returns the canonical href", () => {
        expect(parseWidgetAddress("https://example.org/widget")).toBe(
            "https://example.org/widget",
        );
        expect(parseWidgetAddress("  http://example.org  ")).toBe(
            "http://example.org/",
        );
    });

    it("rejects other schemes", () => {
        expect(parseWidgetAddress("javascript:alert(1)")).toBeNull();
        expect(parseWidgetAddress("data:text/html,hi")).toBeNull();
        expect(parseWidgetAddress("ftp://example.org")).toBeNull();
    });

    it("rejects a bare host, an empty string and garbage", () => {
        expect(parseWidgetAddress("example.org")).toBeNull();
        expect(parseWidgetAddress("")).toBeNull();
        expect(parseWidgetAddress("   ")).toBeNull();
        expect(parseWidgetAddress("not a url")).toBeNull();
    });
});

describe("parseAddWidgetArg", () => {
    it("takes the url and no name", () => {
        expect(parseAddWidgetArg("https://example.org/w")).toEqual({
            url: "https://example.org/w",
            name: "",
        });
    });

    it("takes the rest of the line as the name", () => {
        expect(
            parseAddWidgetArg("https://example.org/w  Poll   board "),
        ).toEqual({ url: "https://example.org/w", name: "Poll   board" });
    });

    it("returns null for a missing or non-http address", () => {
        expect(parseAddWidgetArg("")).toBeNull();
        expect(parseAddWidgetArg("example.org Poll")).toBeNull();
        expect(parseAddWidgetArg("javascript:x Name")).toBeNull();
    });
});
