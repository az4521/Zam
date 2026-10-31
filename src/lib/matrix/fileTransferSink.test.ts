import { afterEach, describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({
    open: vi.fn(async () => ({
        id: `${String(plugin.opened++).padStart(36, "0")}`,
    })),
    write: vi.fn(async () => {}),
    finish: vi.fn(async () => {}),
    abort: vi.fn(async () => {}),
    opened: 0,
}));

vi.mock("@capacitor/core", () => ({
    Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => "android",
    },
    registerPlugin: () => plugin,
}));
vi.mock("$lib/utils/saveFile", () => ({ downloadObjectUrl: vi.fn() }));

import { StorageFullError, openSaveSink } from "./fileTransferSink";

/** The native end: answers each frame with what `outcome` says, later. */
function fakeChannel(outcome: (id: string) => string) {
    const frames: { sequence: number; id: string; position: number }[] = [];
    const channel = {
        onmessage: null as ((e: { data: string }) => void) | null,
        postMessage(buffer: ArrayBuffer) {
            const view = new DataView(buffer);
            const sequence = view.getUint32(0);
            const id = new TextDecoder().decode(new Uint8Array(buffer, 12, 36));
            frames.push({
                sequence,
                id,
                position: Number(view.getBigUint64(4)),
            });
            setTimeout(() =>
                channel.onmessage?.({ data: `${sequence}:${outcome(id)}` }),
            );
        },
    };
    (window as unknown as { zamFileBlocks?: unknown }).zamFileBlocks = channel;
    return frames;
}

afterEach(() => {
    delete (window as unknown as { zamFileBlocks?: unknown }).zamFileBlocks;
    vi.clearAllMocks();
});

describe("the Android sink", () => {
    it("sends blocks over the binary channel", async () => {
        const frames = fakeChannel(() => "ok");
        const sink = await openSaveSink("a.bin", "text/plain", 10);
        await sink!.write(1_048_576, new Uint8Array(4));
        expect(frames[0].position).toBe(1_048_576);
        expect(plugin.write).not.toHaveBeenCalled();
    });

    it("keeps two transfers' replies apart", async () => {
        const frames = fakeChannel(() => "ok");
        const first = await openSaveSink("a.bin", "text/plain", 10);
        const second = await openSaveSink("b.bin", "text/plain", 10);
        await Promise.all([
            first!.write(0, new Uint8Array(1)),
            second!.write(0, new Uint8Array(1)),
            first!.write(1, new Uint8Array(1)),
        ]);
        expect(new Set(frames.map((f) => f.sequence)).size).toBe(3);
        expect(new Set(frames.map((f) => f.id)).size).toBe(2);
    });

    it("reports a full disk as such", async () => {
        fakeChannel(() => "STORAGE_FULL");
        const sink = await openSaveSink("a.bin", "text/plain", 10);
        await expect(sink!.write(0, new Uint8Array(1))).rejects.toMatchObject({
            code: "STORAGE_FULL",
        });
    });

    it("falls back to the plugin on an older WebView", async () => {
        const sink = await openSaveSink("a.bin", "text/plain", 10);
        await sink!.write(5, new Uint8Array(1));
        expect(plugin.write).toHaveBeenCalledOnce();
    });

    it("refuses a file the device has no room for", async () => {
        plugin.open.mockRejectedValueOnce(
            Object.assign(new Error(), { code: "STORAGE_FULL" }),
        );
        await expect(
            openSaveSink("a.bin", "text/plain", 10),
        ).rejects.toBeInstanceOf(StorageFullError);
    });
});
