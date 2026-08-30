import { describe, it, expect, vi } from "vitest";
import {
    applyTextTransforms,
    applyContentTransforms,
} from "./outgoingTransforms";

const ctx = { roomId: "!r:server" };

describe("applyTextTransforms", () => {
    it("returns the input unchanged with no transforms", () => {
        expect(applyTextTransforms("hi", [], ctx)).toBe("hi");
    });
    it("applies transforms in order, each feeding the next", () => {
        const addA = (t: string) => t + "a"; // "x" -> "xa"
        const addB = (t: string) => t + "b"; // "xa" -> "xab"
        // Non-commutative: reversed order yields "xba" — proving order.
        expect(applyTextTransforms("x", [addA, addB], ctx)).toBe("xab");
    });
    it("passes the ctx to each transform", () => {
        const spy = vi.fn((t: string) => t);
        applyTextTransforms("hi", [spy], ctx);
        expect(spy).toHaveBeenCalledWith("hi", ctx);
    });
    it("skips a transform that throws and keeps the prior value", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const boom = () => {
            throw new Error("boom");
        };
        const bang = (t: string) => t + "!";
        expect(applyTextTransforms("hi", [boom, bang], ctx)).toBe("hi!");
    });
    it("skips a transform that returns a non-string", () => {
        const bad = () => 42 as unknown as string;
        const bang = (t: string) => t + "!";
        expect(applyTextTransforms("hi", [bad, bang], ctx)).toBe("hi!");
    });
});

describe("applyContentTransforms", () => {
    const base = { msgtype: "m.text", body: "hi" };
    it("returns the input unchanged with no transforms", () => {
        expect(applyContentTransforms(base, [], ctx)).toEqual(base);
    });
    it("applies transforms in order, each feeding the next", () => {
        const setA = (c: Record<string, unknown>) => ({ ...c, a: 5 });
        const doubleA = (c: Record<string, unknown>) => ({
            ...c,
            a: (c.a as number) * 2,
        });
        // Reversed order would double `undefined` (NaN) — proving order.
        expect(
            applyContentTransforms(base, [setA, doubleA], ctx),
        ).toMatchObject({ a: 10 });
    });
    it("skips a transform that throws", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const boom = () => {
            throw new Error("boom");
        };
        const addB = (c: Record<string, unknown>) => ({ ...c, b: 2 });
        expect(applyContentTransforms(base, [boom, addB], ctx)).toEqual({
            msgtype: "m.text",
            body: "hi",
            b: 2,
        });
    });
    it("skips a transform that returns null / undefined / non-object / array", () => {
        const bad1 = () => null as unknown as Record<string, unknown>;
        const bad2 = () => [] as unknown as Record<string, unknown>;
        const bad3 = () => undefined as unknown as Record<string, unknown>;
        const addB = (c: Record<string, unknown>) => ({ ...c, b: 2 });
        expect(
            applyContentTransforms(base, [bad1, bad2, bad3, addB], ctx),
        ).toEqual({
            msgtype: "m.text",
            body: "hi",
            b: 2,
        });
    });
});
