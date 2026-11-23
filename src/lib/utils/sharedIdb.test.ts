import { afterEach, describe, expect, it, vi } from "vitest";
import { openSharedDb } from "./sharedIdb";

/** A fake factory whose opens succeed on the next microtask. */
function fakeFactory() {
    const dbs: Array<{
        close: ReturnType<typeof vi.fn>;
        onversionchange: (() => void) | null;
        onclose: (() => void) | null;
    }> = [];
    const open = vi.fn(() => {
        const db = {
            close: vi.fn(),
            onversionchange: null as (() => void) | null,
            onclose: null as (() => void) | null,
            objectStoreNames: { contains: () => false },
            createObjectStore: vi.fn(),
        };
        dbs.push(db);
        const req: Record<string, unknown> = { result: db };
        queueMicrotask(() => (req.onsuccess as () => void)());
        return req;
    });
    return { open, dbs };
}

describe("openSharedDb", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("opens once and reuses the connection for later calls", async () => {
        const f = fakeFactory();
        vi.stubGlobal("indexedDB", { open: f.open });
        const a = await openSharedDb("shared-once", 1, () => {});
        const b = await openSharedDb("shared-once", 1, () => {});
        expect(a).toBe(b);
        expect(f.open).toHaveBeenCalledTimes(1);
    });

    it("closes the connection on versionchange and reopens on the next call", async () => {
        const f = fakeFactory();
        vi.stubGlobal("indexedDB", { open: f.open });
        const first = await openSharedDb("shared-vc", 1, () => {});
        (first as unknown as { onversionchange: () => void }).onversionchange();
        expect(f.dbs[0].close).toHaveBeenCalledTimes(1);
        const second = await openSharedDb("shared-vc", 1, () => {});
        expect(second).not.toBe(first);
        expect(f.open).toHaveBeenCalledTimes(2);
    });

    it("rejects when IndexedDB is unavailable", async () => {
        vi.stubGlobal("indexedDB", undefined);
        await expect(
            openSharedDb("shared-none", 1, () => {}),
        ).rejects.toThrow();
    });
});
