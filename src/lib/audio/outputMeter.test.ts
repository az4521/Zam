import { describe, it, expect } from "vitest";
import { streamSetKey } from "./outputMeter";

describe("streamSetKey", () => {
    it("is empty for no streams", () => {
        expect(streamSetKey([])).toBe("");
    });

    it("ignores stream order", () => {
        expect(streamSetKey([{ id: "b" }, { id: "a" }])).toBe(
            streamSetKey([{ id: "a" }, { id: "b" }]),
        );
    });

    it("changes when a stream joins or leaves", () => {
        const two = streamSetKey([{ id: "a" }, { id: "b" }]);
        expect(streamSetKey([{ id: "a" }])).not.toBe(two);
        expect(streamSetKey([{ id: "a" }, { id: "b" }, { id: "c" }])).not.toBe(
            two,
        );
    });

    it("does not collide when ids contain the separator", () => {
        expect(streamSetKey([{ id: "a,b" }])).not.toBe(
            streamSetKey([{ id: "a" }, { id: "b" }]),
        );
    });
});
