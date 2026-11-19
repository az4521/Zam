// Pure helpers for the Telegram sticker proxy: build-time config, URL
// building for both transports, and the fallback decision. No network, no SDK.
//
// Neither the proxy key nor a bot token is ever placed in an error message
// created here. Callers must not surface URLs either.

export const DEFAULT_TG_PROXY_URL = "https://zam.crafty.moe/tg";

export interface TelegramProxyConfig {
    /** Base URL without a trailing slash, for example https://host/tg */
    baseUrl: string;
    /** Deterrence key sent as the `k` query parameter. Empty means none. */
    key: string;
}

/** Direct mode uses the user's own bot token; proxy mode uses the proxy. */
export type TelegramSource =
    | { mode: "direct"; token: string }
    | { mode: "proxy"; config: TelegramProxyConfig };

export type ProxyFailureReason = "forbidden" | "unavailable";

/**
 * A proxy-side failure: the key was rejected (403) or the proxy or Telegram
 * behind it is unreachable (502/503/504 or a network error). Carries no URL,
 * key or token.
 */
export class TelegramProxyError extends Error {
    readonly reason: ProxyFailureReason;
    constructor(reason: ProxyFailureReason) {
        super(`telegram proxy ${reason}`);
        this.name = "TelegramProxyError";
        this.reason = reason;
    }
}

type EnvLike = Record<string, string | undefined>;

/**
 * Reads the build-time proxy settings. An unset VITE_TG_PROXY_URL uses the
 * default. Setting it to an empty string turns the proxy off entirely, so only
 * the bot-token flow remains.
 */
export function telegramProxyConfig(
    env: EnvLike = import.meta.env as EnvLike,
): TelegramProxyConfig | null {
    const raw = env.VITE_TG_PROXY_URL;
    const baseUrl = (raw === undefined ? DEFAULT_TG_PROXY_URL : raw)
        .trim()
        .replace(/\/+$/, "");
    if (!baseUrl) return null;
    return { baseUrl, key: (env.VITE_TG_PROXY_KEY ?? "").trim() };
}

/**
 * Picks the transport: a typed bot token always wins (the user's own
 * credentials), otherwise the proxy when one is configured.
 */
export function chooseTelegramSource(
    token: string,
    proxy: TelegramProxyConfig | null,
): TelegramSource | null {
    const botToken = token.trim();
    if (botToken) return { mode: "direct", token: botToken };
    if (proxy) return { mode: "proxy", config: proxy };
    return null;
}

/** Builds a query string from params, adding `k` only when a key is set. */
function queryString(params: Record<string, string>, key: string): string {
    const search = new URLSearchParams(params);
    if (key) search.set("k", key);
    return search.toString();
}

function withQuery(url: string, query: string): string {
    return query ? `${url}?${query}` : url;
}

/**
 * Encodes a Telegram file path segment by segment, so `dir/name` stays
 * `dir/name`. Empty, `.` and `..` segments are refused.
 */
export function encodeFilePath(filePath: string): string {
    const segments = filePath.split("/");
    if (
        segments.some(
            (segment) => segment === "" || segment === "." || segment === "..",
        )
    ) {
        throw new Error("invalid telegram file path");
    }
    return segments.map((segment) => encodeURIComponent(segment)).join("/");
}

/**
 * URL for the proxy. "api" takes a Bot API method name, "file" takes the
 * file_path returned by getFile.
 *
 *   api  -> P/api/<method>?<params>&k=<K>
 *   file -> P/file/<file_path>?k=<K>
 */
export function buildProxyUrl(
    kind: "api" | "file",
    pathOrMethod: string,
    params: Record<string, string>,
    cfg: TelegramProxyConfig,
): string {
    const base = cfg.baseUrl.replace(/\/+$/, "");
    if (kind === "api") {
        const url = `${base}/api/${encodeURIComponent(pathOrMethod)}`;
        return withQuery(url, queryString(params, cfg.key));
    }
    // The file route takes only the key; the proxy rewrite drops other params.
    const url = `${base}/file/${encodeFilePath(pathOrMethod)}`;
    return withQuery(url, queryString({}, cfg.key));
}

/**
 * Direct Bot API URL, used when the user supplies their own token. The token
 * is part of the path, exactly as Telegram documents it.
 */
export function buildBotApiUrl(
    token: string,
    kind: "api" | "file",
    pathOrMethod: string,
    params: Record<string, string>,
): string {
    if (kind === "api") {
        const url = `https://api.telegram.org/bot${token}/${pathOrMethod}`;
        return withQuery(url, queryString(params, ""));
    }
    return `https://api.telegram.org/file/bot${token}/${encodeFilePath(pathOrMethod)}`;
}

/** Maps an HTTP status from the proxy to a failure, or null when it is not one. */
export function proxyFailureFromStatus(
    status: number,
): ProxyFailureReason | null {
    if (status === 403) return "forbidden";
    if (status === 502 || status === 503 || status === 504)
        return "unavailable";
    return null;
}

/**
 * Whether to stop the import and offer the "use my own bot token" fallback.
 * Only proxy mode falls back, only on a proxy-side failure, and only when no
 * sticker has been imported yet. A cancelled import never falls back.
 */
export function shouldOfferOwnToken(input: {
    mode: "direct" | "proxy";
    proxyFailed: boolean;
    imported: number;
    cancelled: boolean;
}): boolean {
    return (
        input.mode === "proxy" &&
        input.proxyFailed &&
        input.imported === 0 &&
        !input.cancelled
    );
}
