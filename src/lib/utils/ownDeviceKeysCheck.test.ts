import { describe, expect, it } from "vitest";
import { ownKeysCheckMode } from "./ownDeviceKeysCheck";

describe("ownKeysCheckMode", () => {
    it("defers only when the recorded key matches the opened store", () => {
        expect(ownKeysCheckMode("abc", "abc")).toBe("background");
    });

    it("blocks on first boot, when there is no record", () => {
        expect(ownKeysCheckMode(null, "abc")).toBe("blocking");
        expect(ownKeysCheckMode(undefined, "abc")).toBe("blocking");
        expect(ownKeysCheckMode("", "abc")).toBe("blocking");
    });

    it("blocks when the recorded key disagrees with the store", () => {
        expect(ownKeysCheckMode("abc", "xyz")).toBe("blocking");
    });

    it("blocks when the store reports no key", () => {
        expect(ownKeysCheckMode("abc", null)).toBe("blocking");
        expect(ownKeysCheckMode("abc", undefined)).toBe("blocking");
    });
});
