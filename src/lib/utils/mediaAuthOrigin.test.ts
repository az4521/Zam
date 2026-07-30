import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAuthorisedMediaTarget } from "./mediaAuthOrigin";

const HS = "https://matrix.example.org";
const MEDIA = "/_matrix/client/v1/media/download/example.org/abc";

describe("isAuthorisedMediaTarget", () => {
    it("authorises the homeserver's own media endpoints", () => {
        expect(isAuthorisedMediaTarget(HS + MEDIA, HS)).toBe(true);
        expect(
            isAuthorisedMediaTarget(
                HS + "/_matrix/client/v1/media/thumbnail/example.org/abc?w=32",
                HS,
            ),
        ).toBe(true);
    });

    it("refuses a different scheme on the same host", () => {
        expect(
            isAuthorisedMediaTarget("http://matrix.example.org" + MEDIA, HS),
        ).toBe(false);
    });

    it("refuses a different port on the same host and scheme", () => {
        // The whole point of SEC-03: an element pointed at the homeserver's
        // hostname on an attacker-controlled port must not receive the token.
        expect(
            isAuthorisedMediaTarget(
                "https://matrix.example.org:8443" + MEDIA,
                HS,
            ),
        ).toBe(false);
        expect(
            isAuthorisedMediaTarget(
                HS + MEDIA,
                "https://matrix.example.org:8443",
            ),
        ).toBe(false);
    });

    it("refuses a different host", () => {
        expect(
            isAuthorisedMediaTarget("https://evil.example.org" + MEDIA, HS),
        ).toBe(false);
        expect(
            isAuthorisedMediaTarget(
                "https://matrix.example.org.evil.test" + MEDIA,
                HS,
            ),
        ).toBe(false);
    });

    it("treats an explicit default port as the same origin", () => {
        expect(
            isAuthorisedMediaTarget(
                "https://matrix.example.org:443" + MEDIA,
                HS,
            ),
        ).toBe(true);
    });

    it("keeps two homeservers on one domain apart by base path", () => {
        const hs = "https://example.org/matrix";
        expect(isAuthorisedMediaTarget(`${hs}${MEDIA}`, hs)).toBe(true);
        expect(
            isAuthorisedMediaTarget(`https://example.org/other${MEDIA}`, hs),
        ).toBe(false);
        // A prefix that is not a path boundary must not match.
        expect(
            isAuthorisedMediaTarget(
                `https://example.org/matrixevil${MEDIA}`,
                hs,
            ),
        ).toBe(false);
    });

    it("tolerates a trailing slash on the configured homeserver", () => {
        expect(isAuthorisedMediaTarget(HS + MEDIA, HS + "/")).toBe(true);
        expect(
            isAuthorisedMediaTarget(
                `https://example.org/matrix${MEDIA}`,
                "https://example.org/matrix/",
            ),
        ).toBe(true);
    });

    it("refuses any non-media path on the homeserver itself", () => {
        expect(
            isAuthorisedMediaTarget(HS + "/_matrix/client/v3/sync", HS),
        ).toBe(false);
        expect(isAuthorisedMediaTarget(HS + "/", HS)).toBe(false);
        expect(
            isAuthorisedMediaTarget(
                HS + "/_matrix/media/v3/download/example.org/abc",
                HS,
            ),
        ).toBe(false);
    });

    it("refuses unusable input instead of guessing", () => {
        expect(isAuthorisedMediaTarget(HS + MEDIA, "")).toBe(false);
        expect(isAuthorisedMediaTarget(HS + MEDIA, "not a url")).toBe(false);
        expect(isAuthorisedMediaTarget("not a url", HS)).toBe(false);
    });
});

describe("static/sw.js mirrors this gate", () => {
    // The service worker is served verbatim from static/ — it cannot import
    // this module, so the check lives there as a hand-written copy. Pin it, or
    // the two drift and the util silently stops describing what ships.
    const sw = readFileSync(resolve(process.cwd(), "static/sw.js"), "utf8");

    it("compares full origins, not hostnames", () => {
        expect(sw).toContain("parsedUrl.origin !== hsUrl.origin");
        expect(sw).not.toContain("parsedUrl.hostname !== hsUrl.hostname");
    });

    it("still constrains the base path as well as the origin", () => {
        expect(sw).toContain("reqBase.startsWith(hsBase)");
    });

    it("still gates on the authenticated media path", () => {
        expect(sw).toContain("/_matrix/client/v1/media/");
    });
});
