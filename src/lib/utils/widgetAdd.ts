// Pure parsing for adding a room widget by hand (the Add widget dialog and the
// /addwidget slash command). No SDK or Svelte imports, so it is unit-tested in
// isolation.

/**
 * Normalise a user-typed widget address. Only http and https are accepted:
 * anything else (javascript:, data:, file:, a bare host) yields null.
 * Returns the URL's canonical href.
 */
export function parseWidgetAddress(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.host) return null;
    return url.href;
}

/**
 * Split a `/addwidget <url> [name]` argument: the first whitespace-delimited
 * token is the address, the rest (trimmed) is the optional display name.
 * Returns null when the address is missing or not an http(s) URL.
 */
export function parseAddWidgetArg(
    arg: string,
): { url: string; name: string } | null {
    const m = arg.trim().match(/^(\S+)\s*([\s\S]*)$/);
    if (!m) return null;
    const url = parseWidgetAddress(m[1]);
    if (!url) return null;
    return { url, name: m[2].trim() };
}
