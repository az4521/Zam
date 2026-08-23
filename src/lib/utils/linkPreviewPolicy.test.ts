import { describe, it, expect, vi } from "vitest";
import {
    DEFAULT_LINK_PREVIEW_MEDIA,
    allowsMediaAutoLoad,
    allowsThirdPartyEmbed,
    normalizeLinkPreviewMedia,
    isMxcPreviewMedia,
} from "./linkPreviewPolicy";

const HS = "https://matrix.example.com";

describe("normalizeLinkPreviewMedia", () => {
    it("passes the three known values through", () => {
        expect(normalizeLinkPreviewMedia("all")).toBe("all");
        expect(normalizeLinkPreviewMedia("proxied")).toBe("proxied");
        expect(normalizeLinkPreviewMedia("none")).toBe("none");
    });

    it("falls back to the default for anything unrecognised", () => {
        for (const junk of [
            null,
            undefined,
            "",
            "ALL",
            "proxied ",
            "off",
            "1",
        ]) {
            expect(normalizeLinkPreviewMedia(junk)).toBe(
                DEFAULT_LINK_PREVIEW_MEDIA,
            );
        }
    });

    it("defaults to 'proxied' so third-party hosts never learn the reader's IP by default", () => {
        expect(DEFAULT_LINK_PREVIEW_MEDIA).toBe("proxied");
    });
});

describe("isMxcPreviewMedia", () => {
    it("accepts an mxc:// preview URL (homeserver-rehosted)", () => {
        expect(isMxcPreviewMedia("mxc://example.com/abc123")).toBe(true);
    });
    it("rejects a raw third-party http(s) URL (SEC-M1 sub-case b)", () => {
        expect(isMxcPreviewMedia("https://attacker.example/log?id=1")).toBe(
            false,
        );
        expect(isMxcPreviewMedia("http://pbs.twimg.com/a.jpg")).toBe(false);
    });
    it("is case-sensitive to the lowercase mxc scheme", () => {
        expect(isMxcPreviewMedia("MXC://example.com/abc")).toBe(false);
    });
    it("rejects a scheme-relative or bare value", () => {
        expect(isMxcPreviewMedia("//example.com/mxc://x")).toBe(false);
        expect(isMxcPreviewMedia("mxc:example.com/x")).toBe(false);
    });
    it("fails closed on null/undefined/empty", () => {
        expect(isMxcPreviewMedia(null)).toBe(false);
        expect(isMxcPreviewMedia(undefined)).toBe(false);
        expect(isMxcPreviewMedia("")).toBe(false);
    });
});

describe("allowsMediaAutoLoad", () => {
    it("allows any host under 'all'", () => {
        expect(
            allowsMediaAutoLoad("all", "https://pbs.twimg.com/a.jpg", HS),
        ).toBe(true);
        expect(
            allowsMediaAutoLoad("all", `${HS}/_matrix/media/x.png`, HS),
        ).toBe(true);
    });

    it("refuses an absent URL even under 'all'", () => {
        expect(allowsMediaAutoLoad("all", undefined, HS)).toBe(false);
        expect(allowsMediaAutoLoad("all", null, HS)).toBe(false);
        expect(allowsMediaAutoLoad("all", "", HS)).toBe(false);
    });

    it("blocks everything under 'none', homeserver media included", () => {
        expect(
            allowsMediaAutoLoad("none", `${HS}/_matrix/media/x.png`, HS),
        ).toBe(false);
        expect(
            allowsMediaAutoLoad("none", "https://pbs.twimg.com/a.jpg", HS),
        ).toBe(false);
    });

    it("allows only same-origin homeserver media under 'proxied'", () => {
        expect(
            allowsMediaAutoLoad(
                "proxied",
                `${HS}/_matrix/client/v1/media/download/s/abc`,
                HS,
            ),
        ).toBe(true);
        expect(
            allowsMediaAutoLoad("proxied", "https://pbs.twimg.com/a.jpg", HS),
        ).toBe(false);
        expect(
            allowsMediaAutoLoad("proxied", "https://media.tenor.com/a.mp4", HS),
        ).toBe(false);
    });

    it("is not fooled by userinfo or host-suffix lookalikes under 'proxied'", () => {
        expect(
            allowsMediaAutoLoad(
                "proxied",
                "https://matrix.example.com@evil.example/x.png",
                HS,
            ),
        ).toBe(false);
        expect(
            allowsMediaAutoLoad(
                "proxied",
                "https://matrix.example.com.evil.example/x.png",
                HS,
            ),
        ).toBe(false);
    });

    it("treats a different scheme or port as a different origin under 'proxied'", () => {
        expect(
            allowsMediaAutoLoad(
                "proxied",
                "http://matrix.example.com/x.png",
                HS,
            ),
        ).toBe(false);
        expect(
            allowsMediaAutoLoad(
                "proxied",
                "https://matrix.example.com:8448/x.png",
                HS,
            ),
        ).toBe(false);
    });

    it("matches a homeserver mounted under a base path", () => {
        expect(
            allowsMediaAutoLoad(
                "proxied",
                "https://example.com/matrix/_matrix/media/x.png",
                "https://example.com/matrix",
            ),
        ).toBe(true);
    });

    it("fails closed when the media URL is malformed", () => {
        expect(allowsMediaAutoLoad("proxied", "not a url", HS)).toBe(false);
    });

    it("fails closed when the homeserver base URL is missing or malformed", () => {
        expect(allowsMediaAutoLoad("proxied", `${HS}/x.png`, null)).toBe(false);
        expect(allowsMediaAutoLoad("proxied", `${HS}/x.png`, "")).toBe(false);
        expect(allowsMediaAutoLoad("proxied", `${HS}/x.png`, "not a url")).toBe(
            false,
        );
    });

    it("fails closed on a missing homeserver base without relying on isSameOrigin", async () => {
        // Defence in depth. The assertions above pass even with our own
        // `!homeserverBaseUrl` guard deleted, because `isSameOrigin` happens to
        // fail closed on `new URL(null)`. That is a collaborator's internal
        // detail: if it ever gained a permissive path, this module would start
        // auto-loading third-party media whenever the base URL was unknown.
        // Stub the collaborator wide open and require our own guard to hold.
        vi.resetModules();
        vi.doMock("$lib/utils/mxcUri", () => ({ isSameOrigin: () => true }));
        try {
            const mod = await import("./linkPreviewPolicy");
            expect(
                mod.allowsMediaAutoLoad("proxied", `${HS}/x.png`, null),
            ).toBe(false);
            expect(
                mod.allowsMediaAutoLoad("proxied", `${HS}/x.png`, undefined),
            ).toBe(false);
            expect(mod.allowsMediaAutoLoad("proxied", `${HS}/x.png`, "")).toBe(
                false,
            );
        } finally {
            vi.doUnmock("$lib/utils/mxcUri");
            vi.resetModules();
        }
    });
});

describe("allowsThirdPartyEmbed", () => {
    it("permits direct third-party embeds only under 'all'", () => {
        expect(allowsThirdPartyEmbed("all")).toBe(true);
        expect(allowsThirdPartyEmbed("proxied")).toBe(false);
        expect(allowsThirdPartyEmbed("none")).toBe(false);
    });
});
