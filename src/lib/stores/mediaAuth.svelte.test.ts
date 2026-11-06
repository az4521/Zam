import {
    describe,
    it,
    expect,
    vi,
    beforeAll,
    beforeEach,
    afterEach,
} from "vitest";

vi.mock("$lib/stores/accounts.svelte", () => ({
    getActiveAccount: () => ({
        accessToken: "tok",
        homeserverUrl: "https://hs.example",
    }),
}));

import { flushSync } from "svelte";
import {
    accountMediaBlobUrl,
    createMediaRetry,
    installMediaHealer,
    isTransientMediaStatus,
    markSwMediaReady,
    swMediaAuth,
    type MediaRetry,
} from "./mediaAuth.svelte";

const MEDIA = "https://hs.example/_matrix/client/v1/media/download/hs.example/";

let blobN = 0;
const fetchMock = vi.fn(async () => ({
    ok: true,
    blob: async () => new Blob(["x"], { type: "image/png" }),
}));

function flush() {
    return new Promise((r) => setTimeout(r, 0));
}

function failingImg(src: string, parent: HTMLElement = document.body) {
    const img = document.createElement("img");
    img.src = src;
    parent.appendChild(img);
    img.dispatchEvent(new Event("error"));
    return img;
}

describe("installMediaHealer", () => {
    beforeAll(() => {
        vi.stubGlobal("fetch", fetchMock);
        URL.createObjectURL = () => `blob:healed-${++blobN}`;
        installMediaHealer();
    });
    beforeEach(() => {
        document.body.innerHTML = "";
        fetchMock.mockClear();
    });

    it("heals authed media anywhere, not only inside .message-body", async () => {
        // e.g. a custom-emoji reaction chip; with no service worker (Tor
        // Browser) this is the only thing that can load it.
        const img = failingImg(MEDIA + "a");
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0]).toEqual([
            MEDIA + "a",
            { headers: { Authorization: "Bearer tok" } },
        ]);
        expect(img.src).toMatch(/^blob:healed-/);
    });

    it("fetches a URL once and shares the blob across elements", async () => {
        const a = failingImg(MEDIA + "shared");
        const b = failingImg(MEDIA + "shared");
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(a.src).toMatch(/^blob:/);
        expect(b.src).toBe(a.src);
    });

    it("skips <img>s that manage their own retry", async () => {
        const img = document.createElement("img");
        img.setAttribute("data-own-retry", "");
        img.src = MEDIA + "own";
        document.body.appendChild(img);
        img.dispatchEvent(new Event("error"));
        await flush();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(img.src).toBe(MEDIA + "own");
    });

    it("ignores media from other hosts (never leaks the token)", async () => {
        failingImg("https://evil.example/_matrix/client/v1/media/download/x/y");
        await flush();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not clobber a src the element switched to meanwhile", async () => {
        const img = failingImg(MEDIA + "old");
        img.src = MEDIA + "new";
        await flush();
        expect(img.src).toBe(MEDIA + "new");
    });
});

// Module state (swMediaAuth.ready) only ever goes false -> true, so these run
// in order: not-ready behaviour first, then markSwMediaReady.
describe("media auth without a ready service worker", () => {
    beforeAll(() => {
        vi.stubGlobal("fetch", fetchMock);
        URL.createObjectURL = () => `blob:healed-${++blobN}`;
        URL.revokeObjectURL = () => {};
    });
    beforeEach(() => {
        document.body.innerHTML = "";
        fetchMock.mockClear();
    });

    function retryFor(src: string): { retry: MediaRetry; stop: () => void } {
        let retry!: MediaRetry;
        const stop = $effect.root(() => {
            retry = createMediaRetry(() => src);
        });
        flushSync();
        return { retry, stop };
    }

    it("fetches authed media with the token instead of handing the <img> a URL that would 401", async () => {
        expect(swMediaAuth.ready).toBe(false);
        const { retry, stop } = retryFor(MEDIA + "direct");
        // Never exposes the raw URL, so no token-less request goes out.
        expect(retry.src).toBeUndefined();
        expect(retry.pending).toBe(true);
        await flush();
        flushSync();
        expect(fetchMock).toHaveBeenCalledWith(MEDIA + "direct", {
            headers: { Authorization: "Bearer tok" },
        });
        expect(retry.src).toMatch(/^blob:healed-/);
        expect(retry.pending).toBe(false);
        stop();
    });

    it("leaves non-homeserver media alone", () => {
        const { retry, stop } = retryFor("https://other.example/pic.png");
        expect(retry.src).toBe("https://other.example/pic.png");
        expect(fetchMock).not.toHaveBeenCalled();
        stop();
    });

    it("retries media that gave up once the worker is ready", async () => {
        fetchMock.mockImplementationOnce(async () => ({
            ok: false,
            blob: async () => new Blob(),
        }));
        const { retry, stop } = retryFor(MEDIA + "flaky");
        await flush();
        flushSync();
        expect(retry.failed).toBe(true);

        markSwMediaReady();
        flushSync();
        expect(retry.failed).toBe(false);
        // The worker adds the token now, so the <img> gets the real URL.
        expect(retry.src).toBe(MEDIA + "flaky");
        stop();
    });

    it("hands the <img> the URL directly once the worker is ready", () => {
        expect(swMediaAuth.ready).toBe(true);
        const { retry, stop } = retryFor(MEDIA + "via-worker");
        expect(retry.src).toBe(MEDIA + "via-worker");
        expect(fetchMock).not.toHaveBeenCalled();
        stop();
    });

    it("re-requests broken authed <img>s when the worker becomes ready", () => {
        const broken = document.createElement("img");
        broken.src = MEDIA + "broken";
        broken.dataset.mediaHealed = MEDIA + "broken";
        document.body.appendChild(broken);
        Object.defineProperty(broken, "complete", { value: true });
        let reassigned = false;
        const desc = Object.getOwnPropertyDescriptor(
            HTMLImageElement.prototype,
            "src",
        )!;
        Object.defineProperty(broken, "src", {
            get: () => desc.get!.call(broken),
            set: (v: string) => {
                reassigned = true;
                desc.set!.call(broken, v);
            },
        });
        markSwMediaReady();
        expect(reassigned).toBe(true);
        // Healable again if the worker's request fails too.
        expect(broken.dataset.mediaHealed).toBeUndefined();
    });
});

// Transient failures (5xx, 429, network) are retried on a backoff; permanent
// ones (401/403/404) are not. Runs with the worker ready, so an <img> error
// (onError) is what starts the authed fetch.
describe("transient media failures", () => {
    const okResponse = async () => ({
        ok: true,
        blob: async () => new Blob(["x"], { type: "image/png" }),
    });
    const failWith = (status: number) => async () => ({
        ok: false,
        status,
        blob: async () => new Blob(),
    });
    const networkError = async (): Promise<never> => {
        throw new TypeError("Failed to fetch");
    };
    const settle = () => vi.advanceTimersByTimeAsync(0);

    function mount(getSrc: () => string): {
        retry: MediaRetry;
        stop: () => void;
    } {
        let retry!: MediaRetry;
        const stop = $effect.root(() => {
            retry = createMediaRetry(getSrc);
        });
        flushSync();
        return { retry, stop };
    }

    beforeAll(() => {
        vi.stubGlobal("fetch", fetchMock);
        URL.createObjectURL = () => `blob:retry-${++blobN}`;
        URL.revokeObjectURL = () => {};
    });
    beforeEach(() => {
        vi.useFakeTimers();
        fetchMock.mockClear();
        fetchMock.mockImplementation(okResponse);
    });
    afterEach(() => {
        vi.useRealTimers();
        fetchMock.mockImplementation(okResponse);
    });

    it("classifies server errors, rate limits and timeouts as transient", () => {
        for (const s of [408, 429, 500, 502, 503]) {
            expect(isTransientMediaStatus(s)).toBe(true);
        }
        for (const s of [400, 401, 403, 404]) {
            expect(isTransientMediaStatus(s)).toBe(false);
        }
    });

    it("retries a 503 on a timer, staying pending, then shows the blob", async () => {
        fetchMock.mockImplementationOnce(failWith(503));
        const { retry, stop } = mount(() => MEDIA + "a");
        void retry.onError();
        await settle();
        flushSync();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(retry.pending).toBe(true);
        expect(retry.failed).toBe(false);

        await vi.advanceTimersByTimeAsync(1_499);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        await settle();
        flushSync();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(retry.src).toMatch(/^blob:retry-/);
        expect(retry.pending).toBe(false);
        expect(retry.failed).toBe(false);
        stop();
    });

    it("gives up after three retries at 1.5s, 4s and 10s", async () => {
        fetchMock.mockImplementation(failWith(502));
        const { retry, stop } = mount(() => MEDIA + "b");
        void retry.onError();
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(1);

        for (const [ms, calls] of [
            [1_499, 1],
            [1, 2],
            [3_999, 2],
            [1, 3],
            [9_999, 3],
            [1, 4],
        ] as const) {
            await vi.advanceTimersByTimeAsync(ms);
            await settle();
            expect(fetchMock).toHaveBeenCalledTimes(calls);
        }
        flushSync();
        expect(retry.failed).toBe(true);
        expect(retry.pending).toBe(false);

        await vi.advanceTimersByTimeAsync(60_000);
        expect(fetchMock).toHaveBeenCalledTimes(4);
        stop();
    });

    it("retries a network error", async () => {
        fetchMock.mockImplementationOnce(networkError);
        const { retry, stop } = mount(() => MEDIA + "net");
        void retry.onError();
        await settle();
        flushSync();
        expect(retry.pending).toBe(true);
        await vi.advanceTimersByTimeAsync(1_500);
        flushSync();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(retry.src).toMatch(/^blob:retry-/);
        stop();
    });

    it.each([401, 403, 404])("does not retry a %i", async (status) => {
        fetchMock.mockImplementation(failWith(status));
        const { retry, stop } = mount(() => MEDIA + `perm${status}`);
        void retry.onError();
        await settle();
        flushSync();
        expect(retry.failed).toBe(true);
        expect(retry.pending).toBe(false);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        stop();
    });

    it("retries straight away when the window comes back online", async () => {
        fetchMock.mockImplementation(failWith(503));
        const { retry, stop } = mount(() => MEDIA + "online");
        void retry.onError();
        await settle();
        // Exhaust the schedule so the media has given up.
        await vi.advanceTimersByTimeAsync(15_500);
        await settle();
        flushSync();
        expect(fetchMock).toHaveBeenCalledTimes(4);
        expect(retry.failed).toBe(true);

        fetchMock.mockImplementation(okResponse);
        window.dispatchEvent(new Event("online"));
        await settle();
        flushSync();
        expect(fetchMock).toHaveBeenCalledTimes(5);
        expect(retry.failed).toBe(false);
        expect(retry.src).toMatch(/^blob:retry-/);
        stop();
    });

    it("an online event during a wait retries now, not at the timer", async () => {
        fetchMock.mockImplementationOnce(failWith(503));
        const { retry, stop } = mount(() => MEDIA + "early");
        void retry.onError();
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        window.dispatchEvent(new Event("online"));
        await settle();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        flushSync();
        expect(retry.src).toMatch(/^blob:retry-/);
        stop();
    });

    it("a src change cancels the pending retry", async () => {
        fetchMock.mockImplementationOnce(failWith(503));
        const box = $state({ src: MEDIA + "old" });
        const { retry, stop } = mount(() => box.src);
        void retry.onError();
        await settle();
        box.src = MEDIA + "new";
        flushSync();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(retry.failed).toBe(false);
        expect(retry.pending).toBe(false);
        expect(retry.src).toBe(MEDIA + "new");
        stop();
    });

    it("destroying the component cancels the pending retry", async () => {
        fetchMock.mockImplementationOnce(failWith(503));
        const { retry, stop } = mount(() => MEDIA + "gone");
        void retry.onError();
        await settle();
        stop();
        window.dispatchEvent(new Event("online"));
        await vi.advanceTimersByTimeAsync(60_000);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe("accountMediaBlobUrl", () => {
    const other = {
        accessToken: "other-tok",
        homeserverUrl: "https://other.example",
    };
    const OTHER_MEDIA =
        "https://other.example/_matrix/client/v1/media/thumbnail/other.example/a";

    beforeAll(() => {
        vi.stubGlobal("fetch", fetchMock);
        URL.createObjectURL = () => `blob:acct-${++blobN}`;
    });
    beforeEach(() => fetchMock.mockClear());

    it("fetches another account's avatar with that account's own token", async () => {
        const url = await accountMediaBlobUrl(OTHER_MEDIA, other);
        expect(url).toMatch(/^blob:acct-/);
        expect(fetchMock.mock.calls[0]).toEqual([
            OTHER_MEDIA,
            { headers: { Authorization: "Bearer other-tok" } },
        ]);
    });

    it("never sends the token to a different origin or a non-media path", async () => {
        expect(
            await accountMediaBlobUrl(
                "https://evil.example/_matrix/client/v1/media/download/x/y",
                other,
            ),
        ).toBeNull();
        expect(
            await accountMediaBlobUrl(
                "https://other.example/_matrix/client/v3/account/whoami",
                other,
            ),
        ).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
