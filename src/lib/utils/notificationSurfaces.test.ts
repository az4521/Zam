import { describe, it, expect, vi, beforeEach, onTestFinished } from "vitest";
import {
    registerNotificationSurface,
    clearAllNotificationSurfaces,
    notificationSurfaceCount,
} from "./notificationSurfaces";

describe("notification surface registry", () => {
    beforeEach(() => {
        // Real isolation guard: every test unregisters what it registers, and a
        // leak would otherwise only surface as a confusing failure several tests
        // later. The plan's original drain loop was a no-op.
        expect(notificationSurfaceCount()).toBe(0);
    });

    it("runs every registered surface when asked to clear", () => {
        const a = vi.fn();
        const b = vi.fn();
        const offA = registerNotificationSurface(a);
        onTestFinished(offA);
        const offB = registerNotificationSurface(b);
        onTestFinished(offB);

        expect(notificationSurfaceCount()).toBe(2);

        clearAllNotificationSurfaces();

        expect(a).toHaveBeenCalledTimes(1);
        expect(b).toHaveBeenCalledTimes(1);
    });

    it("keeps going when one surface throws, so a broken surface cannot strand the others", () => {
        const order: string[] = [];
        const offA = registerNotificationSurface(() => {
            order.push("a");
            throw new Error("page notifications unsupported");
        });
        onTestFinished(offA);
        const offB = registerNotificationSurface(() => {
            order.push("b");
        });
        onTestFinished(offB);

        expect(() => clearAllNotificationSurfaces()).not.toThrow();
        expect(order).toEqual(["a", "b"]);
    });

    it("stops running a surface once it is unregistered", () => {
        const a = vi.fn();
        const off = registerNotificationSurface(a);
        onTestFinished(off);
        off();

        clearAllNotificationSurfaces();

        expect(a).not.toHaveBeenCalled();
    });

    it("has an idempotent unregister that cannot remove a later registration", () => {
        const a = vi.fn();
        const b = vi.fn();
        const offA = registerNotificationSurface(a);
        onTestFinished(offA);
        offA();
        const offB = registerNotificationSurface(b);
        onTestFinished(offB);
        offA();

        clearAllNotificationSurfaces();

        expect(a).not.toHaveBeenCalled();
        expect(b).toHaveBeenCalledTimes(1);
    });

    it("registers the same function twice as two surfaces and unregisters them independently", () => {
        const a = vi.fn();
        const off1 = registerNotificationSurface(a);
        onTestFinished(off1);
        const off2 = registerNotificationSurface(a);
        onTestFinished(off2);

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

    it("clears surfaces registered after an earlier clear, and keeps clearing them", () => {
        const a = vi.fn();
        clearAllNotificationSurfaces();
        const off = registerNotificationSurface(a);
        onTestFinished(off);

        clearAllNotificationSurfaces();
        expect(a).toHaveBeenCalledTimes(1);

        // The registry must SURVIVE a clear: session expiry calls
        // clearAllNotificationSurfaces() without a page reload while AppShell's
        // registration is still live, so a clear that drained the registry would
        // silently no-op every later clear for the rest of the page's lifetime.
        clearAllNotificationSurfaces();
        expect(a).toHaveBeenCalledTimes(2);
    });

    it("does not observe a surface registered during the clear itself", () => {
        const late = vi.fn();
        let offLate: (() => void) | undefined;
        const off = registerNotificationSurface(() => {
            offLate = registerNotificationSurface(late);
        });
        onTestFinished(off);
        // The inner registration happens mid-clear, so its unregister only
        // exists after the clear — hoist it out or it leaks into later tests.
        onTestFinished(() => offLate?.());

        clearAllNotificationSurfaces();

        expect(late).not.toHaveBeenCalled();
    });
});
