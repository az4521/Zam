import { describe, expect, it } from "vitest";
import { buildAccountManagementUrl } from "./oauthAccount";

describe("buildAccountManagementUrl", () => {
    const base = "https://auth.example/account/";
    const supported = [
        "org.matrix.sessions_list",
        "org.matrix.session_view",
        "org.matrix.account_deactivate",
    ];

    it("is null without a usable base", () => {
        expect(buildAccountManagementUrl(undefined)).toBeNull();
        expect(buildAccountManagementUrl("")).toBeNull();
        expect(buildAccountManagementUrl("not a url")).toBeNull();
    });

    it("refuses anything that is not https", () => {
        expect(buildAccountManagementUrl("javascript:alert(1)")).toBeNull();
        expect(buildAccountManagementUrl("http://auth.example/")).toBeNull();
        expect(buildAccountManagementUrl("data:text/html,x")).toBeNull();
    });

    it("returns the bare page when no action is asked for", () => {
        expect(buildAccountManagementUrl(base)).toBe(base);
    });

    it("adds an action only when the provider lists it", () => {
        expect(
            buildAccountManagementUrl(base, {
                action: "org.matrix.account_deactivate",
                supportedActions: supported,
            }),
        ).toBe(`${base}?action=org.matrix.account_deactivate`);
        expect(
            buildAccountManagementUrl(base, {
                action: "org.matrix.cross_signing_reset",
                supportedActions: supported,
            }),
        ).toBe(base);
        expect(
            buildAccountManagementUrl(base, {
                action: "org.matrix.sessions_list",
            }),
        ).toBe(base);
    });

    it("deep-links a single session with its device id", () => {
        const url = new URL(
            buildAccountManagementUrl(base, {
                action: "org.matrix.session_view",
                deviceId: "ABC",
                supportedActions: supported,
            })!,
        );
        expect(url.searchParams.get("action")).toBe("org.matrix.session_view");
        expect(url.searchParams.get("device_id")).toBe("ABC");
    });
});
