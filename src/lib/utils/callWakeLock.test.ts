import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWakeLockController } from "./callWakeLock";

type Listener = () => void;

function fakeDoc(initial: "visible" | "hidden" = "visible") {
    const listeners = new Set<Listener>();
    const doc = {
        visibilityState: initial as string,
        addEventListener: vi.fn((_type: "visibilitychange", l: Listener) =>
            listeners.add(l),
        ),
        removeEventListener: vi.fn((_type: "visibilitychange", l: Listener) =>
            listeners.delete(l),
        ),
        setVisibility(state: "visible" | "hidden") {
            doc.visibilityState = state;
            for (const l of [...listeners]) l();
        },
        listenerCount: () => listeners.size,
    };
    return doc;
}

function fakeSentinel() {
    const sentinel = {
        released: false,
        release: vi.fn(async () => {
            sentinel.released = true;
        }),
        addEventListener: vi.fn(),
    };
    return sentinel;
}

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (v: T) => void;
    reject: (e: unknown) => void;
};
function deferred<T>(): Deferred<T> {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function fakeNav(impl?: () => Promise<unknown>) {
    const request = vi.fn(impl ?? (async () => fakeSentinel()));
    return { wakeLock: { request } } as unknown as Parameters<
        typeof createWakeLockController
    >[0] & {
        wakeLock: { request: typeof request };
    };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("createWakeLockController", () => {
    let doc: ReturnType<typeof fakeDoc>;

    beforeEach(() => {
        doc = fakeDoc("visible");
    });

    it("requests a screen lock when wanted and visible", async () => {
        const nav = fakeNav();
        const c = createWakeLockController(nav, doc as unknown as Document);
        c.setWanted(true);
        expect(nav.wakeLock.request).toHaveBeenCalledWith("screen");
        await flush();
        c.dispose();
    });

    it("releases the lock when no longer wanted", async () => {
        const nav = fakeNav();
        const c = createWakeLockController(nav, doc as unknown as Document);
        c.setWanted(true);
        const sentinel = await nav.wakeLock.request.mock.results[0].value;
        c.setWanted(false);
        expect(sentinel.release).toHaveBeenCalledTimes(1);
        c.dispose();
    });

    it("does not request while hidden, requests on return to visible", async () => {
        const nav = fakeNav();
        doc = fakeDoc("hidden");
        const c = createWakeLockController(nav, doc as unknown as Document);
        c.setWanted(true);
        expect(nav.wakeLock.request).not.toHaveBeenCalled();
        doc.setVisibility("visible");
        expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
        c.dispose();
    });

    it("releases when the page becomes hidden while wanted", async () => {
        const nav = fakeNav();
        const c = createWakeLockController(nav, doc as unknown as Document);
        c.setWanted(true);
        const sentinel = await nav.wakeLock.request.mock.results[0].value;
        doc.setVisibility("hidden");
        expect(sentinel.release).toHaveBeenCalledTimes(1);
        c.dispose();
    });

    it("does not issue duplicate concurrent requests", async () => {
        const d = deferred<unknown>();
        const nav = fakeNav(() => d.promise);
        const c = createWakeLockController(nav, doc as unknown as Document);
        c.setWanted(true);
        c.setWanted(true);
        doc.setVisibility("hidden");
        doc.setVisibility("visible");
        expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
        d.resolve(fakeSentinel());
        await flush();
        c.dispose();
    });

    it("releases a lock that resolves after it is no longer wanted", async () => {
        const d = deferred<ReturnType<typeof fakeSentinel>>();
        const nav = fakeNav(() => d.promise);
        const c = createWakeLockController(nav, doc as unknown as Document);
        c.setWanted(true);
        c.setWanted(false);
        const sentinel = fakeSentinel();
        d.resolve(sentinel);
        await flush();
        expect(sentinel.release).toHaveBeenCalledTimes(1);
        c.dispose();
    });

    it("swallows request rejections and allows a later retry", async () => {
        const nav = fakeNav(() => Promise.reject(new Error("NotAllowedError")));
        const c = createWakeLockController(nav, doc as unknown as Document);
        c.setWanted(true);
        await flush();
        c.setWanted(false);
        c.setWanted(true);
        expect(nav.wakeLock.request).toHaveBeenCalledTimes(2);
        await flush();
        c.dispose();
    });

    it("does nothing when wakeLock is unsupported", () => {
        const c = createWakeLockController({}, doc as unknown as Document);
        expect(() => c.setWanted(true)).not.toThrow();
        c.setWanted(false);
        c.dispose();
    });

    it("dispose releases the lock, removes the listener and ignores later calls", async () => {
        const nav = fakeNav();
        const c = createWakeLockController(nav, doc as unknown as Document);
        c.setWanted(true);
        const sentinel = await nav.wakeLock.request.mock.results[0].value;
        c.dispose();
        expect(sentinel.release).toHaveBeenCalledTimes(1);
        expect(doc.listenerCount()).toBe(0);
        c.dispose();
        c.setWanted(true);
        expect(nav.wakeLock.request).toHaveBeenCalledTimes(1);
    });
});
