import { describe, it, expect } from "vitest";
import {
    cryptoFailureKind,
    freeQuotaBytes,
    isLowOnSpace,
    isStorageFullError,
    LOW_SPACE_BYTES,
} from "./storageFull";

describe("isStorageFullError", () => {
    it("recognises QuotaExceededError", () => {
        expect(
            isStorageFullError(new DOMException("full", "QuotaExceededError")),
        ).toBe(true);
    });

    it("recognises SQLite and OS wording in a message", () => {
        expect(isStorageFullError(new Error("SQLITE_FULL: write failed"))).toBe(
            true,
        );
        expect(isStorageFullError("database or disk is full")).toBe(true);
        expect(isStorageFullError(new Error("Disk full"))).toBe(true);
    });

    it("looks through the cause chain", () => {
        const inner = new DOMException("x", "QuotaExceededError");
        expect(
            isStorageFullError(new Error("store failed", { cause: inner })),
        ).toBe(true);
    });

    it("counts a bare UnknownError / DataError only from IndexedDB", () => {
        const unknown = new DOMException("Internal error", "UnknownError");
        const data = new DOMException("bad", "DataError");
        expect(isStorageFullError(unknown)).toBe(false);
        expect(isStorageFullError(data)).toBe(false);
        expect(isStorageFullError(unknown, { fromIndexedDB: true })).toBe(true);
        expect(isStorageFullError(data, { fromIndexedDB: true })).toBe(true);
        // As the crypto WASM wraps it.
        expect(
            isStorageFullError(
                new Error('DomException { name: "UnknownError", code: 0 }'),
                { fromIndexedDB: true },
            ),
        ).toBe(true);
    });

    it("ignores everything else", () => {
        expect(isStorageFullError(new Error("WASM fetch failed"))).toBe(false);
        expect(isStorageFullError(null)).toBe(false);
        expect(isStorageFullError({ some: "object" })).toBe(false);
    });
});

describe("quota helpers", () => {
    it("computes free quota, or null when unknown", () => {
        expect(freeQuotaBytes({ quota: 1000, usage: 400 })).toBe(600);
        expect(freeQuotaBytes({ quota: 1000 })).toBe(1000);
        expect(freeQuotaBytes({})).toBeNull();
        expect(freeQuotaBytes({ quota: 0, usage: 0 })).toBeNull();
    });

    it("flags low space only below the threshold", () => {
        const quota = 10 * LOW_SPACE_BYTES;
        expect(isLowOnSpace({ quota, usage: quota - 1024 })).toBe(true);
        expect(isLowOnSpace({ quota, usage: 0 })).toBe(false);
        expect(isLowOnSpace({})).toBe(false);
    });
});

describe("cryptoFailureKind", () => {
    it("classifies a crypto init failure", () => {
        expect(
            cryptoFailureKind(new DOMException("x", "QuotaExceededError")),
        ).toBe("storage");
        expect(cryptoFailureKind(new DOMException("x", "UnknownError"))).toBe(
            "storage",
        );
        expect(
            cryptoFailureKind(
                new Error(
                    "crypto store is still held by a push-notification decrypt",
                ),
            ),
        ).toBe("locked");
        expect(cryptoFailureKind(new Error("no WASM"))).toBe("other");
    });
});
