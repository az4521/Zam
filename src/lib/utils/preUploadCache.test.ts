import { describe, expect, it, vi } from "vitest";
import {
    createPreUploadCache,
    type PreUploadFingerprint,
    type PreUploadProgress,
} from "./preUploadCache";

function fp(
    overrides: Partial<PreUploadFingerprint> = {},
): PreUploadFingerprint {
    return {
        roomId: "!room:example.org",
        file: new File(["x"], "a.txt"),
        name: "a.txt",
        settings: "11111",
        encrypted: true,
        ...overrides,
    };
}

function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe("preUploadCache", () => {
    it("claims a matching entry and returns its result", async () => {
        const cache = createPreUploadCache<string>();
        const f = fp();
        cache.start("q1", f, async () => "uploaded");
        const entry = cache.detach("q1");
        expect(entry).toBeDefined();
        expect(await cache.claim(entry!, f)).toBe("uploaded");
        expect(cache.status("q1")).toBeUndefined();
    });

    it("discards and aborts the entry when the fingerprint mismatches", async () => {
        const cache = createPreUploadCache<string>();
        let signal!: AbortSignal;
        cache.start("q1", fp(), (_report, s) => {
            signal = s;
            return new Promise<string>(() => {});
        });
        const entry = cache.detach("q1")!;
        const other = fp({ name: "renamed.txt" });
        expect(await cache.claim(entry, other)).toBeNull();
        expect(signal.aborted).toBe(true);
    });

    it("treats a changed encryption state as a mismatch", async () => {
        const cache = createPreUploadCache<string>();
        cache.start("q1", fp({ encrypted: false }), async () => "plain");
        const entry = cache.detach("q1")!;
        expect(await cache.claim(entry, fp({ encrypted: true }))).toBeNull();
    });

    it("treats a changed settings key as a mismatch", async () => {
        const cache = createPreUploadCache<string>();
        cache.start("q1", fp({ settings: "11111" }), async () => "a");
        const entry = cache.detach("q1")!;
        expect(await cache.claim(entry, fp({ settings: "01111" }))).toBeNull();
    });

    it("discard removes the entry and aborts its upload", () => {
        const cache = createPreUploadCache<string>();
        let signal!: AbortSignal;
        cache.start("q1", fp(), (_r, s) => {
            signal = s;
            return new Promise<string>(() => {});
        });
        expect(cache.status("q1")).toBe("uploading");
        cache.discard("q1");
        expect(cache.status("q1")).toBeUndefined();
        expect(cache.detach("q1")).toBeUndefined();
        expect(signal.aborted).toBe(true);
    });

    it("a fresh start with a different fingerprint aborts the old upload", () => {
        const cache = createPreUploadCache<string>();
        let firstSignal!: AbortSignal;
        cache.start("q1", fp(), (_r, s) => {
            firstSignal = s;
            return new Promise<string>(() => {});
        });
        cache.start("q1", fp({ name: "b.txt" }), async () => "b");
        expect(firstSignal.aborted).toBe(true);
        expect(cache.status("q1")).toBe("uploading");
    });

    it("a start with the same fingerprint keeps the running upload", () => {
        const cache = createPreUploadCache<string>();
        const run = vi.fn(() => new Promise<string>(() => {}));
        const f = fp();
        cache.start("q1", f, run);
        cache.start("q1", f, run);
        expect(run).toHaveBeenCalledTimes(1);
    });

    it("a failed pre-upload falls back to null on claim without unhandled rejection", async () => {
        const cache = createPreUploadCache<string>();
        const f = fp();
        cache.start("q1", f, async () => {
            throw new Error("too large");
        });
        // Let the rejection settle with nobody claiming it yet.
        await new Promise((r) => setTimeout(r, 0));
        expect(cache.status("q1")).toBe("failed");
        const entry = cache.detach("q1")!;
        expect(await cache.claim(entry, f)).toBeNull();
    });

    it("a failed upload nobody claims stays silent", async () => {
        const cache = createPreUploadCache<string>();
        cache.start("q1", fp(), async () => {
            throw new Error("network");
        });
        await new Promise((r) => setTimeout(r, 0));
        cache.discard("q1");
        expect(cache.status("q1")).toBeUndefined();
    });

    it("forwards progress to a claimer, replaying the last value", async () => {
        const cache = createPreUploadCache<string>();
        const gate = deferred<string>();
        let report!: PreUploadProgress;
        cache.start("q1", fp(), (r) => {
            report = r;
            return gate.promise;
        });
        report(10, 100);
        expect(cache.progress("q1")).toEqual({ loaded: 10, total: 100 });

        const entry = cache.detach("q1")!;
        const seen: Array<[number, number]> = [];
        const claimed = cache.claim(entry, entry.fingerprint, (l, t) =>
            seen.push([l, t]),
        );
        report(50, 100);
        gate.resolve("done");
        expect(await claimed).toBe("done");
        expect(seen).toEqual([
            [10, 100],
            [50, 100],
        ]);
    });

    it("stops forwarding progress to a claimer once it has settled", async () => {
        const cache = createPreUploadCache<string>();
        let report!: PreUploadProgress;
        cache.start("q1", fp(), async (r) => {
            report = r;
            return "ok";
        });
        const entry = cache.detach("q1")!;
        const listener = vi.fn();
        await cache.claim(entry, entry.fingerprint, listener);
        report(1, 2);
        expect(listener).not.toHaveBeenCalled();
    });

    it("cancel aborts a detached entry", () => {
        const cache = createPreUploadCache<string>();
        let signal!: AbortSignal;
        cache.start("q1", fp(), (_r, s) => {
            signal = s;
            return new Promise<string>(() => {});
        });
        const entry = cache.detach("q1")!;
        cache.cancel(entry);
        expect(signal.aborted).toBe(true);
    });

    it("notifies onChange on start, progress and discard", () => {
        const onChange = vi.fn();
        const cache = createPreUploadCache<string>(onChange);
        let report!: PreUploadProgress;
        cache.start("q1", fp(), (r) => {
            report = r;
            return new Promise<string>(() => {});
        });
        const afterStart = onChange.mock.calls.length;
        report(1, 2);
        expect(onChange.mock.calls.length).toBeGreaterThan(afterStart);
        const afterProgress = onChange.mock.calls.length;
        cache.discard("q1");
        expect(onChange.mock.calls.length).toBeGreaterThan(afterProgress);
    });
});
