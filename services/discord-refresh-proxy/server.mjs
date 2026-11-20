// Stateless refresher for expired Discord attachment URLs.
// Zero dependencies: node:http and the global fetch (Node 18+).

import http from "node:http";
import { pathToFileURL } from "node:url";

export const DISCORD_REFRESH_URL =
    "https://discord.com/api/v10/attachments/refresh-urls";
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_URLS = 50;
export const MAX_URL_LENGTH = 2048;
export const UPSTREAM_TIMEOUT_MS = 15000;

const ALLOWED_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const ALLOWED_PATH_PREFIXES = ["/attachments/", "/ephemeral-attachments/"];

// True when the value is a Discord CDN attachment URL we are willing to refresh.
export function isValidAttachmentUrl(value) {
    if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.length > MAX_URL_LENGTH
    ) {
        return false;
    }
    let url;
    try {
        url = new URL(value);
    } catch {
        return false;
    }
    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (!ALLOWED_HOSTS.has(url.hostname)) return false;
    return ALLOWED_PATH_PREFIXES.some((prefix) =>
        url.pathname.startsWith(prefix),
    );
}

// True when the list is a non-empty array of at most MAX_URLS valid attachment URLs.
export function isValidUrlList(urls) {
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_URLS)
        return false;
    return urls.every(isValidAttachmentUrl);
}

// Keeps only entries whose refreshed URL is an https link on a Discord CDN host.
export function filterRefreshedUrls(refreshedUrls) {
    if (!Array.isArray(refreshedUrls)) return [];
    const out = [];
    for (const entry of refreshedUrls) {
        if (!entry || typeof entry !== "object") continue;
        const { original, refreshed } = entry;
        if (typeof original !== "string" || typeof refreshed !== "string")
            continue;
        let url;
        try {
            url = new URL(refreshed);
        } catch {
            continue;
        }
        if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname))
            continue;
        out.push({ original, refreshed });
    }
    return out;
}

// Parses the ALLOWED_ORIGINS env value. Returns "*" or an array of origins.
export function parseAllowedOrigins(value) {
    if (value === undefined || value === null) return "*";
    const trimmed = String(value).trim();
    if (trimmed === "" || trimmed === "*") return "*";
    return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

// Returns the Access-Control-Allow-Origin value, or null when the header must be omitted.
export function corsAllowOrigin(requestOrigin, allowedOrigins) {
    if (allowedOrigins === "*") return "*";
    if (
        typeof requestOrigin === "string" &&
        allowedOrigins.includes(requestOrigin)
    ) {
        return requestOrigin;
    }
    return null;
}

// Error class used to signal an oversized request body.
class BodyTooLargeError extends Error {}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new BodyTooLargeError("body too large"));
                req.resume();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

// Calls Discord once. Resolves to { status, retryAfter, body } or throws on network failure or timeout.
async function callDiscord(token, urls, fetchImpl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
        const res = await fetchImpl(DISCORD_REFRESH_URL, {
            method: "POST",
            headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ attachment_urls: urls }),
            signal: controller.signal,
        });
        let body = null;
        try {
            body = await res.json();
        } catch {
            body = null;
        }
        let retryAfter = null;
        if (res.status === 429) {
            const fromBody =
                body && typeof body === "object"
                    ? Number(body.retry_after)
                    : NaN;
            const fromHeader = Number(res.headers.get("retry-after"));
            if (Number.isFinite(fromBody)) retryAfter = fromBody;
            else if (Number.isFinite(fromHeader)) retryAfter = fromHeader;
        }
        return { status: res.status, retryAfter, body };
    } finally {
        clearTimeout(timer);
    }
}

export function createServer({
    token,
    fetchImpl = globalThis.fetch,
    allowedOrigins = "*",
    log = () => {},
} = {}) {
    if (!token) throw new Error("token is required");

    function sendJson(req, res, status, payload, extraHeaders = {}) {
        const origin = req.headers.origin;
        const headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
            Vary: "Origin",
            ...extraHeaders,
        };
        const allow = corsAllowOrigin(origin, allowedOrigins);
        if (allow !== null) headers["Access-Control-Allow-Origin"] = allow;
        res.writeHead(status, headers);
        res.end(JSON.stringify(payload));
    }

    function sendEmpty(req, res, status, extraHeaders = {}) {
        const headers = {
            "Cache-Control": "no-store",
            Vary: "Origin",
            ...extraHeaders,
        };
        const allow = corsAllowOrigin(req.headers.origin, allowedOrigins);
        if (allow !== null) headers["Access-Control-Allow-Origin"] = allow;
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type";
        headers["Access-Control-Max-Age"] = "600";
        res.writeHead(status, headers);
        res.end();
    }

    async function handleRefresh(req, res) {
        let raw;
        try {
            raw = await readBody(req);
        } catch (err) {
            if (err instanceof BodyTooLargeError) {
                return sendJson(
                    req,
                    res,
                    413,
                    { error: "too-large" },
                    { Connection: "close" },
                );
            }
            return sendJson(req, res, 400, { error: "bad-request" });
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return sendJson(req, res, 400, { error: "bad-json" });
        }

        const urls =
            parsed && typeof parsed === "object" ? parsed.urls : undefined;
        if (
            !Array.isArray(urls) ||
            urls.length === 0 ||
            urls.length > MAX_URLS
        ) {
            return sendJson(req, res, 400, { error: "bad-request" });
        }
        if (!urls.every(isValidAttachmentUrl)) {
            return sendJson(req, res, 400, { error: "bad-url" });
        }

        let upstream;
        try {
            upstream = await callDiscord(token, urls, fetchImpl);
        } catch {
            log("refresh: upstream unreachable");
            return sendJson(req, res, 502, { error: "unreachable" });
        }

        if (upstream.status === 429) {
            log("refresh: rate limited");
            const payload = { error: "rate-limited" };
            if (upstream.retryAfter !== null)
                payload.retryAfter = upstream.retryAfter;
            const headers = {};
            if (upstream.retryAfter !== null)
                headers["Retry-After"] = String(upstream.retryAfter);
            return sendJson(req, res, 429, payload, headers);
        }

        if (upstream.status < 200 || upstream.status > 299) {
            log(`refresh: upstream status ${upstream.status}`);
            return sendJson(req, res, 502, {
                error: "upstream",
                status: upstream.status,
            });
        }

        const refreshedUrls =
            upstream.body && typeof upstream.body === "object"
                ? upstream.body.refreshed_urls
                : undefined;
        if (!Array.isArray(refreshedUrls)) {
            log("refresh: unexpected upstream body");
            return sendJson(req, res, 502, {
                error: "upstream",
                status: upstream.status,
            });
        }

        const kept = filterRefreshedUrls(refreshedUrls);
        log(`refresh: ${urls.length} requested, ${kept.length} returned`);
        return sendJson(req, res, 200, { urls: kept });
    }

    return http.createServer((req, res) => {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        const method = req.method ?? "GET";

        if (method === "OPTIONS") {
            return sendEmpty(req, res, 204);
        }

        if (pathname === "/health") {
            if (method !== "GET")
                return sendJson(req, res, 405, { error: "method-not-allowed" });
            return sendJson(req, res, 200, { ok: true });
        }

        if (pathname === "/refresh") {
            if (method !== "POST")
                return sendJson(req, res, 405, { error: "method-not-allowed" });
            handleRefresh(req, res).catch(() => {
                if (!res.headersSent)
                    sendJson(req, res, 500, { error: "internal" });
            });
            return;
        }

        return sendJson(req, res, 404, { error: "not-found" });
    });
}

function runMain() {
    const token = (process.env.DISCORD_BOT_TOKEN ?? "").trim();
    if (!token) {
        console.error(
            "DISCORD_BOT_TOKEN is not set. Set it to your Discord bot token and start again.",
        );
        process.exit(1);
    }

    const port = Number(process.env.PORT ?? 8787);
    const host = process.env.HOST || "0.0.0.0";
    const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

    const server = createServer({
        token,
        allowedOrigins,
        log: (msg) => console.log(new Date().toISOString(), msg),
    });

    server.listen(port, host, () => {
        console.log(`zam-discord-refresh-proxy listening on ${host}:${port}`);
    });

    const shutdown = (signal) => {
        console.log(`${signal} received, shutting down`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 5000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

const isDirectRun =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) runMain();
