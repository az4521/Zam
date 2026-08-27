import { describe, it, expect } from "vitest";
import { resolveDoubleTapAction, isActive } from "./resolve";

describe("resolveDoubleTapAction", () => {
    it("returns the own action for own messages", () => {
        expect(resolveDoubleTapAction(true, "reply", "reaction")).toBe("reply");
        expect(resolveDoubleTapAction(true, "edit", "none")).toBe("edit");
        expect(resolveDoubleTapAction(true, "reaction", "none")).toBe(
            "reaction",
        );
    });
    it("returns the other action for other messages", () => {
        expect(resolveDoubleTapAction(false, "edit", "reply")).toBe("reply");
        expect(resolveDoubleTapAction(false, "reply", "reaction")).toBe(
            "reaction",
        );
    });
    it("maps edit to none for other messages (cannot edit others)", () => {
        expect(resolveDoubleTapAction(false, "reply", "edit")).toBe("none");
    });
    it("coerces unknown / empty strings to none", () => {
        expect(resolveDoubleTapAction(true, "bogus", "none")).toBe("none");
        expect(resolveDoubleTapAction(true, "", "none")).toBe("none");
        expect(resolveDoubleTapAction(false, "none", "")).toBe("none");
    });
    it("none/none resolves to none for both", () => {
        expect(resolveDoubleTapAction(true, "none", "none")).toBe("none");
        expect(resolveDoubleTapAction(false, "none", "none")).toBe("none");
    });
});

describe("isActive", () => {
    it("is false only when both sides are none/invalid", () => {
        expect(isActive("none", "none")).toBe(false);
        expect(isActive("", "bogus")).toBe(false);
    });
    it("is true when own has a real action", () => {
        expect(isActive("reply", "none")).toBe(true);
        expect(isActive("edit", "none")).toBe(true);
    });
    it("is true when other has a real action", () => {
        expect(isActive("none", "reaction")).toBe(true);
    });
    it("treats other=edit alone as inactive (edit maps to none for others)", () => {
        expect(isActive("none", "edit")).toBe(false);
    });
});
