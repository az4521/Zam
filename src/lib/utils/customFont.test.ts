import { describe, it, expect, vi, afterEach } from "vitest";
import {
    validateCustomFontFile,
    CUSTOM_FONT_MAX_BYTES,
    putStoredFont,
} from "./customFont";

describe("validateCustomFontFile", () => {
    it("accepts .woff2 and derives a display name", () => {
        const r = validateCustomFontFile({
            name: "MyFont-Regular.woff2",
            size: 1000,
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.ext).toBe("woff2");
            expect(r.displayName).toBe("MyFont-Regular");
        }
    });
    it("accepts .ttf and .otf case-insensitively", () => {
        expect(validateCustomFontFile({ name: "A.TTF", size: 10 }).ok).toBe(
            true,
        );
        expect(validateCustomFontFile({ name: "b.otf", size: 10 }).ok).toBe(
            true,
        );
    });
    it("rejects a wrong extension", () => {
        const r = validateCustomFontFile({ name: "evil.png", size: 10 });
        expect(r.ok).toBe(false);
    });
    it("rejects a name with no extension", () => {
        expect(validateCustomFontFile({ name: "myfont", size: 10 }).ok).toBe(
            false,
        );
    });
    it("rejects an empty (0-byte) file", () => {
        expect(validateCustomFontFile({ name: "a.woff2", size: 0 }).ok).toBe(
            false,
        );
    });
    it("accepts exactly the size cap and rejects one byte over", () => {
        expect(
            validateCustomFontFile({
                name: "a.woff2",
                size: CUSTOM_FONT_MAX_BYTES,
            }).ok,
        ).toBe(true);
        expect(
            validateCustomFontFile({
                name: "a.woff2",
                size: CUSTOM_FONT_MAX_BYTES + 1,
            }).ok,
        ).toBe(false);
    });
    it("strips a path prefix from the display name", () => {
        const r = validateCustomFontFile({
            name: "C:\\fonts\\Cool.otf",
            size: 10,
        });
        expect(r.ok && r.displayName).toBe("Cool");
    });
    it("caps a very long display name at 60 chars", () => {
        const long = "x".repeat(200) + ".woff2";
        const r = validateCustomFontFile({ name: long, size: 10 });
        expect(r.ok && r.displayName.length).toBe(60);
    });
});

describe("putStoredFont", () => {
    const rec = {
        id: "custom" as const,
        name: "F",
        ext: "woff2",
        data: new ArrayBuffer(4),
        storedAt: 1,
    };

    // Minimal IndexedDB double: open() succeeds, and the readwrite
    // transaction settles with the given event after put().
    function stubIdb(outcome: "complete" | "error" | "abort") {
        const tx: Record<string, unknown> = {
            error: new Error("quota"),
            objectStore: () => ({
                put: () => {
                    queueMicrotask(() => {
                        const handler = tx[`on${outcome}`] as
                            (() => void) | undefined;
                        handler?.();
                    });
                },
            }),
        };
        const db = { transaction: () => tx };
        vi.stubGlobal("indexedDB", {
            open: () => {
                const req: Record<string, unknown> = { result: db };
                queueMicrotask(() => (req.onsuccess as () => void)());
                return req;
            },
        });
    }

    afterEach(() => vi.unstubAllGlobals());

    it("returns true when the write commits", async () => {
        stubIdb("complete");
        expect(await putStoredFont(rec)).toBe(true);
    });
    it("returns false when the write errors", async () => {
        stubIdb("error");
        expect(await putStoredFont(rec)).toBe(false);
    });
    it("returns false when the transaction aborts (quota exceeded)", async () => {
        stubIdb("abort");
        expect(await putStoredFont(rec)).toBe(false);
    });
    it("returns false when IndexedDB is unavailable", async () => {
        vi.stubGlobal("indexedDB", undefined);
        expect(await putStoredFont(rec)).toBe(false);
    });
});
