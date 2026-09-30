// SSO sign-in (m.login.sso / m.login.cas). Covers homeservers that sign users
// in through an external OIDC / OAuth / SAML provider, and OIDC-native servers
// (Matrix Authentication Service) through their compat SSO layer.
//
// The flow leaves the app: the homeserver's SSO page runs in a browser and
// redirects back with a one-time `loginToken`, which is then redeemed via
// m.login.token. Where it comes back depends on the runtime:
//   - web:      this origin, `/?sso_state=…&loginToken=…` (full page load)
//   - Electron: the system browser hits the app's local server at
//               `/sso-callback`, which forwards it over IPC (electron/main.cjs)
//   - Android:  the `moe.crafty.matrix://sso` deep link (AndroidManifest.xml)
// A random `sso_state` nonce round-trips through the redirect and must match
// the pending attempt saved here before a token is ever redeemed.

import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { getSsoRedirectUrl } from "$lib/matrix/client";

const PENDING_KEY = "zam_sso_pending";
const STATE_PARAM = "sso_state";
const TOKEN_PARAM = "loginToken";
const NATIVE_CALLBACK = "moe.crafty.matrix://sso";
/** An attempt older than this is abandoned (the token itself expires fast). */
const PENDING_TTL_MS = 30 * 60 * 1000;

export interface PendingSso {
    state: string;
    /** Resolved homeserver base URL the flow started on. */
    baseUrl: string;
    slidingSync: boolean;
    addMode: boolean;
    createdAt: number;
}

export type SsoCallback =
    | { kind: "ok"; loginToken: string; pending: PendingSso }
    | { kind: "invalid" };

function randomState(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function savePending(p: PendingSso): void {
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify(p));
    } catch {
        // Storage blocked: the callback will be rejected as unknown.
    }
}

/** The pending attempt, if any and not expired. Does not consume it. */
function readPending(): PendingSso | null {
    try {
        const raw = localStorage.getItem(PENDING_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw) as PendingSso;
        if (
            typeof p?.state !== "string" ||
            typeof p.baseUrl !== "string" ||
            Date.now() - p.createdAt > PENDING_TTL_MS
        ) {
            clearPending();
            return null;
        }
        return p;
    } catch {
        return null;
    }
}

function clearPending(): void {
    try {
        localStorage.removeItem(PENDING_KEY);
    } catch {
        // ignore storage errors
    }
}

// Callback URLs already read in this process. Android keeps handing back the
// launch URL that cold-started the app, so it must not be replayed against a
// later attempt.
const seenCallbacks = new Set<string>();

function isElectronWithSso(): boolean {
    return typeof window !== "undefined" && !!window.desktop?.sso;
}

/** Where the homeserver should send the browser back to, per runtime. */
function callbackUrl(state: string, addMode: boolean): string {
    if (Capacitor.isNativePlatform()) {
        return `${NATIVE_CALLBACK}?${STATE_PARAM}=${state}`;
    }
    if (isElectronWithSso()) {
        return `${window.location.origin}/sso-callback?${STATE_PARAM}=${state}`;
    }
    // Keep "?add" so the reload lands back on the add-account form rather
    // than restoring the already-active account.
    const add = addMode ? "add&" : "";
    return `${window.location.origin}/?${add}${STATE_PARAM}=${state}`;
}

/** Leave for the homeserver's SSO page. */
export function beginSsoLogin(opts: {
    baseUrl: string;
    loginType: "sso" | "cas";
    idpId?: string;
    register?: boolean;
    slidingSync: boolean;
    addMode: boolean;
}): void {
    const state = randomState();
    savePending({
        state,
        baseUrl: opts.baseUrl,
        slidingSync: opts.slidingSync,
        addMode: opts.addMode,
        createdAt: Date.now(),
    });
    const url = getSsoRedirectUrl(
        opts.baseUrl,
        callbackUrl(state, opts.addMode),
        {
            loginType: opts.loginType,
            idpId: opts.idpId,
            register: opts.register,
        },
    );
    if (isElectronWithSso()) {
        // The window-open handler hands this to the system browser.
        window.open(url, "_blank", "noopener");
    } else {
        // Web: a plain navigation. Capacitor sends off-app navigations to the
        // system browser.
        window.location.assign(url);
    }
}

/**
 * Parse a URL the SSO flow may have come back on. Returns null when it
 * carries no loginToken, was already read, or no attempt is pending (a stale
 * or unrelated URL); "invalid" when the nonce does not match the pending
 * attempt, which stays pending. Only a match consumes the attempt.
 */
export function readSsoCallback(rawUrl: string): SsoCallback | null {
    let url: URL;
    try {
        url = new URL(rawUrl, window.location.origin);
    } catch {
        return null;
    }
    const loginToken = url.searchParams.get(TOKEN_PARAM);
    if (!loginToken) return null;
    if (seenCallbacks.has(url.href)) return null;
    seenCallbacks.add(url.href);
    const pending = readPending();
    if (!pending) return null;
    // A mismatched nonce leaves the pending attempt untouched: a forged or
    // stale callback must not be able to cancel the real sign-in.
    if (url.searchParams.get(STATE_PARAM) !== pending.state)
        return { kind: "invalid" };
    clearPending();
    return { kind: "ok", loginToken, pending };
}

/** Whether a URL carries SSO callback parameters worth stripping. */
export function hasSsoParams(url: URL): boolean {
    return (
        url.searchParams.has(TOKEN_PARAM) || url.searchParams.has(STATE_PARAM)
    );
}

/** `url` without the SSO callback parameters. */
export function withoutSsoParams(url: URL): URL {
    const clean = new URL(url);
    clean.searchParams.delete(TOKEN_PARAM);
    clean.searchParams.delete(STATE_PARAM);
    // URLSearchParams writes a bare "?add" back as "?add="; keep it bare.
    clean.search = clean.search.replace(/=(?=&|$)/g, "");
    return clean;
}

/**
 * Deliver SSO callback URLs as they arrive: the current page (web), the
 * Electron local-server relay, or the Android deep link (including the one
 * that cold-started the app). Returns a disposer.
 */
export function listenForSsoCallbacks(
    cb: (rawUrl: string) => void,
): () => void {
    const disposers: Array<() => void> = [];

    if (hasSsoParams(new URL(window.location.href))) cb(window.location.href);

    if (window.desktop?.sso) {
        disposers.push(window.desktop.sso.onCallback(cb));
    }

    if (Capacitor.isNativePlatform()) {
        let disposed = false;
        const isOurs = (u: string) => u.startsWith(NATIVE_CALLBACK);
        App.getLaunchUrl()
            .then((launch) => {
                if (!disposed && launch?.url && isOurs(launch.url))
                    cb(launch.url);
            })
            .catch(() => {});
        const handle = App.addListener("appUrlOpen", (e) => {
            if (isOurs(e.url)) cb(e.url);
        });
        disposers.push(() => {
            disposed = true;
            void handle.then((h) => h.remove()).catch(() => {});
        });
    }

    return () => disposers.forEach((d) => d());
}
