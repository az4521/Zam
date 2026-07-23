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
