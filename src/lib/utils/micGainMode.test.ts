import { describe, it, expect } from "vitest";
import { normalizeMicGainMode, browserAgcFor } from "./micGainMode";

describe("normalizeMicGainMode", () => {
    it("keeps a stored mode", () => {
        expect(normalizeMicGainMode("zam", false)).toBe("zam");
        expect(normalizeMicGainMode("browser", false)).toBe("browser");
        expect(normalizeMicGainMode("off", true)).toBe("off");
    });
    it("migrates the legacy boolean: on becomes Zam's leveller, off stays off", () => {
        expect(normalizeMicGainMode(null, true)).toBe("zam");
        expect(normalizeMicGainMode(null, false)).toBe("off");
    });
    it("treats garbage like nothing stored", () => {
        expect(normalizeMicGainMode("loud", true)).toBe("zam");
    });
});

describe("browserAgcFor", () => {
    it("only asks the browser for AGC in browser mode", () => {
        expect(browserAgcFor("browser")).toBe(true);
        expect(browserAgcFor("zam")).toBe(false);
        expect(browserAgcFor("off")).toBe(false);
    });
});
