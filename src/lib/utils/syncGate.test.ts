import { describe, it, expect, vi } from "vitest";
import { createSyncGate, isSyncRequest } from "./syncGate";

const HS = "https://hs.example";

describe("isSyncRequest", () => {
    it("matches classic and sliding sync under any version", () => {
        expect(isSyncRequest(`${HS}/_matrix/client/v3/sync?since=s1`)).toBe(
            true,
        );
        expect(isSyncRequest(`${HS}/_matrix/client/r0/sync`)).toBe(true);
        expect(
            isSyncRequest(
                `${HS}/_matrix/client/unstable/org.matrix.simplified_msc3575/sync?pos=3`,
            ),
        ).toBe(true);
    });

    it("leaves everything else alone", () => {
        expect(isSyncRequest(`${HS}/_matrix/client/v3/rooms/!r/event/$e`)).toBe(
            false,
        );
        expect(isSyncRequest(`${HS}/_matrix/client/versions`)).toBe(false);
        expect(isSyncRequest(`${HS}/_matrix/client/v3/sync/extra`)).toBe(false);
        expect(isSyncRequest(`${HS}/sync`)).toBe(false);
    });
});

describe("createSyncGate", () => {
    const ok = () => new Response("{}");

    it("passes everything through while running", async () => {
        const base = vi.fn(async () => ok());
        const gate = createSyncGate(base as unknown as typeof fetch);
        await gate.fetch(`${HS}/_matrix/client/v3/sync`);
        expect(base).toHaveBeenCalledTimes(1);
    });

    it("holds sync requests while paused and releases them on resume", async () => {
        const base = vi.fn(async () => ok());
        const gate = createSyncGate(base as unknown as typeof fetch);
        gate.pause();
        const held = gate.fetch(`${HS}/_matrix/client/v3/sync`);
        await gate.fetch(`${HS}/_matrix/client/v3/rooms/!r/event/$e`);
        expect(base).toHaveBeenCalledTimes(1); // only the event fetch
        gate.resume();
        await held;
        expect(base).toHaveBeenCalledTimes(2);
        expect(gate.isPaused()).toBe(false);
    });

    it("rejects a held request when its signal aborts, and never sends it", async () => {
        const base = vi.fn(async () => ok());
        const gate = createSyncGate(base as unknown as typeof fetch);
        gate.pause();
        const ctl = new AbortController();
        const held = gate.fetch(`${HS}/_matrix/client/v3/sync`, {
            signal: ctl.signal,
        });
        ctl.abort();
        await expect(held).rejects.toBeDefined();
        gate.resume();
        expect(base).not.toHaveBeenCalled();
    });

    it("rejects at once for an already-aborted signal", async () => {
        const base = vi.fn(async () => ok());
        const gate = createSyncGate(base as unknown as typeof fetch);
        gate.pause();
        const ctl = new AbortController();
        ctl.abort();
        await expect(
            gate.fetch(`${HS}/_matrix/client/v3/sync`, { signal: ctl.signal }),
        ).rejects.toBeDefined();
    });
});
