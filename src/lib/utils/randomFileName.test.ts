import { describe, expect, it } from "vitest";
import { randomizeFileName } from "./randomFileName";

describe("randomizeFileName", () => {
    it("keeps a simple extension", () => {
        expect(randomizeFileName("photo.jpg")).toMatch(
            /^[A-Za-z0-9]{16}\.jpg$/,
        );
    });
    it("keeps double extensions", () => {
        expect(randomizeFileName("backup.tar.gz")).toMatch(
            /^[A-Za-z0-9]{16}\.tar\.gz$/,
        );
    });
    it("handles no extension and dotfiles", () => {
        expect(randomizeFileName("README")).toMatch(/^[A-Za-z0-9]{16}$/);
        expect(randomizeFileName(".bashrc")).toMatch(/^[A-Za-z0-9]{16}$/);
    });
    it("does not leak odd stems", () => {
        expect(randomizeFileName("my secret. final copy.png")).toMatch(
            /^[A-Za-z0-9]{16}\.png$/,
        );
    });
    it("differs between calls", () => {
        expect(randomizeFileName("a.txt")).not.toBe(randomizeFileName("a.txt"));
    });
});
