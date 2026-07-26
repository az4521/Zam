import { describe, it, expect } from "vitest";
import { createBackfillGate } from "./backfillGate";

describe("createBackfillGate — a swallowed backfill request is remembered, not lost", () => {
    it("lets the first caller in", () => {
        const gate = createBackfillGate();
        expect(gate.tryEnter()).toBe(true);
    });

    it("turns a second caller away while the first holds the gate", () => {
        const gate = createBackfillGate();
        gate.tryEnter();
        expect(gate.tryEnter()).toBe(false);
    });

    it("tells the holder to re-run when a request was turned away", () => {
        const gate = createBackfillGate();
        gate.tryEnter();
        gate.tryEnter(); // swallowed — this is the request that used to vanish
        expect(gate.exit()).toBe(true);
    });

    it("tells the holder nothing to re-run when no request was turned away", () => {
        const gate = createBackfillGate();
        gate.tryEnter();
        expect(gate.exit()).toBe(false);
    });

    it("is free again after exit, so the re-run can enter", () => {
        const gate = createBackfillGate();
        gate.tryEnter();
        gate.tryEnter();
        expect(gate.exit()).toBe(true);
        expect(gate.tryEnter()).toBe(true);
    });

    it("coalesces several swallowed requests into a single re-run", () => {
        const gate = createBackfillGate();
        gate.tryEnter();
        gate.tryEnter();
        gate.tryEnter();
        gate.tryEnter();
        expect(gate.exit()).toBe(true);
        // The re-run enters, finds nothing further pending, and stops there —
        // otherwise a burst of swallowed calls would loop.
        expect(gate.tryEnter()).toBe(true);
        expect(gate.exit()).toBe(false);
    });

    it("remembers a request swallowed during the re-run itself", () => {
        const gate = createBackfillGate();
        gate.tryEnter();
        gate.tryEnter();
        expect(gate.exit()).toBe(true);
        gate.tryEnter(); // the re-run
        gate.tryEnter(); // swallowed again mid-re-run
        expect(gate.exit()).toBe(true);
    });

    it("is independent per gate instance", () => {
        const a = createBackfillGate();
        const b = createBackfillGate();
        a.tryEnter();
        expect(b.tryEnter()).toBe(true);
        expect(a.exit()).toBe(false);
    });
});
