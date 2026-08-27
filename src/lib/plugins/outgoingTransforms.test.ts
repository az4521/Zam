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
        const upper = (t: string) => t.toUpperCase();
        const bang = (t: string) => t + "!";
        expect(applyTextTransforms("hi", [upper, bang], ctx)).toBe("HI!");
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
    it("applies transforms in order", () => {
        const addA = (c: Record<string, unknown>) => ({ ...c, a: 1 });
        const addB = (c: Record<string, unknown>) => ({ ...c, b: 2 });
        expect(applyContentTransforms(base, [addA, addB], ctx)).toEqual({
            msgtype: "m.text",
            body: "hi",
            a: 1,
            b: 2,
        });
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
    it("skips a transform that returns null / non-object / array", () => {
        const bad1 = () => null as unknown as Record<string, unknown>;
        const bad2 = () => [] as unknown as Record<string, unknown>;
        const addB = (c: Record<string, unknown>) => ({ ...c, b: 2 });
        expect(applyContentTransforms(base, [bad1, bad2, addB], ctx)).toEqual({
            msgtype: "m.text",
            body: "hi",
            b: 2,
        });
    });
});
