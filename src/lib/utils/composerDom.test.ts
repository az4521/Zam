import { describe, expect, it } from "vitest";
import { pastedPlainText } from "./composerDom";

function clipboard(plain: string): DataTransfer {
    return {
        getData: (type: string) => (type === "text/plain" ? plain : ""),
    } as DataTransfer;
}

describe("pastedPlainText", () => {
    // Reported 2026-11-03: pasting multiline text on Windows doubled every
    // line break, because the clipboard's "\r\n" left a "\r" in the model.
    it("normalizes CRLF and lone CR to LF", () => {
        expect(pastedPlainText(clipboard("a\r\nb\r\n\r\nc\rd"))).toBe(
            "a\nb\n\nc\nd",
        );
    });

    it("leaves LF text alone", () => {
        expect(pastedPlainText(clipboard("a\nb\n"))).toBe("a\nb\n");
    });
});
