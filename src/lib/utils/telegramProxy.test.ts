import { describe, expect, it } from "vitest";
import {
    buildBotApiUrl,
    buildProxyUrl,
    chooseTelegramSource,
    DEFAULT_TG_PROXY_URL,
    encodeFilePath,
    proxyFailureFromStatus,
    shouldOfferOwnToken,
    telegramProxyConfig,
    TelegramProxyError,
} from "$lib/utils/telegramProxy";

const cfg = { baseUrl: "https://zam.example/tg", key: "KEY123" };
const noKey = { baseUrl: "https://zam.example/tg", key: "" };

describe("telegramProxyConfig", () => {
    it("uses the default URL and an empty key when nothing is set", () => {
        expect(telegramProxyConfig({})).toEqual({
            baseUrl: DEFAULT_TG_PROXY_URL,
            key: "",
        });
    });

    it("strips trailing slashes and trims the key", () => {
        expect(
            telegramProxyConfig({
                VITE_TG_PROXY_URL: "https://h.example/tg//",
                VITE_TG_PROXY_KEY: "  k  ",
            }),
        ).toEqual({ baseUrl: "https://h.example/tg", key: "k" });
    });

    it("uses the default URL when the URL is an empty string", () => {
        // CI expands an unset variable or secret to "".
        expect(
            telegramProxyConfig({
                VITE_TG_PROXY_URL: "",
                VITE_TG_PROXY_KEY: "",
            }),
        ).toEqual({ baseUrl: DEFAULT_TG_PROXY_URL, key: "" });
    });

    it("turns the proxy off when the URL is set to off", () => {
        expect(telegramProxyConfig({ VITE_TG_PROXY_URL: "off" })).toBeNull();
        expect(telegramProxyConfig({ VITE_TG_PROXY_URL: " OFF " })).toBeNull();
    });
});

describe("buildProxyUrl", () => {
    it("builds an api URL with the key appended after the params", () => {
        expect(
            buildProxyUrl("api", "getStickerSet", { name: "Pack_1" }, cfg),
        ).toBe("https://zam.example/tg/api/getStickerSet?name=Pack_1&k=KEY123");
    });

    it("omits k when no key is configured", () => {
        expect(buildProxyUrl("api", "getFile", { file_id: "abc" }, noKey)).toBe(
            "https://zam.example/tg/api/getFile?file_id=abc",
        );
    });

    it("leaves no trailing ? when there are no params and no key", () => {
        expect(buildProxyUrl("api", "getFile", {}, noKey)).toBe(
            "https://zam.example/tg/api/getFile",
        );
    });

    it("keeps the file path as dir/name and passes only k", () => {
        expect(buildProxyUrl("file", "stickers/file_12.webp", {}, cfg)).toBe(
            "https://zam.example/tg/file/stickers/file_12.webp?k=KEY123",
        );
        expect(buildProxyUrl("file", "stickers/file_12.webp", {}, noKey)).toBe(
            "https://zam.example/tg/file/stickers/file_12.webp",
        );
    });

    it("percent-encodes params that need it", () => {
        expect(
            buildProxyUrl("api", "getFile", { file_id: "a+b c" }, noKey),
        ).toBe("https://zam.example/tg/api/getFile?file_id=a%2Bb+c");
    });
});

describe("encodeFilePath", () => {
    it("encodes segments and rejects traversal", () => {
        expect(encodeFilePath("stickers/file_1.tgs")).toBe(
            "stickers/file_1.tgs",
        );
        expect(encodeFilePath("a b/c")).toBe("a%20b/c");
        expect(() => encodeFilePath("../etc/passwd")).toThrow();
        expect(() => encodeFilePath("a//b")).toThrow();
    });
});

describe("buildBotApiUrl", () => {
    it("builds the direct api URL with the token in the path", () => {
        expect(
            buildBotApiUrl("123:T", "api", "getStickerSet", { name: "Pack" }),
        ).toBe("https://api.telegram.org/bot123:T/getStickerSet?name=Pack");
    });

    it("builds the direct file URL without a query", () => {
        expect(
            buildBotApiUrl("123:T", "file", "stickers/file_2.webp", {}),
        ).toBe("https://api.telegram.org/file/bot123:T/stickers/file_2.webp");
    });
});

describe("chooseTelegramSource", () => {
    it("prefers a typed bot token over the proxy", () => {
        expect(chooseTelegramSource("  123:T ", cfg)).toEqual({
            mode: "direct",
            token: "123:T",
        });
    });

    it("uses the proxy when no token is typed", () => {
        expect(chooseTelegramSource("   ", cfg)).toEqual({
            mode: "proxy",
            config: cfg,
        });
    });

    it("returns null when there is neither a token nor a proxy", () => {
        expect(chooseTelegramSource("", null)).toBeNull();
    });
});

describe("proxyFailureFromStatus", () => {
    it("maps 403 to forbidden and 502/503/504 to unavailable", () => {
        expect(proxyFailureFromStatus(403)).toBe("forbidden");
        expect(proxyFailureFromStatus(502)).toBe("unavailable");
        expect(proxyFailureFromStatus(503)).toBe("unavailable");
        expect(proxyFailureFromStatus(504)).toBe("unavailable");
    });

    it("returns null for other statuses", () => {
        expect(proxyFailureFromStatus(200)).toBeNull();
        expect(proxyFailureFromStatus(400)).toBeNull();
        expect(proxyFailureFromStatus(405)).toBeNull();
    });
});

describe("TelegramProxyError", () => {
    it("carries only the reason, not a URL or key", () => {
        const err = new TelegramProxyError("forbidden");
        expect(err.reason).toBe("forbidden");
        expect(err.message).not.toContain("KEY");
    });
});

describe("shouldOfferOwnToken", () => {
    const base = {
        mode: "proxy" as const,
        proxyFailed: true,
        imported: 0,
        cancelled: false,
    };

    it("offers the token fallback on a proxy failure before any import", () => {
        expect(shouldOfferOwnToken(base)).toBe(true);
    });

    it("does not offer it in direct mode", () => {
        expect(shouldOfferOwnToken({ ...base, mode: "direct" })).toBe(false);
    });

    it("does not offer it when no proxy failure happened", () => {
        expect(shouldOfferOwnToken({ ...base, proxyFailed: false })).toBe(
            false,
        );
    });

    it("does not offer it once a sticker has been imported", () => {
        expect(shouldOfferOwnToken({ ...base, imported: 1 })).toBe(false);
    });

    it("does not offer it after a cancel", () => {
        expect(shouldOfferOwnToken({ ...base, cancelled: true })).toBe(false);
    });
});
