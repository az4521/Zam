import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./async";

describe("mapWithConcurrency", () => {
    it("processes every value without exceeding the worker limit", async () => {
        let active = 0;
        let peak = 0;
        const completed: number[] = [];

        await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (value) => {
            active++;
            peak = Math.max(peak, active);
            await Promise.resolve();
            completed.push(value);
            active--;
        });

        expect(peak).toBe(2);
        expect(completed.sort()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("accepts undefined as a real queue value", async () => {
        const completed: Array<number | undefined> = [];
        await mapWithConcurrency([undefined, 1], 1, async (value) => {
            completed.push(value);
        });
        expect(completed).toEqual([undefined, 1]);
    });
});
