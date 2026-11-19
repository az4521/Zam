import { describe, expect, it } from "vitest";
import {
    LAYER_HOLD_MAX_MS,
    LAYER_HOLD_MIN_MS,
    ShareLayerHold,
} from "./shareLayerHold";

const ok = { loss: 0, stalled: false };
const bad = { loss: 0.3, stalled: false };

describe("ShareLayerHold", () => {
    it("stays high while the share arrives fine", () => {
        const h = new ShareLayerHold(0);
        for (let t = 1000; t < 60_000; t += 1000)
            expect(h.sample(ok, t)).toBeNull();
        expect(h.current()).toBe("high");
    });

    it("drops to low after two struggling seconds, not one", () => {
        const h = new ShareLayerHold(0);
        expect(h.sample(bad, 40_000)).toBeNull();
        expect(h.sample(bad, 41_000)).toBe("low");
    });

    it("doesn't probe while the low layer itself struggles", () => {
        const h = new ShareLayerHold(0);
        h.sample(bad, 40_000);
        h.sample(bad, 41_000);
        const due = 41_000 + LAYER_HOLD_MIN_MS;
        expect(h.sample(bad, due)).toBeNull();
        expect(h.sample(bad, due + 5000)).toBeNull();
        expect(h.sample(ok, due + 6000)).toBe("high");
    });

    it("says how long it has held low", () => {
        const h = new ShareLayerHold(0);
        expect(h.heldLowFor(5000)).toBe(0);
        h.sample(bad, 40_000);
        h.sample(bad, 41_000);
        expect(h.heldLowFor(45_000)).toBe(4000);
    });

    it("treats a stuck picture as struggling", () => {
        const h = new ShareLayerHold(0);
        h.sample({ loss: 0, stalled: true }, 40_000);
        expect(h.sample({ loss: 0, stalled: true }, 41_000)).toBe("low");
    });

    it("holds low, then probes high", () => {
        const h = new ShareLayerHold(0);
        h.sample(bad, 40_000);
        h.sample(bad, 41_000);
        expect(h.sample(ok, 41_000 + LAYER_HOLD_MIN_MS - 1)).toBeNull();
        expect(h.sample(ok, 41_000 + LAYER_HOLD_MIN_MS)).toBe("high");
    });

    it("doubles the hold when a probe fails at once, up to the max", () => {
        const h = new ShareLayerHold(0);
        let t = 40_000;
        h.sample(bad, t);
        h.sample(bad, (t += 1000));
        let hold = LAYER_HOLD_MIN_MS;
        for (let i = 0; i < 8; i++) {
            t += hold;
            expect(h.sample(ok, t)).toBe("high"); // probe
            h.sample(bad, (t += 1000));
            expect(h.sample(bad, (t += 1000))).toBe("low"); // failed probe
            hold = Math.min(LAYER_HOLD_MAX_MS, hold * 2);
            expect(h.sample(ok, t + hold - 1)).toBeNull();
        }
        expect(hold).toBe(LAYER_HOLD_MAX_MS);
    });

    it("starts the hold over after a long calm stay on high", () => {
        const h = new ShareLayerHold(0);
        let t = 40_000;
        h.sample(bad, t);
        h.sample(bad, (t += 1000));
        t += LAYER_HOLD_MIN_MS;
        h.sample(ok, t); // probe
        h.sample(bad, (t += 1000));
        h.sample(bad, (t += 1000)); // failed: hold now 30 s
        t += 2 * LAYER_HOLD_MIN_MS;
        h.sample(ok, t); // probe again
        for (let i = 0; i < 40; i++) h.sample(ok, (t += 1000)); // settled
        h.sample(bad, (t += 1000));
        expect(h.sample(bad, (t += 1000))).toBe("low");
        expect(h.sample(ok, t + LAYER_HOLD_MIN_MS)).toBe("high");
    });
});
