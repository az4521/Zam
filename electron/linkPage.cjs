// Link previews: fetch a page (or an image) from the user's device with a
// bot-style User-Agent, so the renderer can build a preview to bundle into a
// sent message. Browsers cannot do this (CORS, and the UA header is forbidden),
// so the main process does it through net.fetch (the user's proxy applies).
//
// Every hop is checked before it is requested: http(s) only, no credentials,
// and every resolved address must be public. Redirects are followed by hand so
// each target is checked. Everything here fails closed: any error gives null.
// Dependencies are injected so the module is testable without the network.

const net = require("net");

const USER_AGENT =
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots) WhatsApp/2.23.20.0";
const MAX_HTML_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 8000;

const PAGE_ACCEPT =
    "text/html,application/xhtml+xml;q=0.9,image/*;q=0.8,*/*;q=0.5";
const IMAGE_ACCEPT = "image/*";

function isPublicIPv4(ip) {
    const o = ip.split(".").map(Number);
    if (
        o.length !== 4 ||
        o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    ) {
        return false;
    }
    const [a, b, c] = o;
    if (a === 0) return false; // 0.0.0.0/8
    if (a === 10) return false; // 10/8
    if (a === 100 && b >= 64 && b <= 127) return false; // 100.64/10
    if (a === 127) return false; // 127/8
    if (a === 169 && b === 254) return false; // 169.254/16
    if (a === 172 && b >= 16 && b <= 31) return false; // 172.16/12
    if (a === 192 && b === 0 && c === 0) return false; // 192.0.0/24
    if (a === 192 && b === 0 && c === 2) return false; // 192.0.2/24
    if (a === 192 && b === 168) return false; // 192.168/16
    if (a === 198 && (b === 18 || b === 19)) return false; // 198.18/15
    if (a === 198 && b === 51 && c === 100) return false; // 198.51.100/24
    if (a === 203 && b === 0 && c === 113) return false; // 203.0.113/24
    if (a >= 224) return false; // multicast, reserved, broadcast
    return true;
}

// Expands an IPv6 literal to eight 16-bit groups (null if it does not parse).
// Input has already passed net.isIP.
function ipv6Groups(ip) {
    let s = ip.split("%")[0];
    const lastColon = s.lastIndexOf(":");
    const tailPart = s.slice(lastColon + 1);
    if (tailPart.includes(".")) {
        const o = tailPart.split(".").map(Number);
        s =
            s.slice(0, lastColon + 1) +
            ((o[0] << 8) | o[1]).toString(16) +
            ":" +
            ((o[2] << 8) | o[3]).toString(16);
    }
    const halves = s.split("::");
    if (halves.length > 2) return null;
    const head = halves[0] ? halves[0].split(":") : [];
    let groups;
    if (halves.length === 2) {
        const tail = halves[1] ? halves[1].split(":") : [];
        const fill = 8 - head.length - tail.length;
        if (fill < 0) return null;
        groups = [...head, ...Array(fill).fill("0"), ...tail];
    } else {
        groups = head;
    }
    if (groups.length !== 8) return null;
    return groups.map((g) => parseInt(g, 16));
}

function isPublicAddress(ip) {
    if (typeof ip !== "string") return false;
    const family = net.isIP(ip);
    if (family === 4) return isPublicIPv4(ip);
    if (family !== 6) return false;

    const g = ipv6Groups(ip);
    if (!g) return false;
    // IPv4-mapped ::ffff:a.b.c.d (also the hex form ::ffff:7f00:1): IPv4 rules.
    if (
        g[0] === 0 &&
        g[1] === 0 &&
        g[2] === 0 &&
        g[3] === 0 &&
        g[4] === 0 &&
        g[5] === 0xffff
    ) {
        return isPublicIPv4(
            `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`,
        );
    }
    // ::/96 covers the unspecified address, ::1, and deprecated IPv4-compatible
    // forms. None of them is a public destination.
    if (
        g[0] === 0 &&
        g[1] === 0 &&
        g[2] === 0 &&
        g[3] === 0 &&
        g[4] === 0 &&
        g[5] === 0
    ) {
        return false;
    }
    if ((g[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
    if ((g[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
    if ((g[0] & 0xff00) === 0xff00) return false; // ff00::/8 multicast
    if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // 2001:db8::/32 docs
    return true;
}

// Parses and vets one URL before it is requested. Returns the URL or null.
async function checkTarget(href, deps) {
    let u;
    try {
        u = new URL(href);
    } catch {
        return null;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.username || u.password) return null;

    let host = u.hostname;
    if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
    if (net.isIP(host)) {
        return isPublicAddress(host) ? u : null;
    }
    const addrs = await deps.lookup(host, { all: true });
    if (!Array.isArray(addrs) || addrs.length === 0) return null;
    if (!addrs.every((a) => a && isPublicAddress(a.address))) return null;
    return u;
}

// Reads a body incrementally. Over the limit: truncate (keep the first `limit`
// bytes) or give up (null), cancelling the stream either way.
async function readBody(res, limit, truncate) {
    if (!res.body) return Buffer.alloc(0);
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        let chunk = Buffer.from(value);
        if (total + chunk.length > limit) {
            if (!truncate) {
                await reader.cancel().catch(() => {});
                return null;
            }
            chunk = chunk.subarray(0, limit - total);
            chunks.push(chunk);
            total = limit;
            await reader.cancel().catch(() => {});
            break;
        }
        chunks.push(chunk);
        total += chunk.length;
    }
    return Buffer.concat(chunks, total);
}

function decodeHtml(buf, charset) {
    try {
        return new TextDecoder(charset || "utf-8", { fatal: false }).decode(
            buf,
        );
    } catch {
        return new TextDecoder("utf-8", { fatal: false }).decode(buf);
    }
}

function discard(res) {
    if (res.body) res.body.cancel().catch(() => {});
}

async function fetchWithinSignal(url, mode, deps, signal) {
    let current = url;
    for (let hop = 0; ; hop++) {
        const target = await checkTarget(current, deps);
        if (!target) return null;

        const res = await deps.fetch(target.href, {
            method: "GET",
            redirect: "manual",
            credentials: "omit",
            signal,
            headers: {
                "User-Agent": USER_AGENT,
                Accept: mode === "page" ? PAGE_ACCEPT : IMAGE_ACCEPT,
            },
        });

        const status = res.status;
        const location = res.headers?.get?.("location");
        if (status >= 300 && status < 400) {
            discard(res);
            if (!location || hop >= MAX_REDIRECTS) return null;
            current = new URL(location, target).href;
            continue;
        }
        if (res.type === "opaqueredirect") {
            discard(res);
            return null;
        }
        if (status < 200 || status > 299) {
            discard(res);
            return null;
        }

        const contentTypeRaw = res.headers.get("content-type") || "";
        const contentType = contentTypeRaw.split(";")[0].trim().toLowerCase();
        const charset = /charset\s*=\s*"?([^";\s]+)/i.exec(contentTypeRaw)?.[1];

        if (
            contentType.startsWith("image/") &&
            contentType !== "image/svg+xml"
        ) {
            const bytes = await readBody(res, MAX_IMAGE_BYTES, false);
            if (!bytes || bytes.length === 0) return null;
            return {
                kind: "image",
                finalUrl: target.href,
                contentType,
                base64: bytes.toString("base64"),
            };
        }

        if (
            mode === "page" &&
            (contentType === "text/html" ||
                contentType === "application/xhtml+xml")
        ) {
            const bytes = await readBody(res, MAX_HTML_BYTES, true);
            if (!bytes) return null;
            return {
                kind: "html",
                finalUrl: target.href,
                html: decodeHtml(bytes, charset),
            };
        }

        discard(res);
        return null;
    }
}

/**
 * A fetch over Electron's `net.request` that returns each redirect instead of
 * following it, as a bodiless 3xx Response with its Location. `net.fetch`
 * cannot: with `redirect: "manual"` it throws "Redirect was cancelled"
 * (Electron 44), so no hop could be checked before it is requested. Session
 * cookies are not sent.
 * @param {typeof import("electron").net} electronNet
 */
function netRequestFetch(electronNet) {
    return (url, init = {}) =>
        new Promise((resolve, reject) => {
            const req = electronNet.request({
                url,
                method: "GET",
                redirect: "manual",
                credentials: "omit",
                useSessionCookies: false,
            });
            for (const [k, v] of Object.entries(init.headers || {}))
                req.setHeader(k, v);
            const signal = init.signal;
            const onAbort = () => {
                req.abort();
                reject(new Error("aborted"));
            };
            if (signal) {
                if (signal.aborted) return onAbort();
                signal.addEventListener("abort", onAbort, { once: true });
            }
            req.on("redirect", (status, _method, redirectUrl) => {
                req.abort();
                resolve(
                    new Response(null, {
                        status,
                        headers: { location: redirectUrl },
                    }),
                );
            });
            req.on("response", (res) => {
                const headers = new Headers();
                for (const [k, v] of Object.entries(res.headers || {}))
                    headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
                const body = new ReadableStream({
                    start(controller) {
                        res.on("data", (d) =>
                            controller.enqueue(new Uint8Array(d)),
                        );
                        res.on("end", () => controller.close());
                        res.on("error", (e) => controller.error(e));
                    },
                    cancel() {
                        req.abort();
                    },
                });
                try {
                    resolve(
                        new Response(body, {
                            status: res.statusCode,
                            headers,
                        }),
                    );
                } catch (e) {
                    req.abort();
                    reject(e);
                }
            });
            req.on("error", reject);
            req.end();
        });
}

// Returns { kind: "html", finalUrl, html } in page mode,
// { kind: "image", finalUrl, contentType, base64 } for images, or null.
async function fetchLinkPage(url, mode, deps) {
    if (mode !== "page" && mode !== "image") return null;
    const controller = new AbortController();
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
            controller.abort();
            resolve(null);
        }, deps.timeoutMs ?? TIMEOUT_MS);
    });
    try {
        const work = fetchWithinSignal(
            String(url),
            mode,
            deps,
            controller.signal,
        );
        return await Promise.race([work, timeout]).catch(() => null);
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    fetchLinkPage,
    netRequestFetch,
    isPublicAddress,
    USER_AGENT,
    MAX_HTML_BYTES,
    MAX_IMAGE_BYTES,
    MAX_REDIRECTS,
    TIMEOUT_MS,
};
