import { describe, it, expect } from "vitest";
import { stripBodyFallback, stripFormattedFallback } from "./replyFallback";

describe("stripBodyFallback (spec v1.19 removal algorithm)", () => {
    it("drops leading '> '-prefixed lines and the following blank line", () => {
        expect(stripBodyFallback("> <@a:hs> hi\n> line2\n\nreply")).toBe(
            "reply",
        );
    });
    it("does not strip '>' without space", () => {
        expect(stripBodyFallback(">no space\n\nx")).toBe(">no space\n\nx");
    });
    it("stops at the first non-prefixed line even without a blank separator", () => {
        expect(stripBodyFallback("> q\nreply")).toBe("reply");
    });
    it("leaves a body with no fallback untouched", () => {
        expect(stripBodyFallback("> quoted opinion\n\nagree")).toBe("agree"); // NOTE: spec algorithm strips any leading quote — this is the correct spec behavior
        expect(stripBodyFallback("plain")).toBe("plain");
    });
});
describe("stripFormattedFallback", () => {
    it("removes a leading mx-reply ELEMENT with its content, attributes or not", () => {
        expect(
            stripFormattedFallback(
                `<mx-reply><blockquote>q</blockquote></mx-reply>hi`,
            ),
        ).toBe("hi");
        expect(
            stripFormattedFallback(
                `<mx-reply data-x="1"><b>q</b></mx-reply>hi`,
            ),
        ).toBe("hi");
    });
    it("only strips when the body BEGINS with mx-reply", () => {
        expect(stripFormattedFallback(`hi <mx-reply>q</mx-reply>`)).toBe(
            `hi <mx-reply>q</mx-reply>`,
        );
    });
});
