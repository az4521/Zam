import type { LoginFlow } from "matrix-js-sdk";

export interface SsoProvider {
    id: string;
    name: string;
    brand?: string;
}

export interface LoginOptions {
    /** The homeserver accepts m.login.password. */
    password: boolean;
    /**
     * SSO sign-in, when offered. `loginType` is "sso" for m.login.sso (OIDC,
     * SAML, OAuth providers and OIDC-native servers through their compat
     * layer) or "cas" for a server that only speaks m.login.cas. `providers`
     * is empty when the server lets its own page pick the provider.
     */
    sso: {
        loginType: "sso" | "cas";
        providers: SsoProvider[];
        /** MSC3824: the server delegates auth to OIDC and prefers SSO. */
        preferred: boolean;
    } | null;
}

/** Read the GET /login flows into what the sign-in form needs to show. */
export function parseLoginFlows(flows: LoginFlow[]): LoginOptions {
    const password = flows.some((f) => f.type === "m.login.password");
    const ssoFlow =
        flows.find((f) => f.type === "m.login.sso") ??
        flows.find((f) => f.type === "m.login.cas");
    if (!ssoFlow) return { password, sso: null };

    const raw = ssoFlow as {
        identity_providers?: unknown;
        oauth_aware_preferred?: unknown;
        "org.matrix.msc3824.delegated_oidc_compatibility"?: unknown;
    };
    const providers: SsoProvider[] = [];
    if (Array.isArray(raw.identity_providers)) {
        for (const idp of raw.identity_providers) {
            if (
                idp &&
                typeof idp.id === "string" &&
                idp.id &&
                typeof idp.name === "string"
            ) {
                providers.push({
                    id: idp.id,
                    name: idp.name || idp.id,
                    brand:
                        typeof idp.brand === "string" ? idp.brand : undefined,
                });
            }
        }
    }
    return {
        password,
        sso: {
            loginType: ssoFlow.type === "m.login.cas" ? "cas" : "sso",
            providers,
            preferred:
                raw.oauth_aware_preferred === true ||
                raw["org.matrix.msc3824.delegated_oidc_compatibility"] === true,
        },
    };
}
