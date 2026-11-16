import { describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({ isNative: false, platform: "web" }));
vi.mock("@capacitor/core", () => ({
    Capacitor: {
        isNativePlatform: () => native.isNative,
        getPlatform: () => native.platform,
    },
}));

import { installAndroidScriptTransform } from "./androidScriptTransform";

describe("installAndroidScriptTransform", () => {
    it("does nothing on the web", () => {
        native.isNative = false;
        native.platform = "web";
        expect(installAndroidScriptTransform()).toBe(false);
    });

    it("does nothing on a native non-Android platform", () => {
        native.isNative = true;
        native.platform = "ios";
        expect(installAndroidScriptTransform()).toBe(false);
    });
});
