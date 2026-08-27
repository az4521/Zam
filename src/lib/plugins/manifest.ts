/**
 * Pure logic for parsing and validating plugin manifests. Validates that a
 * third-party plugin's manifest.json is well-formed (required fields present,
 * valid semver version, valid id pattern) and returns a typed Manifest object.
 * Imports only from within src/lib/plugins — no SDK, DOM, or localStorage.
 */

import { isValidSemver } from "./semver";
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
] as const;

export type Capability = (typeof KNOWN_CAPABILITIES)[number];

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

    return result;
}
