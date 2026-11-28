import { describe, it, expect, vi } from "vitest";
import { firstCallWrapper } from "./firstCallMemo";

describe("firstCallWrapper", () => {
    it("shares the early promise with the first call", async () => {
        const original = vi.fn(async () => "original");
        const early = Promise.resolve("early");
        const wrapped = firstCallWrapper(original, early);

        await expect(wrapped()).resolves.toBe("early");
        expect(original).not.toHaveBeenCalled();
    });

    it("shares a still-pending early promise", async () => {
        const original = vi.fn(async () => "original");
        let resolveEarly: (v: string) => void = () => {};
        const early = new Promise<string>((r) => (resolveEarly = r));
        const wrapped = firstCallWrapper(original, early);

        const pending = wrapped();
        resolveEarly("early");
        await expect(pending).resolves.toBe("early");
        expect(original).not.toHaveBeenCalled();
    });

    it("sends every later call to the original", async () => {
        const original = vi.fn(async () => "original");
        const wrapped = firstCallWrapper(original, Promise.resolve("early"));

        await wrapped();
        await expect(wrapped()).resolves.toBe("original");
        await expect(wrapped()).resolves.toBe("original");
        expect(original).toHaveBeenCalledTimes(2);
    });

    it("falls through to a real call when the early promise rejected", async () => {
        const original = vi.fn(async () => "original");
        const early = Promise.reject(new Error("network blip"));
        const wrapped = firstCallWrapper(original, early);

        await expect(wrapped()).resolves.toBe("original");
        expect(original).toHaveBeenCalledTimes(1);
        await expect(wrapped()).resolves.toBe("original");
        expect(original).toHaveBeenCalledTimes(2);
    });

    it("passes the arguments through to the real call", async () => {
        const original = vi.fn(async (a: number) => a * 2);
        const wrapped = firstCallWrapper(
            original,
            Promise.reject(new Error("x")),
        );

        await expect(wrapped(21)).resolves.toBe(42);
        expect(original).toHaveBeenCalledWith(21);
    });

    it("does not raise an unhandled rejection when never called", async () => {
        const unhandled = vi.fn();
        process.on("unhandledRejection", unhandled);
        try {
            firstCallWrapper(
                async () => "original",
                Promise.reject(new Error("early failure")),
            );
            await new Promise((r) => setTimeout(r, 20));
            expect(unhandled).not.toHaveBeenCalled();
        } finally {
            process.off("unhandledRejection", unhandled);
        }
    });
});
