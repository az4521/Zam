import { describe, it, expect } from "vitest";
import { micErrorMessage } from "./micErrorMessage";

const dom = (name: string) => new DOMException("raw browser text", name);

describe("micErrorMessage", () => {
    it("explains a blocked microphone permission", () => {
        const msg = micErrorMessage(dom("NotAllowedError"));
        expect(msg).toMatch(/microphone/i);
        expect(msg).toMatch(/settings/i);
        expect(msg).not.toContain("raw browser text");
    });

    it("treats SecurityError like a blocked permission", () => {
        expect(micErrorMessage(dom("SecurityError"))).toBe(
            micErrorMessage(dom("NotAllowedError")),
        );
    });

    it("explains a missing microphone", () => {
        const msg = micErrorMessage(dom("NotFoundError"));
        expect(msg).toMatch(/no microphone/i);
        expect(micErrorMessage(dom("OverconstrainedError"))).toBe(msg);
    });

    it("explains a microphone another app holds", () => {
        const msg = micErrorMessage(dom("NotReadableError"));
        expect(msg).toMatch(/another app/i);
    });

    it("returns null for errors that are not microphone failures", () => {
        expect(micErrorMessage(dom("AbortError"))).toBeNull();
        expect(micErrorMessage(new Error("NotAllowedError"))).toBeNull();
        expect(micErrorMessage({ name: "NotFoundError" })).toBeNull();
        expect(micErrorMessage(null)).toBeNull();
        expect(micErrorMessage("NotAllowedError")).toBeNull();
    });
});
