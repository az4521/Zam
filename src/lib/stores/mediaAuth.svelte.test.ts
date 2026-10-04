import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("$lib/stores/accounts.svelte", () => ({
    getActiveAccount: () => ({
        accessToken: "tok",
        homeserverUrl: "https://hs.example",
    }),
}));

import { flushSync } from "svelte";
import {
    createMediaRetry,
    installMediaHealer,
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
