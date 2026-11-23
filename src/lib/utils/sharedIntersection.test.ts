import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { observeShared } from "./sharedIntersection";

const instances: FakeIO[] = [];

class FakeIO {
    readonly targets = new Set<Element>();
    disconnected = false;
    constructor(
        readonly cb: IntersectionObserverCallback,
        readonly options?: IntersectionObserverInit,
    ) {
        instances.push(this);
    }
    observe(el: Element) {
        this.targets.add(el);
    }
    unobserve(el: Element) {
        this.targets.delete(el);
    }
    disconnect() {
        this.disconnected = true;
        this.targets.clear();
    }
}

describe("observeShared", () => {
    const unobserves: Array<() => void> = [];

    beforeEach(() => {
        instances.length = 0;
        vi.stubGlobal("IntersectionObserver", FakeIO);
    });
    afterEach(() => {
        for (const u of unobserves.splice(0)) u();
        vi.unstubAllGlobals();
    });

    it("shares one observer across targets with the same root and margin", () => {
        const a = document.createElement("div");
        const b = document.createElement("div");
        unobserves.push(observeShared(a, null, "100% 0px", () => {}));
        unobserves.push(observeShared(b, null, "100% 0px", () => {}));
        expect(instances).toHaveLength(1);
        expect(instances[0].targets.size).toBe(2);
    });

    it("uses a separate observer for another root", () => {
        const root = document.createElement("div");
        const a = document.createElement("div");
        unobserves.push(observeShared(a, null, "100% 0px", () => {}));
        unobserves.push(observeShared(a, root, "100% 0px", () => {}));
        expect(instances).toHaveLength(2);
    });

    it("routes each entry to its own target's listener", () => {
        const a = document.createElement("div");
        const b = document.createElement("div");
        const la = vi.fn();
        const lb = vi.fn();
        unobserves.push(observeShared(a, null, "m", la));
        unobserves.push(observeShared(b, null, "m", lb));
        instances[0].cb(
            [
                {
                    target: b,
                    isIntersecting: true,
                } as unknown as IntersectionObserverEntry,
            ],
            instances[0] as unknown as IntersectionObserver,
        );
        expect(la).not.toHaveBeenCalled();
        expect(lb).toHaveBeenCalledTimes(1);
    });

    it("disconnects when the last target unobserves, and is idempotent", () => {
        const a = document.createElement("div");
        const b = document.createElement("div");
        const ua = observeShared(a, null, "m", () => {});
        const ub = observeShared(b, null, "m", () => {});
        ua();
        ua();
        expect(instances[0].disconnected).toBe(false);
        ub();
        expect(instances[0].disconnected).toBe(true);
        // A new target after the pool is gone gets a fresh observer.
        unobserves.push(observeShared(a, null, "m", () => {}));
        expect(instances).toHaveLength(2);
    });
});
