import { describe, expect, it } from "vitest";
import { placeholderStyle } from "./imagePlaceholder";

describe("placeholderStyle", () => {
    it("layers the URLs best first", () => {
        expect(
            placeholderStyle([
                "https://hs/_matrix/client/v1/media/thumbnail/s/a?width=800",
                "blob:https://app/123",
            ]),
        ).toBe(
            'background-image: url("https://hs/_matrix/client/v1/media/thumbnail/s/a?width=800"), url("blob:https://app/123"); ' +
                "background-size: 100% 100%; background-repeat: no-repeat;",
        );
    });

    it("is empty when there is nothing to show", () => {
        expect(placeholderStyle([null, undefined, ""])).toBe("");
    });

    it("drops other schemes", () => {
        expect(placeholderStyle(["javascript:alert(1)", "data:x"])).toBe("");
    });

    it("cannot break out of the url string", () => {
        const style = placeholderStyle(['https://hs/a");color:red;x("']);
        expect(style).toContain('url("https://hs/a\\");color:red;x(\\"")');
    });

    it("escapes a raw quote or backslash in a blob URL", () => {
        const style = placeholderStyle(['blob:https://app/a"b\\c']);
        expect(style).toContain('url("blob:https://app/a\\"b\\\\c")');
    });
});
