import { describe, it, expect, vi } from "vitest";
import {
    dispatchDoubleTap,
    dispatchPluginEvent,
    dispatchSwipe,
} from "./pluginDispatch";
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

describe("dispatchSwipe", () => {
    it("fans out to every handler with the context", () => {
        const seen: unknown[] = [];
        dispatchSwipe([(c) => seen.push(c), (c) => seen.push(c)], {
            roomId: "!r",
            eventId: "$e",
            isOwn: true,
            threshold: "far",
        });
        expect(seen).toHaveLength(2);
        expect(seen[0]).toEqual({
            roomId: "!r",
            eventId: "$e",
            isOwn: true,
            threshold: "far",
        });
    });
    it("isolates a throwing handler so later handlers still run", () => {
        const seen: string[] = [];
        dispatchSwipe(
            [
                () => {
                    throw new Error("boom");
                },
                () => seen.push("ran"),
            ],
            { roomId: "!r", eventId: "$e", isOwn: false, threshold: "short" },
        );
        expect(seen).toEqual(["ran"]);
    });
});
