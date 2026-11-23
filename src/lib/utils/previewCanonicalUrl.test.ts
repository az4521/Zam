import { describe, it, expect } from "vitest";
import { safePreviewCanonicalUrl } from "./previewCanonicalUrl";

describe("safePreviewCanonicalUrl", () => {
    it("accepts http and https URLs", () => {
        expect(safePreviewCanonicalUrl("https://example.com/a")).toBe(
            "https://example.com/a",
        );
        expect(safePreviewCanonicalUrl("http://example.com/")).toBe(
            "http://example.com/",
        );
    });

    it("rejects script, data and other schemes", () => {
        expect(safePreviewCanonicalUrl("javascript:alert(1)")).toBeUndefined();
        expect(
            safePreviewCanonicalUrl("data:text/html,<script>x</script>"),
        ).toBeUndefined();
        expect(safePreviewCanonicalUrl("vbscript:msgbox")).toBeUndefined();
        expect(safePreviewCanonicalUrl("ftp://example.com/")).toBeUndefined();
        expect(
            safePreviewCanonicalUrl("mxc://example.com/abc"),
        ).toBeUndefined();
    });

    it("rejects empty, non-string and unparseable values", () => {
        expect(safePreviewCanonicalUrl("")).toBeUndefined();
        expect(safePreviewCanonicalUrl("   ")).toBeUndefined();
        expect(safePreviewCanonicalUrl(undefined)).toBeUndefined();
        expect(safePreviewCanonicalUrl(42)).toBeUndefined();
        expect(safePreviewCanonicalUrl("not a url")).toBeUndefined();
    });
});
