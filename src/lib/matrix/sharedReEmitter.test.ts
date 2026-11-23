import { EventEmitter } from "events";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ReEmitter, TypedReEmitter } from "matrix-js-sdk/lib/ReEmitter.js";
import { TypedEventEmitter } from "matrix-js-sdk/lib/models/typed-event-emitter.js";
import {
    MatrixEvent,
    MatrixEventEvent,
} from "matrix-js-sdk/lib/models/event.js";
import { installSharedReEmitter } from "./sharedReEmitter";

beforeAll(() => {
    installSharedReEmitter();
});

describe("installSharedReEmitter", () => {
    it("is idempotent", () => {
        const before = ReEmitter.prototype.reEmit;
        installSharedReEmitter();
        expect(ReEmitter.prototype.reEmit).toBe(before);
    });

    it("forwards (...args, source) for each source", () => {
        const target = new EventEmitter();
        const a = new EventEmitter();
        const b = new EventEmitter();
        const received = vi.fn();
        target.on("ev", received);

        const re = new ReEmitter(target);
        re.reEmit(a, ["ev"]);
        re.reEmit(b, ["ev"]);

        a.emit("ev", 1, "x");
        b.emit("ev", 2);

        expect(received).toHaveBeenNthCalledWith(1, 1, "x", a);
        expect(received).toHaveBeenNthCalledWith(2, 2, b);
    });

    it("shares one listener function across sources of the same ReEmitter", () => {
        const target = new EventEmitter();
        const a = new EventEmitter();
        const b = new EventEmitter();
        const re = new ReEmitter(target);
        re.reEmit(a, ["ev"]);
        re.reEmit(b, ["ev"]);

        const fa = a.listeners("ev")[0];
        const fb = b.listeners("ev")[0];
        expect(fa).toBeTypeOf("function");
        expect(fa).toBe(fb);
    });

    it("does not double-emit when reEmit is called twice", () => {
        const target = new EventEmitter();
        const source = new EventEmitter();
        const received = vi.fn();
        target.on("ev", received);

        const re = new ReEmitter(target);
        re.reEmit(source, ["ev"]);
        re.reEmit(source, ["ev"]);
        expect(source.listenerCount("ev")).toBe(1);

        source.emit("ev", "once");
        expect(received).toHaveBeenCalledTimes(1);
        expect(received).toHaveBeenCalledWith("once", source);
    });

    it("stopReEmitting stops only that event for that source", () => {
        const target = new EventEmitter();
        const a = new EventEmitter();
        const b = new EventEmitter();
        const received = vi.fn();
        target.on("x", received);
        target.on("y", received);

        const re = new ReEmitter(target);
        re.reEmit(a, ["x", "y"]);
        re.reEmit(b, ["x"]);

        re.stopReEmitting(a, ["x"]);

        a.emit("x", "a-x"); // stopped
        a.emit("y", "a-y"); // still forwarded
        b.emit("x", "b-x"); // other source still forwarded

        expect(received.mock.calls).toEqual([
            ["a-y", a],
            ["b-x", b],
        ]);
    });

    it("stopReEmitting on a source never re-emitted is a no-op", () => {
        const target = new EventEmitter();
        const source = new EventEmitter();
        const re = new ReEmitter(target);
        expect(() => re.stopReEmitting(source, ["ev"])).not.toThrow();
        expect(source.listenerCount("ev")).toBe(0);
    });

    it("re-emitting 'error' with no target error listener does not throw", () => {
        const target = new EventEmitter();
        const source = new EventEmitter();
        const re = new ReEmitter(target);
        re.reEmit(source, ["error"]);

        expect(() => source.emit("error", new Error("boom"))).not.toThrow();
    });

    it("re-emitting 'error' reaches a target error listener with the source", () => {
        const target = new EventEmitter();
        const source = new EventEmitter();
        const onError = vi.fn();
        target.on("error", onError);
        const re = new ReEmitter(target);
        re.reEmit(source, ["error"]);

        const err = new Error("boom");
        source.emit("error", err);
        expect(onError).toHaveBeenCalledWith(err, source);
    });

    it("works through TypedReEmitter with a real MatrixEvent", () => {
        const target = new TypedEventEmitter<any, any>();
        const reEmitter = new TypedReEmitter<any, any>(target);
        const event = new MatrixEvent({
            type: "m.room.message",
            event_id: "$e1",
            room_id: "!room:example.org",
            sender: "@alice:example.org",
            content: { body: "hi" },
        });
        const received = vi.fn();
        target.on(MatrixEventEvent.Decrypted, received);

        reEmitter.reEmit(event as any, [MatrixEventEvent.Decrypted]);
        (event as unknown as EventEmitter).emit(
            MatrixEventEvent.Decrypted,
            event,
            undefined,
        );

        expect(received).toHaveBeenCalledTimes(1);
        expect(received.mock.calls[0][0]).toBe(event);
        expect(received.mock.calls[0][received.mock.calls[0].length - 1]).toBe(
            event,
        );

        reEmitter.stopReEmitting(event as any, [MatrixEventEvent.Decrypted]);
        (event as unknown as EventEmitter).emit(
            MatrixEventEvent.Decrypted,
            event,
            undefined,
        );
        expect(received).toHaveBeenCalledTimes(1);
    });
});
