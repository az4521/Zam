import { describe, expect, it } from "vitest";
import { pickNameColour } from "./nameColour";

const pref = { on_dark: "#ffd9f5", on_light: "#440000" };

describe("pickNameColour", () => {
    it("uses the half matching the theme", () => {
        expect(pickNameColour(pref, "#1e1f22")).toBe("#ffd9f5");
        expect(pickNameColour(pref, "#ffffff")).toBe("#440000");
    });

    it("falls back to the other half when the matching one is unreadable", () => {
        expect(
            pickNameColour(
                { on_dark: "#111111", on_light: "#eeeeee" },
                "#1e1f22",
            ),
        ).toBe("#eeeeee");
    });

    it("gives up when nothing is readable or nothing is set", () => {
        expect(
            pickNameColour(
                { on_dark: "#202020", on_light: "#222222" },
                "#1e1f22",
            ),
        ).toBeNull();
        expect(pickNameColour(null, "#1e1f22")).toBeNull();
        expect(pickNameColour(pref, "nope")).toBeNull();
    });
});
