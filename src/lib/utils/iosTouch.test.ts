import { describe, expect, it } from "vitest";
import { isIosWebKit, markIosTouch } from "./iosTouch";

const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

describe("isIosWebKit", () => {
    it("matches an iPhone, including the app's WKWebView", () => {
        expect(isIosWebKit({ userAgent: IPHONE })).toBe(true);
    });

    it("matches iPadOS's desktop user agent by its touch points", () => {
        expect(
            isIosWebKit({
                userAgent: MAC,
                platform: "MacIntel",
                maxTouchPoints: 5,
            }),
        ).toBe(true);
    });

    it("leaves a Mac and Android alone", () => {
        expect(
            isIosWebKit({
                userAgent: MAC,
                platform: "MacIntel",
                maxTouchPoints: 0,
            }),
        ).toBe(false);
        expect(
            isIosWebKit({
                userAgent: ANDROID,
                platform: "Linux armv8l",
                maxTouchPoints: 5,
            }),
        ).toBe(false);
    });
});

describe("markIosTouch", () => {
    it("sets data-ios-touch on iOS only", () => {
        markIosTouch(document, { userAgent: ANDROID, maxTouchPoints: 5 });
        expect(document.documentElement.hasAttribute("data-ios-touch")).toBe(
            false,
        );
        markIosTouch(document, { userAgent: IPHONE });
        expect(document.documentElement.hasAttribute("data-ios-touch")).toBe(
            true,
        );
        document.documentElement.removeAttribute("data-ios-touch");
    });
});
