/**
 * Pure semver parsing, comparison, and min-version gating for the plugin
 * system. Handles plugin manifest versions, update detection, and minAppVersion
 * checks. No imports — kept pure so it stays unit-testable and side-effect-free.
 */

export interface ParsedSemver {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
}

/**
 * Parse a semver string into its components. Accepts MAJOR.MINOR.PATCH with
 * optional leading "v", optional prerelease (-foo.bar), and optional build
 * metadata (+build, ignored). Returns null if the input is invalid.
 */
export function parseSemver(v: string): ParsedSemver | null {
    if (typeof v !== "string") return null;

    // Strip leading "v"
    let clean = v.trim();
    if (clean.startsWith("v")) {
        clean = clean.slice(1);
    }

    // Strip build metadata (+anything)
    const plusIdx = clean.indexOf("+");
    if (plusIdx !== -1) {
        clean = clean.slice(0, plusIdx);
    }

    // Split off prerelease (-anything)
    let prerelease: string[] = [];
    const dashIdx = clean.indexOf("-");
    if (dashIdx !== -1) {
        const prereleaseStr = clean.slice(dashIdx + 1);
        if (prereleaseStr) {
            prerelease = prereleaseStr.split(".");
        }
        clean = clean.slice(0, dashIdx);
    }

    // Parse MAJOR.MINOR.PATCH
    const parts = clean.split(".");
    if (parts.length !== 3) return null;

    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);
    const patch = parseInt(parts[2], 10);

    // Validate all parts are valid numbers
    if (
        !Number.isFinite(major) ||
        !Number.isFinite(minor) ||
        !Number.isFinite(patch)
    ) {
        return null;
    }

    // Ensure parts match what we parsed (reject non-numeric strings)
    if (
        parts[0] !== String(major) ||
        parts[1] !== String(minor) ||
        parts[2] !== String(patch)
    ) {
        return null;
    }

    return { major, minor, patch, prerelease };
}

/**
 * Check if a value is a valid semver string. Type-guards unknown input.
 */
export function isValidSemver(v: unknown): boolean {
    return typeof v === "string" && parseSemver(v) !== null;
}

/**
 * Compare two semver strings. Returns -1 if a < b, 0 if equal, 1 if a > b.
 * Throws Error if either version is invalid.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
    const aP = parseSemver(a);
    const bP = parseSemver(b);

    if (!aP) throw new Error(`Invalid semver: ${a}`);
    if (!bP) throw new Error(`Invalid semver: ${b}`);

    // Compare major, minor, patch
    if (aP.major !== bP.major) return aP.major < bP.major ? -1 : 1;
    if (aP.minor !== bP.minor) return aP.minor < bP.minor ? -1 : 1;
    if (aP.patch !== bP.patch) return aP.patch < bP.patch ? -1 : 1;

    // Core versions equal — check prerelease
    const aHasPre = aP.prerelease.length > 0;
    const bHasPre = bP.prerelease.length > 0;

    // Version with prerelease is LESS than version without
    if (aHasPre && !bHasPre) return -1;
    if (!aHasPre && bHasPre) return 1;

    // Both have prerelease or both don't
    if (!aHasPre && !bHasPre) return 0;

    // Compare prerelease identifiers
    return comparePrereleaseIdentifiers(aP.prerelease, bP.prerelease);
}

/**
 * Compare prerelease identifier arrays per semver §11.4.
 * Numeric identifiers compared numerically and rank below non-numeric.
 * Longer array wins if all prior identifiers are equal.
 */
function comparePrereleaseIdentifiers(a: string[], b: string[]): -1 | 0 | 1 {
    const len = Math.min(a.length, b.length);

    for (let i = 0; i < len; i++) {
        const aId = a[i];
        const bId = b[i];

        if (aId === bId) continue;

        const aNum = parseInt(aId, 10);
        const bNum = parseInt(bId, 10);

        const aIsNum = String(aNum) === aId && Number.isFinite(aNum);
        const bIsNum = String(bNum) === bId && Number.isFinite(bNum);

        // Both numeric: compare numerically
        if (aIsNum && bIsNum) {
            return aNum < bNum ? -1 : 1;
        }

        // Numeric < non-numeric
        if (aIsNum && !bIsNum) return -1;
        if (!aIsNum && bIsNum) return 1;

        // Both non-numeric: lexical
        return aId < bId ? -1 : 1;
    }

    // All compared identifiers equal; longer wins
    if (a.length !== b.length) {
        return a.length < b.length ? -1 : 1;
    }

    return 0;
}

/**
 * Check if the app version satisfies a minimum version requirement.
 * Returns true if min is null/undefined/empty, or if appVersion >= min.
 * Throws if appVersion is invalid or if min is present but invalid.
 */
export function satisfiesMinAppVersion(
    appVersion: string,
    min?: string | null,
): boolean {
    // No minimum requirement
    if (!min || min === "") return true;

    return compareVersions(appVersion, min) >= 0;
}
