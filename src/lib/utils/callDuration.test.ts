import { describe, it, expect } from "vitest";
import { formatCallDuration } from "./callDuration";

describe("formatCallDuration", () => {
    it("formats under a minute", () => {
        expect(formatCallDuration(0)).toBe("00:00");
        expect(formatCallDuration(48_000)).toBe("00:48");
    });
    it("formats minutes and seconds", () => {
        expect(formatCallDuration(61_000)).toBe("01:01");
        expect(formatCallDuration(59 * 60_000 + 59_000)).toBe("59:59");
    });
    it("rolls to h:mm:ss past an hour", () => {
        expect(formatCallDuration(3_600_000)).toBe("1:00:00");
        expect(formatCallDuration(3_661_000)).toBe("1:01:01");
        expect(formatCallDuration(36_000_000)).toBe("10:00:00");
    });
    it("floors partial seconds and clamps negatives", () => {
        expect(formatCallDuration(1_999)).toBe("00:01");
        expect(formatCallDuration(-5_000)).toBe("00:00");
    });
});
