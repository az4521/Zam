import { describe, expect, it, vi } from "vitest";
import { StreamSink } from "./fileTransferStream";

const block = (size: number, value = 1) =>
    new Uint8Array(size).fill(value) as Uint8Array<ArrayBuffer>;

function sinkOf(size: number) {
    const sent: { type: string; data?: Uint8Array }[] = [];
    const onEnd = vi.fn();
    const sink = new StreamSink(size, (message) => sent.push(message), onEnd);
    const chunks = () =>
        sent.filter((m) => m.type === "chunk").map((m) => m.data![0]);
    return { sink, sent, chunks, onEnd };
}

describe("StreamSink", () => {
    it("sends blocks in file order, whatever order they land in", async () => {
        const { sink, chunks } = sinkOf(40);
        for (let i = 0; i < 4; i++) sink.pull();
        await sink.write(20, block(10, 3));
        await sink.write(0, block(10, 1));
        await sink.write(10, block(10, 2));
        expect(chunks()).toEqual([1, 2, 3]);
    });

    it("sends only what the worker asked for", async () => {
        const { sink, chunks } = sinkOf(40);
        sink.pull();
        await sink.write(0, block(10, 1));
        await sink.write(10, block(10, 2));
        expect(chunks()).toEqual([1]);
        sink.pull();
        expect(chunks()).toEqual([1, 2]);
    });

    it("holds the last block back until the hash has passed", async () => {
        const { sink, sent, chunks } = sinkOf(20);
        sink.pull();
        sink.pull();
        await sink.write(0, block(10, 1));
        await sink.write(10, block(10, 2));
        expect(chunks()).toEqual([1]);
        await sink.finish();
        expect(chunks()).toEqual([1, 2]);
        expect(sent.at(-1)).toEqual({ type: "done" });
    });

    it("waits for the worker before calling a file finished", async () => {
        const { sink, sent } = sinkOf(10);
        await sink.write(0, block(10));
        let finished = false;
        const finishing = sink.finish().then(() => (finished = true));
        await Promise.resolve();
        expect(finished).toBe(false);
        sink.pull();
        await finishing;
        expect(sent.at(-1)).toEqual({ type: "done" });
    });

    it("finishes an empty file", async () => {
        const { sink, sent } = sinkOf(0);
        await sink.write(0, block(0));
        await sink.finish();
        expect(sent).toEqual([{ type: "done" }]);
    });

    it("never sends the last block of a file that failed its hash", async () => {
        const { sink, sent, chunks, onEnd } = sinkOf(20);
        sink.pull();
        sink.pull();
        await sink.write(0, block(10, 1));
        await sink.write(10, block(10, 2));
        await sink.abort();
        expect(chunks()).toEqual([1]);
        expect(sent.at(-1)).toEqual({ type: "error" });
        expect(onEnd).toHaveBeenCalled();
    });

    it("stops taking blocks when too many wait behind a gap", async () => {
        const size = 100 * 10;
        const { sink } = sinkOf(size);
        for (let i = 0; i < 100; i++) sink.pull();
        let settled = 0;
        for (let i = 1; i <= 45; i++)
            void sink.write(i * 10, block(10)).then(() => settled++);
        await new Promise((r) => setTimeout(r));
        expect(settled).toBe(40);
        await sink.write(0, block(10));
        await new Promise((r) => setTimeout(r));
        expect(settled).toBe(45);
    });

    it("fails writes once the download has gone", async () => {
        const { sink, onEnd } = sinkOf(20);
        sink.fail(new Error("download cancelled"));
        await expect(sink.write(0, block(10))).rejects.toThrow("cancelled");
        await expect(sink.finish()).rejects.toThrow("cancelled");
        expect(onEnd).toHaveBeenCalled();
    });

    it("fails a finish that's waiting when the download goes", async () => {
        const { sink } = sinkOf(10);
        await sink.write(0, block(10));
        const finishing = sink.finish();
        sink.fail(new Error("download cancelled"));
        await expect(finishing).rejects.toThrow("cancelled");
    });
});
