import { describe, it, expect, beforeEach } from "vitest";
import {
    scopedKey,
    readScoped,
    writeScoped,
    removeScoped,
} from "./scopedStorage";

beforeEach(() => localStorage.clear());

describe("scopedKey", () => {
    it("suffixes the base key with the user id", () => {
        expect(scopedKey("matrix_last_space", "@a:x.org")).toBe(
            "matrix_last_space:@a:x.org",
        );
    });

    it("falls back to the bare key without a user id", () => {
        expect(scopedKey("matrix_last_space", null)).toBe("matrix_last_space");
    });
});

describe("readScoped legacy adoption", () => {
    it("adopts a legacy unscoped value on first read, then deletes it", () => {
        localStorage.setItem("matrix_last_space", "!space:x.org");
        expect(readScoped("matrix_last_space", "@a:x.org")).toBe(
            "!space:x.org",
        );
        expect(localStorage.getItem("matrix_last_space")).toBeNull();
        expect(localStorage.getItem("matrix_last_space:@a:x.org")).toBe(
            "!space:x.org",
        );
    });

    it("prefers an existing scoped value over a legacy one", () => {
        localStorage.setItem("matrix_last_space", "legacy");
        localStorage.setItem("matrix_last_space:@a:x.org", "scoped");
        expect(readScoped("matrix_last_space", "@a:x.org")).toBe("scoped");
    });

    it("returns null when neither key exists", () => {
        expect(readScoped("matrix_last_space", "@a:x.org")).toBeNull();
    });
});

describe("writeScoped / removeScoped", () => {
    it("round-trips per account without touching other accounts", () => {
        writeScoped("k", "@a:x.org", "va");
        writeScoped("k", "@b:x.org", "vb");
        expect(readScoped("k", "@a:x.org")).toBe("va");
        expect(readScoped("k", "@b:x.org")).toBe("vb");
        removeScoped("k", "@a:x.org");
        expect(readScoped("k", "@a:x.org")).toBeNull();
        expect(readScoped("k", "@b:x.org")).toBe("vb");
    });
});
