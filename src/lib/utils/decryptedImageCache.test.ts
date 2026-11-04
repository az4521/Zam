import { beforeEach, describe, expect, it } from "vitest";
import {
    cacheDecryptedImage,
    cachedDecryptedImage,
    clearDecryptedImageCache,
    DECRYPTED_IMAGE_CACHE_BYTES,
} from "./decryptedImageCache";

const MB = 1024 * 1024;
const blob = (size: number) => new Blob([new Uint8Array(size)]);

describe("decryptedImageCache", () => {
    beforeEach(() => clearDecryptedImageCache());

    it("returns what was kept", () => {
        const b = blob(10);
        cacheDecryptedImage("mxc://s/a", { blob: b, isOriginal: true });
        expect(cachedDecryptedImage("mxc://s/a")).toEqual({
            blob: b,
            isOriginal: true,
        });
        expect(cachedDecryptedImage("mxc://s/b")).toBeNull();
    });

    it("drops the least recently shown past the byte budget", () => {
        const third = DECRYPTED_IMAGE_CACHE_BYTES / 3;
        cacheDecryptedImage("mxc://s/a", {
            blob: blob(third),
            isOriginal: false,
        });
        cacheDecryptedImage("mxc://s/b", {
            blob: blob(third),
            isOriginal: false,
        });
        cacheDecryptedImage("mxc://s/c", {
            blob: blob(third),
            isOriginal: false,
        });
        // Showing a again makes b the oldest.
        cachedDecryptedImage("mxc://s/a");
        cacheDecryptedImage("mxc://s/d", { blob: blob(MB), isOriginal: false });
        expect(cachedDecryptedImage("mxc://s/b")).toBeNull();
        expect(cachedDecryptedImage("mxc://s/a")).not.toBeNull();
        expect(cachedDecryptedImage("mxc://s/c")).not.toBeNull();
        expect(cachedDecryptedImage("mxc://s/d")).not.toBeNull();
    });

    it("replacing an entry doesn't count it twice", () => {
        const half = DECRYPTED_IMAGE_CACHE_BYTES / 2;
        cacheDecryptedImage("mxc://s/a", {
            blob: blob(half),
            isOriginal: false,
        });
        cacheDecryptedImage("mxc://s/a", {
            blob: blob(half),
            isOriginal: false,
        });
        cacheDecryptedImage("mxc://s/b", {
            blob: blob(half),
            isOriginal: false,
        });
        expect(cachedDecryptedImage("mxc://s/a")).not.toBeNull();
        expect(cachedDecryptedImage("mxc://s/b")).not.toBeNull();
    });

    it("clears", () => {
        cacheDecryptedImage("mxc://s/a", { blob: blob(10), isOriginal: true });
        clearDecryptedImageCache();
        expect(cachedDecryptedImage("mxc://s/a")).toBeNull();
    });
});
