import { describe, it, expect } from "vitest";
import { isChunkLoadError } from "./chunkLoadError";

describe("isChunkLoadError", () => {
    it("recognises the Chrome/Edge failed-import message", () => {
        expect(
            isChunkLoadError(
                new Error(
                    "Failed to fetch dynamically imported module: https://app.example.org/_app/immutable/chunks/CkYjDUEM.js",
                ),
            ),
        ).toBe(true);
    });

    it("recognises the Firefox failed-import message", () => {
        expect(
            isChunkLoadError(
                new Error(
                    "error loading dynamically imported module: https://app.example.org/_app/immutable/chunks/CkYjDUEM.js",
                ),
            ),
        ).toBe(true);
    });

    it("recognises the Safari failed-import message", () => {
        expect(
            isChunkLoadError(new Error("Importing a module script failed.")),
        ).toBe(true);
    });

    it("recognises Vite's CSS preload failure", () => {
        expect(
            isChunkLoadError(
                new Error(
                    "Unable to preload CSS for /_app/immutable/assets/CallPanel.DkQ1x.css",
                ),
            ),
        ).toBe(true);
    });

    it("matches regardless of message casing", () => {
        expect(
            isChunkLoadError(
                new Error("FAILED TO FETCH DYNAMICALLY IMPORTED MODULE: /x.js"),
            ),
        ).toBe(true);
    });

    it("reads the message off a non-Error thrown object", () => {
        expect(
            isChunkLoadError({
                message: "Failed to fetch dynamically imported module: /x.js",
            }),
        ).toBe(true);
    });

    it("is false for a MatrixError-shaped rejection", () => {
        expect(
            isChunkLoadError({
                errcode: "M_FORBIDDEN",
                message: "MatrixError: [403] You are not invited to this room",
                data: { error: "You are not invited to this room" },
                httpStatus: 403,
            }),
        ).toBe(false);
    });

    it("is false for an ordinary call failure", () => {
        expect(
            isChunkLoadError(
                new Error("No LiveKit focus available for this call"),
            ),
        ).toBe(false);
    });

    it("is false for a generic network failure", () => {
        expect(isChunkLoadError(new TypeError("Failed to fetch"))).toBe(false);
    });

    it("is false for null, undefined, a string and a number", () => {
        expect(isChunkLoadError(null)).toBe(false);
        expect(isChunkLoadError(undefined)).toBe(false);
        expect(
            isChunkLoadError(
                "Failed to fetch dynamically imported module: /x.js",
            ),
        ).toBe(false);
        expect(isChunkLoadError(42)).toBe(false);
    });

    it("is false for an object with no message, or a non-string one", () => {
        expect(isChunkLoadError({})).toBe(false);
        expect(isChunkLoadError({ message: 500 })).toBe(false);
        expect(isChunkLoadError({ message: null })).toBe(false);
        expect(isChunkLoadError([])).toBe(false);
    });

    it("does not throw on a value whose message getter throws", () => {
        const hostile = {
            get message(): string {
                throw new Error("boom");
            },
        };
        expect(() => isChunkLoadError(hostile)).not.toThrow();
        expect(isChunkLoadError(hostile)).toBe(false);
    });
});
