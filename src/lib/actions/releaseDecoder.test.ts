import { describe, it, expect, vi } from "vitest";
import { releaseDecoder } from "./releaseDecoder";

describe("releaseDecoder", () => {
    it("drops the src and reloads the element when its owner unmounts it", () => {
        const node = document.createElement("video");
        node.setAttribute("src", "blob:x");
        node.load = vi.fn();
        node.pause = vi.fn();
        const action = releaseDecoder(node);
        expect(node.getAttribute("src")).toBe("blob:x");
        action.destroy();
        expect(node.getAttribute("src")).toBeNull();
        expect(node.pause).toHaveBeenCalled();
        expect(node.load).toHaveBeenCalledTimes(1);
    });
});
