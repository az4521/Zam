import { describe, it, expect } from "vitest";
import { planShareSend, shareRemainder } from "./shareSend";

describe("planShareSend", () => {
    it("plans files + caption: caption on first step only, trimmed", () => {
        const f1 = new File([new Uint8Array([1])], "a.png");
        const f2 = new File([new Uint8Array([2])], "b.png");
        const steps = planShareSend({
            caption: "  Hello world  ",
            files: [f1, f2],
        });
        expect(steps).toEqual([
            { kind: "file", file: f1, caption: "Hello world" },
            { kind: "file", file: f2, caption: null },
        ]);
    });

    it("plans files without caption: no caption on any step", () => {
        const f1 = new File([new Uint8Array([1])], "a.png");
        const f2 = new File([new Uint8Array([2])], "b.png");
        const steps = planShareSend({ caption: "", files: [f1, f2] });
        expect(steps).toEqual([
            { kind: "file", file: f1, caption: null },
            { kind: "file", file: f2, caption: null },
        ]);
    });

    it("plans text-only: one text step when caption is non-empty", () => {
        const steps = planShareSend({ caption: "Just text", files: [] });
        expect(steps).toEqual([{ kind: "text", text: "Just text" }]);
    });

    it("plans whitespace-only text as empty array", () => {
        const steps = planShareSend({ caption: "   \n  \t  ", files: [] });
        expect(steps).toEqual([]);
    });

    it("plans empty caption + no files as empty array", () => {
        const steps = planShareSend({ caption: "", files: [] });
        expect(steps).toEqual([]);
    });

    it("trims caption for text-only share", () => {
        const steps = planShareSend({ caption: "  trimmed  ", files: [] });
        expect(steps).toEqual([{ kind: "text", text: "trimmed" }]);
    });
});

describe("shareRemainder", () => {
    const f1 = new File([new Uint8Array([1])], "a.png");
    const f2 = new File([new Uint8Array([2])], "b.png");
    const f3 = new File([new Uint8Array([3])], "c.png");

    it("returns all files + caption when sentCount is 0", () => {
        const steps = planShareSend({ caption: "Hello", files: [f1, f2] });
        const remainder = shareRemainder(steps, 0);
        expect(remainder).toEqual({ text: "Hello", files: [f1, f2] });
    });

    it("returns remaining files after step 0 sent (caption considered sent)", () => {
        const steps = planShareSend({ caption: "Hello", files: [f1, f2] });
        const remainder = shareRemainder(steps, 1);
        expect(remainder).toEqual({ text: "", files: [f2] });
    });

    it("returns empty when all steps sent", () => {
        const steps = planShareSend({ caption: "Hello", files: [f1, f2] });
        const remainder = shareRemainder(steps, 2);
        expect(remainder).toEqual({ text: "", files: [] });
    });

    it("handles partial failure with multiple files", () => {
        const steps = planShareSend({ caption: "Cap", files: [f1, f2, f3] });
        const remainder = shareRemainder(steps, 2); // f1 and f2 sent
        expect(remainder).toEqual({ text: "", files: [f3] });
    });

    it("returns only files when no caption was present", () => {
        const steps = planShareSend({ caption: "", files: [f1, f2] });
        const remainder = shareRemainder(steps, 1); // f1 sent
        expect(remainder).toEqual({ text: "", files: [f2] });
    });

    it("returns empty text for text-only share after sent", () => {
        const steps = planShareSend({ caption: "Text only", files: [] });
        const remainder = shareRemainder(steps, 1);
        expect(remainder).toEqual({ text: "", files: [] });
    });

    it("returns the text for text-only share when not sent", () => {
        const steps = planShareSend({ caption: "Text only", files: [] });
        const remainder = shareRemainder(steps, 0);
        expect(remainder).toEqual({ text: "Text only", files: [] });
    });

    it("handles empty plan (returns empty)", () => {
        const steps = planShareSend({ caption: "", files: [] });
        const remainder = shareRemainder(steps, 0);
        expect(remainder).toEqual({ text: "", files: [] });
    });
});
