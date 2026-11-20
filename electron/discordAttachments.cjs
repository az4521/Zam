// Discord-uploaded GIFs: refresh their expiring CDN links through the user's
// proxy service, then download the bytes in the main process so CORS does not
// apply and the user's network proxy does. Both calls take an injected fetch
// (net.fetch in main.cjs) so they can be tested without the network.
//
// Attachment URLs carry signatures (ex, is, hm), so they are never logged.

const ATTACHMENT_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];
const ATTACHMENT_PATHS = ["/attachments/", "/ephemeral-attachments/"];
const MAX_URL_LENGTH = 2048;
const REFRESH_CHUNK = 50;
const REFRESH_TIMEOUT_MS = 20 * 1000;
const DOWNLOAD_TIMEOUT_MS = 60 * 1000;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function isDiscordAttachmentUrl(url) {
    if (typeof url !== "string" || url.length > MAX_URL_LENGTH) return false;
    let u;
    try {
        u = new URL(url);
    } catch {
        return false;
    }
    if (u.protocol !== "https:") return false;
    if (!ATTACHMENT_HOSTS.includes(u.hostname)) return false;
    return ATTACHMENT_PATHS.some((p) => u.pathname.startsWith(p));
}

// Plain http is only allowed for a proxy on this machine, so a remote proxy
// never sees the bot token in clear text.
function normaliseProxyBase(raw) {
    if (typeof raw !== "string") return null;
    let u;
    try {
        u = new URL(raw.trim());
    } catch {
        return null;
    }
    if (u.username || u.password) return null;
    if (u.protocol === "http:") {
        if (!LOCAL_HOSTS.includes(u.hostname)) return null;
    } else if (u.protocol !== "https:") {
        return null;
    }
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host}${path}`;
}

// POSTs one chunk to <base>/refresh. Returns { ok, refreshed } or an error.
async function postRefreshChunk(base, chunk, fetchImpl) {
    const wanted = new Set(chunk);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
    try {
        let res;
        try {
            res = await fetchImpl(`${base}/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ urls: chunk }),
                signal: controller.signal,
            });
        } catch {
            return { ok: false, error: "unreachable" };
        }
        if (res.status === 429) {
            return { ok: false, error: "rate-limited", status: 429 };
        }
        if (!res.ok) {
            return { ok: false, error: "http-error", status: res.status };
        }
        let body;
        try {
            body = await res.json();
        } catch {
            // A body read cut short by the timeout is a network failure.
            if (controller.signal.aborted)
                return { ok: false, error: "unreachable" };
            return { ok: false, error: "bad-response" };
        }
        if (!body || typeof body !== "object" || !Array.isArray(body.urls)) {
            return { ok: false, error: "bad-response" };
        }
        // Matched on the attachment path, not the exact string: Discord may
        // echo `original` on the other CDN host or with its query. A refreshed
        // link must name the same file as the one asked for.
        const byPath = new Map();
        for (const u of wanted) byPath.set(new URL(u).pathname, u);
        const refreshed = {};
        for (const entry of body.urls) {
            if (!entry || typeof entry !== "object") continue;
            if (
                !isDiscordAttachmentUrl(entry.original) ||
                !isDiscordAttachmentUrl(entry.refreshed)
            )
                continue;
            const path = new URL(entry.original).pathname;
            const asked = byPath.get(path);
            if (!asked || new URL(entry.refreshed).pathname !== path) continue;
            refreshed[asked] = entry.refreshed;
        }
        return { ok: true, refreshed };
    } finally {
        clearTimeout(timer);
    }
}

async function refreshAttachmentUrls(proxyBase, urls, fetchImpl) {
    const base = normaliseProxyBase(proxyBase);
    if (!base) return { ok: false, error: "bad-proxy-url" };
    const unique = [
        ...new Set(
            (Array.isArray(urls) ? urls : []).filter(isDiscordAttachmentUrl),
        ),
    ];
    const refreshed = {};
    for (let i = 0; i < unique.length; i += REFRESH_CHUNK) {
        const chunk = unique.slice(i, i + REFRESH_CHUNK);
        const res = await postRefreshChunk(base, chunk, fetchImpl);
        if (!res.ok) return res;
        Object.assign(refreshed, res.refreshed);
    }
    return { ok: true, refreshed };
}

// Last path segment, decoded and cleaned so it is safe as a file name.
function fileNameFrom(url) {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop() || "";
    let name = last;
    try {
        name = decodeURIComponent(last);
    } catch {
        name = last;
    }
    name = name.replace(/[\\/\x00-\x1f\x7f]/g, "").trim();
    name = Array.from(name).slice(0, 200).join("");
    return name || "discord-gif";
}

function concatChunks(chunks, total) {
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
        out.set(c, off);
        off += c.byteLength;
    }
    return out;
}

async function downloadAttachment(
    url,
    fetchImpl,
    { maxBytes = DEFAULT_MAX_BYTES } = {},
) {
    if (!isDiscordAttachmentUrl(url)) return { ok: false, error: "bad-url" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
        let res;
        try {
            res = await fetchImpl(url, { signal: controller.signal });
        } catch {
            return { ok: false, error: "unreachable" };
        }
        if (!res.ok) {
            return { ok: false, error: "http-error", status: res.status };
        }
        const declared = Number(res.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > maxBytes) {
            controller.abort();
            return { ok: false, error: "too-large" };
        }
        const contentType = (res.headers.get("content-type") || "")
            .split(";")[0]
            .trim()
            .toLowerCase();
        const name = fileNameFrom(url);
        let data;
        try {
            if (res.body && typeof res.body.getReader === "function") {
                const reader = res.body.getReader();
                const chunks = [];
                let total = 0;
                for (;;) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    total += value.byteLength;
                    if (total > maxBytes) {
                        controller.abort();
                        return { ok: false, error: "too-large" };
                    }
                    chunks.push(value);
                }
                data = concatChunks(chunks, total);
            } else {
                const buf = await res.arrayBuffer();
                if (buf.byteLength > maxBytes) {
                    return { ok: false, error: "too-large" };
                }
                data = new Uint8Array(buf);
            }
        } catch {
            return { ok: false, error: "unreachable" };
        }
        return { ok: true, data, contentType, name };
    } finally {
        clearTimeout(timer);
    }
}

module.exports = {
    isDiscordAttachmentUrl,
    normaliseProxyBase,
    refreshAttachmentUrls,
    downloadAttachment,
};
