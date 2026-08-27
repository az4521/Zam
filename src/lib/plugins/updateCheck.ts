/**
 * Pure update-availability logic for repo plugins: compare an installed version
 * against the latest version seen in a repo index, and resolve which updatable
 * plugins should auto-update given the global default + per-plugin overrides.
 * compareVersions throws on invalid semver, so every call is guarded — a
 * malformed index version must never break the badge or an auto-update pass.
 */
import { compareVersions } from "./semver";

export interface InstalledForUpdate {
    id: string;
    version: string;
    source: "builtin" | "repo";
}

export interface UpdateInfo {
    id: string;
    installedVersion: string;
    latestVersion: string;
    hasUpdate: boolean;
}

function safeNewer(latest: string, installed: string): boolean {
    try {
        return compareVersions(latest, installed) === 1;
    } catch {
        return false;
    }
}

export function computeUpdateStatus(
    installed: InstalledForUpdate[],
    latestVersions: Record<string, string>,
): UpdateInfo[] {
    const out: UpdateInfo[] = [];
    for (const p of installed) {
        if (p.source !== "repo") continue;
        const latest = latestVersions[p.id];
        if (typeof latest !== "string") continue;
        out.push({
            id: p.id,
            installedVersion: p.version,
            latestVersion: latest,
            hasUpdate: safeNewer(latest, p.version),
        });
    }
    return out;
}

export function pluginsToAutoUpdate(
    status: UpdateInfo[],
    globalAuto: boolean,
    overrides: Record<string, boolean>,
): string[] {
    return status
        .filter((s) => s.hasUpdate)
        .filter((s) => overrides[s.id] ?? globalAuto)
        .map((s) => s.id);
}
