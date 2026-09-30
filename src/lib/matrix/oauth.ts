// Native OAuth 2.0 / OIDC sign-in (Matrix spec "OAuth 2.0 API", MSC3861).
// Used when the homeserver publishes `/_matrix/client/v1/auth_metadata`;
// servers that do not keep using the password and legacy SSO paths.
//
// Flow: discover the provider, register this app once per (homeserver,
// redirect URI) with dynamic client registration, send the user to the
// provider with an authorization-code + PKCE request, and exchange the code
// when the browser comes back. The protocol pieces come from matrix-js-sdk's
// `OAuth2` class; this file owns discovery, the registration cache, the
// pending attempt and the callback checks.
//
// The callback rides the same channels as legacy SSO (see loginRedirect.ts):
//   - web:      this origin, `/?code=…&state=…`
//   - Electron: `<local server>/sso-callback?code=…&state=…` over IPC
//   - Android:  `moe.crafty.matrix:/oauth?code=…&state=…` deep link
//
// The random `state` is the anti-forgery nonce (128 bits). The Matrix scopes
// do not include `openid`, so no ID token is issued and there is no OIDC
// `nonce` claim to check; `state` plus PKCE bind the response to this attempt.
// As with legacy SSO, a callback whose state does not match leaves the pending
// attempt untouched, so a forged or stale link cannot cancel a real sign-in,
// and a URL that was already read is ignored (Android re-delivers its launch
// URL).

import { Capacitor } from "@capacitor/core";
import {
    OAuth2,
    OAuth2Error,
    isValidAuthMetadata,
    type ValidatedAuthMetadata,
} from "matrix-js-sdk";
import {
    NATIVE_SCHEME,
    isElectronWithSso,
    openLoginUrl,
} from "$lib/matrix/loginRedirect";

const PENDING_KEY = "zam_oauth_pending";
const CLIENTS_KEY = "zam_oauth_clients";
/** An attempt older than this is abandoned. */
const PENDING_TTL_MS = 30 * 60 * 1000;
const DISCOVERY_TIMEOUT_MS = 8000;
/** Where the project's public site lives: the `client_uri` off the web. */
const PROJECT_URI = "https://matrix.crafty.moe";
const ANDROID_REDIRECT = `${NATIVE_SCHEME}:/oauth`;

export interface PendingOAuth {
    state: string;
    codeVerifier: string;
    /** Device id baked into the requested scope; the session keeps it. */
    deviceId: string;
    clientId: string;
    issuer: string;
    /** Resolved homeserver base URL the flow started on. */
    baseUrl: string;
    redirectUri: string;
    slidingSync: boolean;
    createdAt: number;
}

export type OAuthCallback =
    | { kind: "ok"; code: string; pending: PendingOAuth }
    | {
          kind: "denied";
          error: string;
          description?: string;
          pending: PendingOAuth;
      }
    | { kind: "invalid" };

/** The provider (or this server) refused to register Zam as a client. */
export class OAuthRegistrationRefusedError extends Error {
    constructor(options?: { cause?: unknown }) {
        super("OAuth client registration refused", options);
        this.name = "OAuthRegistrationRefusedError";
    }
}

// ---------------------------------------------------------------- discovery

/**
 * The homeserver's validated OAuth metadata, or null when it does not offer
 * native OAuth (404 / M_UNRECOGNIZED, an invalid document, or an unreachable
 * server). Null is "use the legacy paths", never an error: discovery runs
 * while the user is still typing the address.
 */
export async function discoverOAuthMetadata(
    baseUrl: string,
    fetchFn: typeof fetch = (...args) => fetch(...args),
): Promise<ValidatedAuthMetadata | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
    try {
        const res = await fetchFn(
            `${baseUrl.replace(/\/$/, "")}/_matrix/client/v1/auth_metadata`,
            { signal: controller.signal },
        );
        if (!res.ok) return null;
        const doc: unknown = await res.json();
        return isValidAuthMetadata(doc) ? doc : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ------------------------------------------------------ redirect + metadata

export interface RedirectTarget {
    redirectUri: string;
    applicationType: "web" | "native";
    /** `client_uri` for registration; redirect hosts must share its base. */
    clientUri: string;
}

/**
 * Where the provider sends the browser back to, and how that is registered.
 * A https origin is a "web" client on its own site. Everything else is
 * "native": the Android custom scheme (reverse-DNS of `client_uri`'s host,
 * `moe.crafty.matrix` <-> `matrix.crafty.moe`), the Electron loopback server,
 * or an http dev server, which the spec only allows for native clients.
 */
export function redirectTarget(
    loc: { origin: string; protocol: string } = window.location,
): RedirectTarget {
    if (Capacitor.isNativePlatform()) {
        return {
            redirectUri: ANDROID_REDIRECT,
            applicationType: "native",
            clientUri: PROJECT_URI,
        };
    }
    const origin = loc.origin;
    if (isElectronWithSso()) {
        return {
            redirectUri: `${origin}/sso-callback`,
            applicationType: "native",
            clientUri: PROJECT_URI,
        };
    }
    if (loc.protocol === "https:") {
        return {
            redirectUri: `${origin}/`,
            applicationType: "web",
            clientUri: origin,
        };
    }
    return {
        redirectUri: `${origin}/`,
        applicationType: "native",
        clientUri: PROJECT_URI,
    };
}

// ----------------------------------------------------- client registration

interface RegisteredClient {
    clientId: string;
    issuer: string;
}

function clientKey(baseUrl: string, redirectUri: string): string {
    return `${baseUrl.replace(/\/$/, "")}|${redirectUri}`;
}

function readClients(): Record<string, RegisteredClient> {
    try {
        const raw = localStorage.getItem(CLIENTS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            return {};
        const out: Record<string, RegisteredClient> = {};
        for (const [k, v] of Object.entries(parsed)) {
            const c = v as Partial<RegisteredClient> | null;
            if (
                typeof c?.clientId === "string" &&
                c.clientId &&
                typeof c.issuer === "string"
            )
                out[k] = { clientId: c.clientId, issuer: c.issuer };
        }
        return out;
    } catch {
        return {};
    }
}

function writeClients(clients: Record<string, RegisteredClient>): void {
    try {
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
    } catch {
        // Storage blocked: the next attempt simply registers again.
    }
}

/**
 * The client id this app is registered under for `baseUrl` and the current
 * redirect URI, registering on first use. A cached id is only reused while the
 * homeserver still names the same issuer; a different issuer means the server
 * moved providers and the old registration means nothing there.
 */
export async function ensureClientId(
    baseUrl: string,
    metadata: ValidatedAuthMetadata,
    target: RedirectTarget,
): Promise<string> {
    const key = clientKey(baseUrl, target.redirectUri);
    const clients = readClients();
    const cached = clients[key];
    if (cached && cached.issuer === metadata.issuer) return cached.clientId;

    let clientId: string;
    try {
        clientId = await OAuth2.registerClient(metadata, {
            client_name: "Zam",
            client_uri: target.clientUri,
            application_type: target.applicationType,
            redirect_uris: [target.redirectUri],
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
            token_endpoint_auth_method: "none",
        });
    } catch (err) {
        if (
            err instanceof Error &&
            (err.message === OAuth2Error.DynamicRegistrationFailed ||
                err.message === OAuth2Error.DynamicRegistrationNotSupported ||
                err.message === OAuth2Error.DynamicRegistrationInvalid)
        ) {
            throw new OAuthRegistrationRefusedError({ cause: err });
        }
        throw err;
    }
    writeClients({
        ...clients,
        [key]: { clientId, issuer: metadata.issuer },
    });
    return clientId;
}

// ------------------------------------------------------------------ attempt

function randomState(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function savePending(p: PendingOAuth): void {
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    } catch {
        // Storage blocked: the callback will be rejected as unknown.
    }
}

function clearPending(): void {
    try {
        localStorage.removeItem(PENDING_KEY);
    } catch {
        // ignore storage errors
    }
}

/** The pending attempt, if any and not expired. Does not consume it. */
function readPending(): PendingOAuth | null {
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw) as Partial<PendingOAuth> | null;
        if (
            typeof p?.state !== "string" ||
            typeof p.codeVerifier !== "string" ||
            typeof p.deviceId !== "string" ||
            typeof p.clientId !== "string" ||
            typeof p.issuer !== "string" ||
            typeof p.baseUrl !== "string" ||
            typeof p.redirectUri !== "string" ||
            typeof p.createdAt !== "number" ||
            Date.now() - p.createdAt > PENDING_TTL_MS
        ) {
            clearPending();
            return null;
        }
        return p as PendingOAuth;
    } catch {
        return null;
    }
}

/**
 * Leave for the provider. Registers the client first when needed, so a
 * refused registration rejects here, before the page is left.
 */
export async function beginOAuthLogin(opts: {
    baseUrl: string;
    metadata: ValidatedAuthMetadata;
    register?: boolean;
    slidingSync: boolean;
}): Promise<void> {
    const target = redirectTarget();
    const clientId = await ensureClientId(opts.baseUrl, opts.metadata, target);
    const oauth2 = new OAuth2(opts.metadata, { clientId });
    const state = randomState();
    const wantsCreate =
        opts.register &&
        opts.metadata.prompt_values_supported?.includes("create");
    const url = await oauth2.generateAuthorizationCodeGrantUrl(
        state,
        target.redirectUri,
        "query",
        wantsCreate ? "create" : undefined,
    );
    savePending({
        state,
        codeVerifier: oauth2.context.codeVerifier,
        deviceId: oauth2.context.deviceId,
        clientId,
        issuer: opts.metadata.issuer,
        baseUrl: opts.baseUrl,
        redirectUri: target.redirectUri,
        slidingSync: opts.slidingSync,
        createdAt: Date.now(),
    });
    openLoginUrl(url);
}

// Callback URLs already read in this process (see the header comment).
const seenCallbacks = new Set<string>();

/**
 * Parse a URL the flow may have come back on. Null when it is not an OAuth
 * callback, was already read, or no attempt is pending (stale or unrelated).
 * "invalid" when the state does not match the pending attempt (which stays
 * pending) or the response names a different issuer (RFC 9207 mix-up
 * defence; that attempt is burned). A matching state consumes the attempt.
 */
export function readOAuthCallback(rawUrl: string): OAuthCallback | null {
    let url: URL;
    try {
        url = new URL(rawUrl, window.location.origin);
    } catch {
        return null;
    }
    if (!hasOAuthParams(url)) return null;
    if (seenCallbacks.has(url.href)) return null;
    seenCallbacks.add(url.href);
    const pending = readPending();
    if (!pending) return null;
    if (url.searchParams.get("state") !== pending.state)
        return { kind: "invalid" };
    clearPending();
    const iss = url.searchParams.get("iss");
    if (iss !== null && iss !== pending.issuer) return { kind: "invalid" };
    const error = url.searchParams.get("error");
    if (error) {
        return {
            kind: "denied",
            error,
            description: url.searchParams.get("error_description") ?? undefined,
            pending,
        };
    }
    const code = url.searchParams.get("code");
    if (!code) return { kind: "invalid" };
    return { kind: "ok", code, pending };
}

/** Whether a URL carries OAuth callback parameters (a code or an error, with a state). */
export function hasOAuthParams(url: URL): boolean {
    return (
        url.searchParams.has("state") &&
        (url.searchParams.has("code") || url.searchParams.has("error"))
    );
}

/**
 * Whether `rawUrl` is the return of the attempt saved here. Read-only: the
 * boot path uses it to skip session restore so the sign-in form can finish
 * the exchange instead of the previous account being restored over it.
 */
export function isPendingOAuthCallback(rawUrl: string): boolean {
    let url: URL;
    try {
        url = new URL(rawUrl, window.location.origin);
    } catch {
        return false;
    }
    if (!hasOAuthParams(url)) return false;
    const pending = readPending();
    return !!pending && url.searchParams.get("state") === pending.state;
}

/** `url` without the OAuth callback parameters. */
export function withoutOAuthParams(url: URL): URL {
    const clean = new URL(url);
    for (const p of [
        "code",
        "state",
        "error",
        "error_description",
        "error_uri",
        "iss",
    ])
        clean.searchParams.delete(p);
    // URLSearchParams writes a bare "?add" back as "?add="; keep it bare.
    clean.search = clean.search.replace(/=(?=&|$)/g, "");
    return clean;
}
