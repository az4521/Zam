/**
 * The endpoints a plugin may reach over raw sockets (zam.network), from its
 * manifest's `sockets`: "tcp:127.0.0.1:7656", "udp:*:*", "tcp:[::1]:443".
 * `*` matches any host or any port. Pure: manifest.ts parses with it,
 * hostApi.ts checks every connect and send against it. Plugins are
 * full-trust page code, so this is disclosure, not a sandbox.
 */

export type SocketProtocol = "tcp" | "udp";

export interface SocketRule {
    protocol: SocketProtocol;
    /** Lowercase, without brackets; "*" for any. */
    host: string;
    /** "*" for any. */
    port: number | "*";
}

const RULE = /^(tcp|udp):(\*|\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+):(\*|\d{1,5})$/;

/** A rule string, or null when malformed. */
export function parseSocketRule(raw: string): SocketRule | null {
    const m = RULE.exec(raw);
    if (!m) return null;
    const host = m[2].replace(/^\[|\]$/g, "").toLowerCase();
    let port: number | "*" = "*";
    if (m[3] !== "*") {
        port = Number(m[3]);
        if (port < 1 || port > 65535) return null;
    }
    return { protocol: m[1] as SocketProtocol, host, port };
}

/** A host as the rules compare it: lowercase, brackets dropped. */
export function normalizeSocketHost(host: string): string {
    return host
        .trim()
        .replace(/^\[|\]$/g, "")
        .toLowerCase();
}

export function socketAllowed(
    rules: readonly SocketRule[],
    protocol: SocketProtocol,
    host: string,
    port: number,
): boolean {
    const h = normalizeSocketHost(host);
    return rules.some(
        (r) =>
            r.protocol === protocol &&
            (r.host === "*" || r.host === h) &&
            (r.port === "*" || r.port === port),
    );
}

export function isValidPort(port: unknown, allowZero = false): boolean {
    return (
        typeof port === "number" &&
        Number.isInteger(port) &&
        port >= (allowZero ? 0 : 1) &&
        port <= 65535
    );
}
