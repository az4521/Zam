import { describe, it, expect, vi, beforeEach } from "vitest";

// A fake native plugin: each downloadApk call is a manually finished
// download, and progress goes to every registered listener like Capacitor's
// notifyListeners does.
const native = vi.hoisted(() => {
    const listeners = new Set<(p: { percent: number }) => void>();
    const calls: {
        url: string;
        resolve: (v: { path: string }) => void;
        reject: (e: Error) => void;
    }[] = [];
    return {
        listeners,
        calls,
        progress(percent: number) {
            for (const l of listeners) l({ percent });
        },
        plugin: {
            downloadApk: ({ url }: { url: string }) =>
                new Promise<{ path: string }>((resolve, reject) =>
                    calls.push({ url, resolve, reject }),
                ),
            addListener: async (
                _event: string,
                fn: (p: { percent: number }) => void,
            ) => {
                listeners.add(fn);
                return { remove: async () => void listeners.delete(fn) };
            },
        },
    };
});

vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => true, getPlatform: () => "android" },
    registerPlugin: () => native.plugin,
}));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("downloadApk", () => {
    beforeEach(() => {
        vi.resetModules();
        native.calls.length = 0;
        native.listeners.clear();
    });

    it("joins a running download instead of starting a second one", async () => {
        const { downloadApk, apkDownloadInFlight } =
            await import("./androidUpdater");
        const first: number[] = [];
        const a = downloadApk("https://x/zam.apk", 42, (p) => first.push(p));
        await flush();
        native.progress(30);
        expect(apkDownloadInFlight()).toBe(30);

        // The About tab remounting mid-download.
        const second: number[] = [];
        const b = downloadApk("https://x/zam.apk", 42, (p) => second.push(p));
        await flush();
        native.progress(60);

        expect(native.calls).toHaveLength(1);
        expect(second).toEqual([30, 60]); // current percent first, no reset
        expect(first).toEqual([0, 30, 60]);

        native.calls[0].resolve({ path: "/data/zam.apk" });
        expect(await a).toBe("/data/zam.apk");
        expect(await b).toBe("/data/zam.apk");
        expect(apkDownloadInFlight()).toBeNull();
    });

    it("does not download the same release again once finished", async () => {
        const { downloadApk } = await import("./androidUpdater");
        const a = downloadApk("https://x/zam.apk", 42);
        await flush();
        native.calls[0].resolve({ path: "/data/zam.apk" });
        await a;
        expect(await downloadApk("https://x/zam.apk", 42)).toBe(
            "/data/zam.apk",
        );
        expect(native.calls).toHaveLength(1);
    });

    it("retries after a failed download", async () => {
        const { downloadApk } = await import("./androidUpdater");
        const a = downloadApk("https://x/zam.apk", 42);
        await flush();
        native.calls[0].reject(new Error("network"));
        await expect(a).rejects.toThrow("network");
        const b = downloadApk("https://x/zam.apk", 42);
        await flush();
        expect(native.calls).toHaveLength(2);
        native.calls[1].resolve({ path: "/data/zam.apk" });
        expect(await b).toBe("/data/zam.apk");
    });

    it("runs a newer release's download after the current one, not alongside", async () => {
        const { downloadApk } = await import("./androidUpdater");
        const a = downloadApk("https://x/zam-1.apk", 41);
        const b = downloadApk("https://x/zam-2.apk", 42);
        await flush();
        expect(native.calls.map((c) => c.url)).toEqual(["https://x/zam-1.apk"]);
        native.calls[0].resolve({ path: "/data/zam.apk" });
        await a;
        await flush();
        expect(native.calls.map((c) => c.url)).toEqual([
            "https://x/zam-1.apk",
            "https://x/zam-2.apk",
        ]);
        native.calls[1].resolve({ path: "/data/zam.apk" });
        expect(await b).toBe("/data/zam.apk");
    });
});
