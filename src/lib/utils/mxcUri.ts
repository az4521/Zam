// Strict parser for `mxc://` content URIs (Matrix spec §Content URIs, v1.12).
//
// A crafted server name or media id must never be able to smuggle path
// traversal (`..`), extra path segments, or a query/fragment into the media
// URLs we build from it. We therefore validate against the spec grammar:
//   - server name: a hostname (letters/digits/dots/hyphens) with an optional
//     `:port`, or a bracketed IPv6 literal with an optional `:port`
//   - media id: one or more of `[A-Za-z0-9_-]` (the spec's opaque-id charset)
// and reject anything else (including empty ids and `mxc://hs/a/b`).
const MXC_RE =
    /^mxc:\/\/([A-Za-z0-9.\-]+(?::\d{1,5})?|\[[0-9A-Fa-f:.]+\](?::\d{1,5})?)\/([A-Za-z0-9_-]+)$/;

export function parseMxc(
    uri: string,
): { serverName: string; mediaId: string } | null {
    const m = MXC_RE.exec(uri);
    return m ? { serverName: m[1], mediaId: m[2] } : null;
}

// True only when `url` has the SAME origin (scheme + host + port) as `baseUrl`.
// Used to gate whether the access token may be attached to a request: a raw
// `url.startsWith(baseUrl)` is NOT a host check and is bypassable —
// `https://host@evil.com/x` (userinfo) and `https://host.evil.com/x`
// (host-suffix) both pass a prefix test while resolving to a foreign host,
// which would leak the token. Parsing to `origin` is host-safe. A malformed
// URL throws → we return false (fail-closed). Origin ignores the path, so a
// homeserver mounted under a base path (`https://host/base/_matrix/…`) still
// matches a `https://host/base` baseUrl.
export function isSameOrigin(url: string, baseUrl: string): boolean {
    try {
        return new URL(url).origin === new URL(baseUrl).origin;
    } catch {
        return false;
    }
}
