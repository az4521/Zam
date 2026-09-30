import { describe, expect, it } from "vitest";
import type { LoginFlow } from "matrix-js-sdk";
import { parseLoginFlows } from "./loginFlows";

describe("parseLoginFlows", () => {
    it("reports password-only servers", () => {
        expect(parseLoginFlows([{ type: "m.login.password" }])).toEqual({
            password: true,
            sso: null,
        });
    });

    it("reads SSO providers and skips malformed ones", () => {
        const flows = [
            { type: "m.login.password" },
            {
                type: "m.login.sso",
                identity_providers: [
                    { id: "oidc-github", name: "GitHub", brand: "github" },
                    { id: "", name: "Broken" },
                    { name: "No id" },
                ],
            },
            { type: "m.login.token" },
        ] as LoginFlow[];
        expect(parseLoginFlows(flows)).toEqual({
            password: true,
            sso: {
                loginType: "sso",
                providers: [
                    { id: "oidc-github", name: "GitHub", brand: "github" },
                ],
                preferred: false,
            },
        });
    });

    it("flags OIDC-native servers (MSC3824) that prefer SSO", () => {
        const stable = parseLoginFlows([
            { type: "m.login.sso", oauth_aware_preferred: true },
        ] as LoginFlow[]);
        expect(stable.password).toBe(false);
        expect(stable.sso).toEqual({
            loginType: "sso",
            providers: [],
            preferred: true,
        });
        const unstable = parseLoginFlows([
            {
                type: "m.login.sso",
                "org.matrix.msc3824.delegated_oidc_compatibility": true,
            },
        ] as LoginFlow[]);
        expect(unstable.sso?.preferred).toBe(true);
    });

    it("falls back to CAS when m.login.sso is absent", () => {
        expect(
            parseLoginFlows([{ type: "m.login.cas" }] as LoginFlow[]).sso
                ?.loginType,
        ).toBe("cas");
    });
});
