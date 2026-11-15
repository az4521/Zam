import { describe, expect, it } from "vitest";
import { buildAccountManagementUrl } from "./oauthAccount";

describe("buildAccountManagementUrl", () => {
    const base = "https://auth.example/account/";
    const supported = [
        "org.matrix.devices_list",
        "org.matrix.device_view",
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
                action: "org.matrix.devices_list",
            }),
        ).toBe(base);
    });

    it("uses the stable action name when the provider only lists that", () => {
        expect(
            buildAccountManagementUrl(base, {
                action: "org.matrix.devices_list",
                supportedActions: ["org.matrix.devices_list"],
            }),
        ).toBe(`${base}?action=org.matrix.devices_list`);
    });

    it("falls back to the legacy action name for a legacy-only provider", () => {
        const url = new URL(
            buildAccountManagementUrl(base, {
                action: "org.matrix.devices_list",
                supportedActions: ["org.matrix.sessions_list"],
            })!,
        );
        expect(url.searchParams.get("action")).toBe("org.matrix.sessions_list");
        expect(url.searchParams.has("device_id")).toBe(false);
    });

    it("prefers the stable name when both are listed", () => {
        const url = new URL(
            buildAccountManagementUrl(base, {
                action: "org.matrix.device_view",
                deviceId: "ABC",
                supportedActions: [
                    "org.matrix.session_view",
                    "org.matrix.device_view",
                ],
            })!,
        );
        expect(url.searchParams.get("action")).toBe("org.matrix.device_view");
        expect(url.searchParams.get("device_id")).toBe("ABC");
    });

    it("deep-links a single device with its device id", () => {
        const url = new URL(
            buildAccountManagementUrl(base, {
                action: "org.matrix.device_view",
                deviceId: "ABC",
                supportedActions: supported,
            })!,
        );
        expect(url.searchParams.get("action")).toBe("org.matrix.device_view");
        expect(url.searchParams.get("device_id")).toBe("ABC");
    });

    it("deep-links a legacy session_view with its device id", () => {
        const url = new URL(
            buildAccountManagementUrl(base, {
                action: "org.matrix.device_view",
                deviceId: "ABC",
                supportedActions: ["org.matrix.session_view"],
            })!,
        );
        expect(url.searchParams.get("action")).toBe("org.matrix.session_view");
        expect(url.searchParams.get("device_id")).toBe("ABC");
    });

    it("adds device_id for device_delete, stable and legacy", () => {
        for (const name of [
            "org.matrix.device_delete",
            "org.matrix.session_end",
        ]) {
            const url = new URL(
                buildAccountManagementUrl(base, {
                    action: "org.matrix.device_delete",
                    deviceId: "XYZ",
                    supportedActions: [name],
                })!,
            );
            expect(url.searchParams.get("action")).toBe(name);
            expect(url.searchParams.get("device_id")).toBe("XYZ");
        }
    });
});
