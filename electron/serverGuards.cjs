const path = require("path");

/**
 * Safely resolve a URL path to an absolute file path within buildDir.
 * Returns null if the URL is malformed or resolves outside buildDir.
 * @param {string} buildDir - Absolute path to the build directory
 * @param {string} rawUrl - Raw URL from the request (may include query/fragment)
 * @returns {string|null} Absolute file path, or null if invalid/outside buildDir
 */
function resolveStaticPath(buildDir, rawUrl) {
    // Strip query string and fragment
    const urlWithoutQuery = rawUrl.split("?")[0].split("#")[0];

    // Decode URI component (return null on malformed encoding)
    let decoded;
    try {
        decoded = decodeURIComponent(urlWithoutQuery);
    } catch {
        return null;
    }

    // Normalize and join with buildDir
    let filePath = path.normalize(path.join(buildDir, decoded));

    // Remove trailing separator if present and not a drive root (e.g., "C:\")
    const parsed = path.parse(filePath);
    if (filePath.endsWith(path.sep) && parsed.root !== filePath) {
        filePath = filePath.slice(0, -1);
    }

    // Check containment using path.relative
    const rel = path.relative(buildDir, filePath);

    // Reject if relative path starts with .. (outside buildDir) or is absolute
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return null;
    }

    // Empty string means filePath === buildDir (root), which is allowed
    return filePath;
}

/**
 * Check if a URL is safe to open externally (not a local/private network).
 * Only allows http/https to public hosts.
 * @param {string} rawUrl - URL to check
 * @returns {boolean} True if safe to open
 */
function isSafeExternalUrl(rawUrl) {
    let u;
    try {
        u = new URL(rawUrl);
    } catch {
        return false;
    }

    // Only allow http and https
    if (u.protocol !== "http:" && u.protocol !== "https:") {
        return false;
    }

    const host = u.hostname.toLowerCase();

    // Check for empty host
    if (!host) {
        return false;
    }

    // Block localhost and *.localhost
    if (host === "localhost" || host.endsWith(".localhost")) {
        return false;
    }

    // Try to parse as IPv4
    const ipv4Match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
        const octets = ipv4Match.slice(1, 5).map((s) => parseInt(s, 10));
        if (octets.some((o) => o > 255)) {
            return false; // Invalid IPv4
        }
        return !isBlockedIPv4(octets);
    }

    // Try to parse as IPv6 (host is already normalized by URL parser)
    if (host.startsWith("[") && host.endsWith("]")) {
        const ipv6 = host.slice(1, -1);
        return !isBlockedIPv6(ipv6);
    }
    // Unbracketed IPv6 (rare but ::1 can appear this way)
    if (host.includes(":")) {
        return !isBlockedIPv6(host);
    }

    // Hostname (not an IP) - allowed
    return true;
}

/**
 * Check if an IPv4 address (as 4 octets) is in a blocked range.
 * @param {number[]} octets - IPv4 address as [a, b, c, d]
 * @returns {boolean} True if blocked
 */
function isBlockedIPv4(octets) {
    const [a, b, c, d] = octets;

    // 0.0.0.0/8
    if (a === 0) return true;

    // 10.0.0.0/8
    if (a === 10) return true;

    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;

    // 100.64.0.0/10 (CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
}

/**
 * Check if an IPv6 address is in a blocked range.
 * @param {string} ipv6 - IPv6 address (normalized by URL parser)
 * @returns {boolean} True if blocked
 */
function isBlockedIPv6(ipv6) {
    const lower = ipv6.toLowerCase();

    // ::1 (loopback)
    if (lower === "::1") return true;

    // :: (unspecified)
    if (lower === "::") return true;

    // fe80::/10 (link-local)
    if (
        lower.startsWith("fe8") ||
        lower.startsWith("fe9") ||
        lower.startsWith("fea") ||
        lower.startsWith("feb")
    ) {
        return true;
    }

    // fc00::/7 (ULA - unique local addresses)
    if (lower.startsWith("fc") || lower.startsWith("fd")) {
        return true;
    }

    // IPv4-mapped IPv6: ::ffff:a.b.c.d or ::ffff:xxyy:zzww
    if (lower.startsWith("::ffff:")) {
        const mapped = lower.slice(7);

        // Check if it's in dotted-decimal form (::ffff:127.0.0.1)
        const ipv4Match = mapped.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
        if (ipv4Match) {
            const octets = ipv4Match.slice(1, 5).map((s) => parseInt(s, 10));
            return isBlockedIPv4(octets);
        }

        // Check hex form (::ffff:7f00:1 -> 127.0.0.1)
        // Format is ::ffff:xxyy:zzww where xxyy and zzww are hex
        const hexMatch = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (hexMatch) {
            const high = parseInt(hexMatch[1], 16);
            const low = parseInt(hexMatch[2], 16);
            // Convert to IPv4 octets: high is first two octets, low is last two
            const octets = [
                (high >> 8) & 0xff,
                high & 0xff,
                (low >> 8) & 0xff,
                low & 0xff,
            ];
            return isBlockedIPv4(octets);
        }

        // Compact hex form ::ffff:xxyyzz (single segment)
        const compactMatch = mapped.match(/^([0-9a-f]{1,8})$/);
        if (compactMatch) {
            const val = parseInt(compactMatch[1], 16);
            const octets = [
                (val >> 24) & 0xff,
                (val >> 16) & 0xff,
                (val >> 8) & 0xff,
                val & 0xff,
            ];
            return isBlockedIPv4(octets);
        }
    }

    return false;
}

module.exports = {
    resolveStaticPath,
    isSafeExternalUrl,
};
