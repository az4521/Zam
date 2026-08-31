import { describe, it, expect } from "vitest";
import { resolveSwipeAction } from "./swipeResolve";

describe("resolveSwipeAction (plugin)", () => {
    it("disabled → none for any input", () => {
        expect(resolveSwipeAction("short", true, false)).toBe("none");
        expect(resolveSwipeAction("far", true, false)).toBe("none");
    });
    it("short → reply", () => {
        expect(resolveSwipeAction("short", true, true)).toBe("reply");
        expect(resolveSwipeAction("short", false, true)).toBe("reply");
    });
    it("far + own → edit", () => {
        expect(resolveSwipeAction("far", true, true)).toBe("edit");
    });
    it("far + not own → reply (no edit on others' messages)", () => {
        expect(resolveSwipeAction("far", false, true)).toBe("reply");
    });
});
