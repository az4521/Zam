import { describe, it, expect, vi } from "vitest";
import { dispatchDoubleTap, dispatchPluginEvent } from "./pluginDispatch";
import type { EventSubscription } from "./types";

const tapCtx = { roomId: "!r:s", eventId: "$e", isOwn: true };

describe("dispatchDoubleTap", () => {
    it("calls every handler with the ctx", () => {
        const a = vi.fn();
        const b = vi.fn();
        dispatchDoubleTap([a, b], tapCtx);
        expect(a).toHaveBeenCalledWith(tapCtx);
        expect(b).toHaveBeenCalledWith(tapCtx);
    });
    it("keeps calling handlers after one throws", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const boom = vi.fn(() => {
            throw new Error("boom");
        });
        const after = vi.fn();
        dispatchDoubleTap([boom, after], tapCtx);
        expect(after).toHaveBeenCalledOnce();
    });
    it("no-ops on empty handlers", () => {
        expect(() => dispatchDoubleTap([], tapCtx)).not.toThrow();
    });
});

describe("dispatchPluginEvent", () => {
    it("calls only subs whose event matches, with the payload", () => {
        const msg = vi.fn();
        const other = vi.fn();
        const subs: EventSubscription[] = [
            { event: "message", handler: msg },
            { event: "sync", handler: other },
        ];
        dispatchPluginEvent(subs, "message", { roomId: "!r:s" });
        expect(msg).toHaveBeenCalledWith({ roomId: "!r:s" });
        expect(other).not.toHaveBeenCalled();
    });
    it("keeps dispatching after one handler throws", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const boom = vi.fn(() => {
            throw new Error("boom");
        });
        const after = vi.fn();
        const subs: EventSubscription[] = [
            { event: "message", handler: boom },
            { event: "message", handler: after },
        ];
        dispatchPluginEvent(subs, "message", null);
        expect(after).toHaveBeenCalledOnce();
    });
});
