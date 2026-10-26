/**
 * Pure logic for parsing and validating plugin manifests. Validates that a
 * third-party plugin's manifest.json is well-formed (required fields present,
 * valid semver version, valid id pattern) and returns a typed Manifest object.
 * Imports only from within src/lib/plugins — no SDK, DOM, or localStorage.
 */

import { isValidSemver } from "./semver";
import { isSafeRelPath } from "./repo";
import type { SettingsSchema } from "./settingsSchema";

export const KNOWN_CAPABILITIES = [
    "commands",
    "composer",
    "ui",
    "messages:read",
    "messages:send",
    "rooms:read",
    "storage",
    "network",
    "unsafe",
    /** zam.audio: noise filters for the user's own microphone. */
    "audio",
    /** zam.native: run the plugin's own native code (desktop only, after the
     *  user agrees in a system dialog). Full access to the computer. */
    "native",
    /** zam.frames: run scripts in the pages embedded in Zam, e.g. a YouTube
     *  player (desktop only). */
    "frames",
] as const;

export type Capability = (typeof KNOWN_CAPABILITIES)[number];

/** A file the plugin ships beside its bundle, fetched from the same pinned
 *  commit and checked against its SHA-256 before use. */
export interface ManifestFile {
    /** Relative to the plugin's directory. */
    path: string;
    /** Lowercase hex SHA-256 of the file. */
    sha256: string;
    /** Bytes. */
    size: number;
}

/** One platform's native code (zam.native). */
export interface ManifestNativePlatform {
    /** Desktop ("win32-x64", ...): a CommonJS script Electron starts in a
     *  utility process. Android ("android-arm64", ...): a .dex or .jar Zam
     *  loads in its own process. Must be one of `files`. */
    host: string;
    /** Android only: the host's class (implements
     *  moe.crafty.matrix.PluginNativeHost). */
    entry?: string;
    /** Every file the host needs, laid out as in the plugin directory. On
     *  Android, `.so` files go under a `lib/` directory next to the host. */
    files: ManifestFile[];
}

/** Native code, per platform: desktop keys are
 *  `${process.platform}-${process.arch}` (e.g. "win32-x64"), Android keys
 *  "android-" + arm64 / arm / x64 / ia32. */
export interface ManifestNative {
    platforms: Record<string, ManifestNativePlatform>;
}

export interface Manifest {
    id: string;
    name: string;
    version: string;
    description: string;
    author: string;
    entry: string;
    minAppVersion?: string;
    capabilities?: string[];
    settings?: SettingsSchema;
    assets?: ManifestFile[];
    native?: ManifestNative;
}

/** Largest single file a plugin may ship (GitHub's own limit is 100 MB). */
export const MAX_PLUGIN_FILE_BYTES = 100 * 1024 * 1024;
const PLATFORM_KEY = /^(win32|linux|darwin|android)-(x64|arm64|ia32|arm)$/;
const JAVA_CLASS = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/;

function parseFiles(raw: unknown, field: string): ManifestFile[] {
    if (!Array.isArray(raw))
        throw new Error(`Manifest field "${field}" must be an array`);
    const seen = new Set<string>();
    return raw.map((f, i) => {
        const where = `${field}[${i}]`;
        if (typeof f !== "object" || f === null || Array.isArray(f))
            throw new Error(`Manifest field "${where}" must be an object`);
        const o = f as Record<string, unknown>;
        if (typeof o.path !== "string" || !isSafeRelPath(o.path))
            throw new Error(
                `Manifest field "${where}.path" must be a safe relative path`,
            );
        if (seen.has(o.path))
            throw new Error(
                `Manifest field "${field}" lists "${o.path}" twice`,
            );
        seen.add(o.path);
        if (typeof o.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(o.sha256))
            throw new Error(
                `Manifest field "${where}.sha256" must be 64 lowercase hex digits`,
            );
        if (
            typeof o.size !== "number" ||
            !Number.isInteger(o.size) ||
            o.size < 0 ||
            o.size > MAX_PLUGIN_FILE_BYTES
        )
            throw new Error(
                `Manifest field "${where}.size" must be a byte count up to ${MAX_PLUGIN_FILE_BYTES}`,
            );
        return { path: o.path, sha256: o.sha256, size: o.size };
    });
}

/** Validate `native` (from untrusted input). */
export function parseNative(raw: unknown): ManifestNative {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
        throw new Error(`Manifest field "native" must be an object`);
    const o = raw as Record<string, unknown>;
    if (
        typeof o.platforms !== "object" ||
        o.platforms === null ||
        Array.isArray(o.platforms)
    )
        throw new Error(`Manifest field "native.platforms" must be an object`);
    const platforms: Record<string, ManifestNativePlatform> = {};
    for (const [key, value] of Object.entries(o.platforms)) {
        const where = `native.platforms.${key}`;
        if (!PLATFORM_KEY.test(key))
            throw new Error(
                `Manifest field "native.platforms" has an unknown platform "${key}"`,
            );
        if (typeof value !== "object" || value === null || Array.isArray(value))
            throw new Error(`Manifest field "${where}" must be an object`);
        const v = value as Record<string, unknown>;
        if (typeof v.host !== "string" || !isSafeRelPath(v.host))
            throw new Error(
                `Manifest field "${where}.host" must be a safe relative path`,
            );
        const android = key.startsWith("android-");
        if (android ? !/\.(dex|jar)$/.test(v.host) : !/\.c?js$/.test(v.host))
            throw new Error(
                `Manifest field "${where}.host" must be a ${android ? ".dex or .jar" : ".cjs or .js"} file`,
            );
        if (
            android &&
            (typeof v.entry !== "string" || !JAVA_CLASS.test(v.entry))
        )
            throw new Error(
                `Manifest field "${where}.entry" must name the host's Java class`,
            );
        const files = parseFiles(v.files, `${where}.files`);
        if (!files.some((f) => f.path === v.host))
            throw new Error(
                `Manifest field "${where}.files" must include the host "${v.host}"`,
            );
        platforms[key] = {
            host: v.host,
            ...(android ? { entry: v.entry as string } : {}),
            files,
        };
    }
    return { platforms };
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Parse and validate a plugin manifest from untrusted input. Throws Error
 * naming the offending field if validation fails. Returns a fresh Manifest
 * object with only known fields.
 */
export function parseManifest(input: unknown): Manifest {
    // Input must be a non-null plain object
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
        throw new Error("Manifest must be a non-null object");
    }

    const raw = input as Record<string, unknown>;

    // Helper to validate required non-empty string fields
    const requireString = (field: string): string => {
        const value = raw[field];
        if (typeof value !== "string" || value.trim() === "") {
            throw new Error(
                `Manifest field "${field}" is required and must be a non-empty string`,
            );
        }
        return value.trim();
    };

    // Validate required fields
    const id = requireString("id");
    const name = requireString("name");
    const version = requireString("version");
    const description = requireString("description");
    const author = requireString("author");
    const entry = requireString("entry");

    // Validate id pattern (reverse-DNS-friendly, no spaces/slashes)
    if (!ID_PATTERN.test(id)) {
        throw new Error(
            `Manifest field "id" must match pattern ^[A-Za-z0-9][A-Za-z0-9._-]*$ (got: "${id}")`,
        );
    }

    // Validate version is valid semver
    if (!isValidSemver(version)) {
        throw new Error(
            `Manifest field "version" must be a valid semver string (got: "${version}")`,
        );
    }

    // Validate entry is a safe relative path
    if (!isSafeRelPath(entry)) {
        throw new Error(
            `Manifest field "entry" must be a safe relative path (got: "${entry}")`,
        );
    }

    // Build result with required fields
    const result: Manifest = {
        id,
        name,
        version,
        description,
        author,
        entry,
    };

    // Optional minAppVersion: if present, must be valid semver
    if ("minAppVersion" in raw) {
        const minAppVersion = raw.minAppVersion;
        if (typeof minAppVersion === "string") {
            if (!isValidSemver(minAppVersion)) {
                throw new Error(
                    `Manifest field "minAppVersion" must be a valid semver string (got: "${minAppVersion}")`,
                );
            }
            result.minAppVersion = minAppVersion;
        } else if (minAppVersion !== undefined) {
            throw new Error(
                `Manifest field "minAppVersion" must be a string if present`,
            );
        }
    }

    // Optional capabilities: if present, must be an array of strings
    // Unknown capability strings are kept for forward compatibility
    if ("capabilities" in raw) {
        const capabilities = raw.capabilities;
        if (!Array.isArray(capabilities)) {
            throw new Error(
                `Manifest field "capabilities" must be an array if present`,
            );
        }
        for (const cap of capabilities) {
            if (typeof cap !== "string") {
                throw new Error(
                    `Manifest field "capabilities" must contain only strings`,
                );
            }
        }
        result.capabilities = capabilities;
    }

    // Optional settings: if present, must be an array (shallow check only)
    if ("settings" in raw) {
        const settings = raw.settings;
        if (!Array.isArray(settings)) {
            throw new Error(
                `Manifest field "settings" must be an array if present`,
            );
        }
        // Carry through typed as SettingsSchema (deep validation happens later)
        result.settings = settings as SettingsSchema;
    }

    if ("assets" in raw && raw.assets !== undefined)
        result.assets = parseFiles(raw.assets, "assets");
    if ("native" in raw && raw.native !== undefined)
        result.native = parseNative(raw.native);

    return result;
}
