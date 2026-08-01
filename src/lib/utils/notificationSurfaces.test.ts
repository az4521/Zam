import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    registerNotificationSurface,
    clearAllNotificationSurfaces,
    notificationSurfaceCount,
} from "./notificationSurfaces";

describe("notification surface registry", () => {
    beforeEach(() => {
        // Registry is module state; drain it so tests do not leak into each other.
        while (notificationSurfaceCount() > 0) {
            const drain = registerNotificationSurface(() => {});
            drain();
            // registering+unregistering cannot drain others, so clear via unregisters
            break;
        }
    });

    it("runs every registered surface when asked to clear", () => {
        const a = vi.fn();
        const b = vi.fn();
        const offA = registerNotificationSurface(a);
        const offB = registerNotificationSurface(b);

        clearAllNotificationSurfaces();

        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
        offA();
        offB();
    });

    it("keeps going when one surface throws, so a broken surface cannot strand the others", () => {
        const order: string[] = [];
        const offA = registerNotificationSurface(() => {
            order.push("a");
            throw new Error("page notifications unsupported");
        });
        const offB = registerNotificationSurface(() => {
            order.push("b");
        });

        expect(() => clearAllNotificationSurfaces()).not.toThrow();
        expect(order).toEqual(["a", "b"]);
        offA();
        offB();
    });

    it("stops running a surface once it is unregistered", () => {
        const a = vi.fn();
        const off = registerNotificationSurface(a);
        off();

        clearAllNotificationSurfaces();

        expect(a).not.toHaveBeenCalled();
    });

    it("has an idempotent unregister that cannot remove a later registration", () => {
        const a = vi.fn();
        const b = vi.fn();
        const offA = registerNotificationSurface(a);
        offA();
        const offB = registerNotificationSurface(b);
        offA();

        clearAllNotificationSurfaces();

        expect(a).not.toHaveBeenCalled();
        expect(b).toHaveBeenCalledTimes(1);
        offB();
    });

    it("registers the same function twice as two surfaces and unregisters them independently", () => {
        const a = vi.fn();
        const off1 = registerNotificationSurface(a);
        const off2 = registerNotificationSurface(a);

        off1();
        clearAllNotificationSurfaces();
        expect(a).toHaveBeenCalledTimes(1);

        off2();
        clearAllNotificationSurfaces();
        expect(a).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when nothing is registered", () => {
        expect(notificationSurfaceCount()).toBe(0);
        expect(() => clearAllNotificationSurfaces()).not.toThrow();
    });

    it("clears surfaces registered after an earlier clear", () => {
        const a = vi.fn();
        clearAllNotificationSurfaces();
        const off = registerNotificationSurface(a);
        clearAllNotificationSurfaces();
        expect(a).toHaveBeenCalledTimes(1);
        off();
    });

    it("does not observe a surface registered during the clear itself", () => {
        const late = vi.fn();
        const off = registerNotificationSurface(() => {
            registerNotificationSurface(late);
        });

        clearAllNotificationSurfaces();

        expect(late).not.toHaveBeenCalled();
        off();
    });
});
