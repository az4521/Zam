import { describe, expect, it } from "vitest";
import { ShareLayerHold } from "./shareLayerHold";

const ok = { loss: 0, stalled: false };
const bad = { loss: 0.3, stalled: false };
const stuck = { loss: 0, stalled: true };

describe("ShareLayerHold", () => {
    it("stays high while the share arrives fine", () => {
        const h = new ShareLayerHold();
        for (let t = 1000; t < 60_000; t += 1000)
            expect(h.sample(ok, t)).toBeNull();
        expect(h.current()).toBe("high");
    });

    it("rides out a blip of a second or two", () => {
        const h = new ShareLayerHold();
        let t = 0;
        for (const s of [ok, bad, bad, ok, ok, ok, stuck, ok, ok, ok])
            expect(h.sample(s, (t += 1000))).toBeNull();
        expect(h.holdingLow()).toBe(false);
    });

    it("drops to low after three struggling seconds out of five", () => {
        const h = new ShareLayerHold();
        expect(h.sample(bad, 1000)).toBeNull();
        expect(h.sample(ok, 2000)).toBeNull();
        expect(h.sample(stuck, 3000)).toBeNull();
        expect(h.sample(bad, 4000)).toBe("low");
        expect(h.heldLowFor(10_000)).toBe(6000);
    });

    it("never probes back up: no visible freeze from a failed probe", () => {
        const h = new ShareLayerHold();
        h.sample(bad, 1000);
        h.sample(bad, 2000);
        h.sample(bad, 3000);
        for (let t = 4000; t < 3_600_000; t += 1000)
            expect(h.sample(ok, t)).toBeNull();
        expect(h.current()).toBe("low");
    });
});
