import { describe, expect, it } from "vitest";
import { createMediaOwnership, mxcUrlsInContent } from "./mediaOwnership";

describe("createMediaOwnership", () => {
    it("allows an mxc uploaded under the current generation", () => {
        const owners = createMediaOwnership();
        owners.record("mxc://a/1", 3);
        expect(owners.isForeign("mxc://a/1", 3)).toBe(false);
    });

    it("refuses an mxc uploaded under an earlier generation", () => {
        const owners = createMediaOwnership();
        owners.record("mxc://a/1", 3);
        expect(owners.isForeign("mxc://a/1", 4)).toBe(true);
    });

    it("allows an mxc it never recorded (plugins may send any known media)", () => {
        const owners = createMediaOwnership();
        expect(owners.isForeign("mxc://elsewhere/x", 7)).toBe(false);
    });

    it("keeps refusing a retired upload after later uploads land", () => {
        const owners = createMediaOwnership();
        owners.record("mxc://a/1", 3);
        owners.record("mxc://b/2", 4);
        expect(owners.isForeign("mxc://a/1", 4)).toBe(true);
        expect(owners.isForeign("mxc://b/2", 4)).toBe(false);
    });

    it("drops the oldest entries past the cap", () => {
        const owners = createMediaOwnership(2);
        owners.record("mxc://a/1", 1);
        owners.record("mxc://a/2", 1);
        owners.record("mxc://a/3", 1);
        expect(owners.size()).toBe(2);
        expect(owners.isForeign("mxc://a/1", 2)).toBe(false);
        expect(owners.isForeign("mxc://a/2", 2)).toBe(true);
    });

    it("re-recording an mxc moves it to the newest slot", () => {
        const owners = createMediaOwnership(2);
        owners.record("mxc://a/1", 1);
        owners.record("mxc://a/2", 1);
        owners.record("mxc://a/1", 1);
        owners.record("mxc://a/3", 1);
        expect(owners.isForeign("mxc://a/1", 2)).toBe(true);
        expect(owners.isForeign("mxc://a/2", 2)).toBe(false);
    });
});

describe("mxcUrlsInContent", () => {
    it("reads the plaintext url and the encrypted file url", () => {
        expect(
            mxcUrlsInContent({
                url: "mxc://a/1",
                file: { url: "mxc://a/2" },
                info: {
                    thumbnail_url: "mxc://a/3",
                    thumbnail_file: { url: "mxc://a/4" },
                },
            }),
        ).toEqual(["mxc://a/1", "mxc://a/2", "mxc://a/3", "mxc://a/4"]);
    });

    it("ignores non-string and missing fields", () => {
        expect(
            mxcUrlsInContent({ url: 5, file: null, info: "x", body: "hi" }),
        ).toEqual([]);
        expect(mxcUrlsInContent({})).toEqual([]);
    });
});
