import { describe, it, expect } from "vitest";
import {
    PUSH_TAG_FIELD,
    isValidPushTag,
    newPushTag,
    pushTagPayload,
} from "./pushTag";

describe("push tags", () => {
    it("generates valid, distinct tags that are not user ids", () => {
        const a = newPushTag();
        const b = newPushTag();
        expect(isValidPushTag(a)).toBe(true);
        expect(a).toHaveLength(22);
        expect(a).not.toBe(b);
        expect(a.startsWith("@")).toBe(false);
    });

    it("rejects user ids, short strings and non-strings", () => {
        for (const bad of [
            "@alice:example.org",
            "short",
            "",
            null,
            42,
            "has spaces in it here",
        ]) {
            expect(isValidPushTag(bad)).toBe(false);
        }
    });

    it("puts only the tag in the payload, and nothing without one", () => {
        const tag = newPushTag();
        expect(pushTagPayload(tag)).toEqual({
            default_payload: { [PUSH_TAG_FIELD]: tag },
        });
        expect(pushTagPayload(null)).toEqual({});
        expect(pushTagPayload("@alice:example.org")).toEqual({});
    });
});
