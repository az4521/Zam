import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { release } = vi.hoisted(() => ({
    release: vi.fn(async () => ({ removed: true })),
}));

vi.mock("@capacitor/core", () => ({
    Capacitor: {
        convertFileSrc: (p: string) => `http://localhost/_capacitor_file_${p}`,
    },
    registerPlugin: () => ({ release }),
}));

import { nativeStagedFileToFile } from "./nativeSharedFile";

describe("nativeStagedFileToFile", () => {
    const realFetch = globalThis.fetch;

    beforeEach(() => {
        release.mockClear();
    });

    afterEach(() => {
        globalThis.fetch = realFetch;
    });

    it("reads the staged path through the local file server and releases it", async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            blob: async () => new Blob(["hello"]),
        }));
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const file = await nativeStagedFileToFile({
            path: "/data/cache/shared-incoming/abc",
            name: "greet.txt",
            mimeType: "text/plain",
            size: 5,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost/_capacitor_file_/data/cache/shared-incoming/abc",
        );
        expect(file).toBeInstanceOf(File);
        expect(file?.name).toBe("greet.txt");
        expect(file?.type).toBe("text/plain");
        expect(await file?.text()).toBe("hello");
        expect(release).toHaveBeenCalledWith({
            path: "/data/cache/shared-incoming/abc",
        });
    });

    it("returns null and still releases when the read fails", async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: false,
            blob: async () => new Blob([]),
        })) as unknown as typeof fetch;

        const file = await nativeStagedFileToFile({ path: "/x/y", name: "a" });

        expect(file).toBeNull();
        expect(release).toHaveBeenCalledWith({ path: "/x/y" });
    });

    it("rejects an oversize file without reading it", async () => {
        const fetchMock = vi.fn();
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        const file = await nativeStagedFileToFile({
            path: "/x/big",
            size: 26 * 1024 * 1024,
        });

        expect(file).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(release).toHaveBeenCalledWith({ path: "/x/big" });
    });

    it("returns null for a payload with no path", async () => {
        expect(await nativeStagedFileToFile({ name: "x" })).toBeNull();
        expect(release).not.toHaveBeenCalled();
    });

    it("defaults name and type", async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: true,
            blob: async () => new Blob(["x"]),
        })) as unknown as typeof fetch;

        const file = await nativeStagedFileToFile({ path: "/x/z" });

        expect(file?.name).toBe("file");
        expect(file?.type).toBe("application/octet-stream");
    });
});
