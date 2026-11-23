import { describe, expect, it } from "vitest";
import {
    chooseInstallUi,
    isIosDevice,
    isIosSafari,
    type InstallEnv,
} from "./installPrompt";

const IPHONE_SAFARI =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_SAFARI =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const MAC_SAFARI = IPAD_DESKTOP_SAFARI;
const IPHONE_CHROME =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function env(over: Partial<InstallEnv> = {}): InstallEnv {
    return {
        ua: ANDROID_CHROME,
        maxTouchPoints: 5,
        standalone: false,
        isNative: false,
        isElectron: false,
        canPrompt: false,
        ...over,
    };
}

describe("isIosDevice", () => {
    it("detects iPhone and iPod by UA", () => {
        expect(isIosDevice(IPHONE_SAFARI, 5)).toBe(true);
        expect(
            isIosDevice("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0)", 5),
        ).toBe(true);
    });

    it("detects iPadOS that reports a Mac UA via touch points", () => {
        expect(isIosDevice(IPAD_DESKTOP_SAFARI, 5)).toBe(true);
    });

    it("does not treat a touchless Mac as iOS", () => {
        expect(isIosDevice(MAC_SAFARI, 0)).toBe(false);
    });

    it("does not treat Android or Windows as iOS", () => {
        expect(isIosDevice(ANDROID_CHROME, 5)).toBe(false);
        expect(isIosDevice(DESKTOP_CHROME, 0)).toBe(false);
    });
});

describe("isIosSafari", () => {
    it("accepts iPhone and iPadOS Safari", () => {
        expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true);
        expect(isIosSafari(IPAD_DESKTOP_SAFARI, 5)).toBe(true);
    });

    it("rejects third-party iOS browsers", () => {
        expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false);
    });

    it("rejects non-iOS Safari-like UAs", () => {
        expect(isIosSafari(MAC_SAFARI, 0)).toBe(false);
    });
});

describe("chooseInstallUi", () => {
    it("offers the native prompt when the event was captured", () => {
        expect(chooseInstallUi(env({ canPrompt: true }))).toBe("prompt");
    });

    it("prefers the prompt over the iOS hint if both somehow apply", () => {
        expect(
            chooseInstallUi(env({ ua: IPHONE_SAFARI, canPrompt: true })),
        ).toBe("prompt");
    });

    it("shows the iOS manual hint on iOS Safari outside standalone", () => {
        expect(chooseInstallUi(env({ ua: IPHONE_SAFARI }))).toBe("ios-hint");
        expect(
            chooseInstallUi(
                env({ ua: IPAD_DESKTOP_SAFARI, maxTouchPoints: 5 }),
            ),
        ).toBe("ios-hint");
    });

    it("shows nothing on iOS when already standalone", () => {
        expect(
            chooseInstallUi(env({ ua: IPHONE_SAFARI, standalone: true })),
        ).toBe("none");
    });

    it("shows nothing on iOS Chrome (no manual hint)", () => {
        expect(chooseInstallUi(env({ ua: IPHONE_CHROME }))).toBe("none");
    });

    it("shows nothing when already installed, even with a captured event", () => {
        expect(
            chooseInstallUi(env({ canPrompt: true, standalone: true })),
        ).toBe("none");
    });

    it("is inert inside Capacitor native", () => {
        expect(chooseInstallUi(env({ isNative: true, canPrompt: true }))).toBe(
            "none",
        );
        expect(
            chooseInstallUi(env({ isNative: true, ua: IPHONE_SAFARI })),
        ).toBe("none");
    });

    it("is inert inside Electron", () => {
        expect(
            chooseInstallUi(env({ isElectron: true, canPrompt: true })),
        ).toBe("none");
    });

    it("shows nothing on desktop Chrome without an event", () => {
        expect(
            chooseInstallUi(env({ ua: DESKTOP_CHROME, maxTouchPoints: 0 })),
        ).toBe("none");
    });
});
