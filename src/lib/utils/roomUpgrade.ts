/**
 * Pure helpers for upgrading a room to a newer room version: numeric-leading
 * version comparison and the "may I upgrade? / to what?" state gate. SDK-free
 * so they can be unit-tested. Mirrors roomEncryption.ts's getEnableEncryptionState.
 */

/**
 * Compare two room-version ids by their leading integer. Returns a negative
 * number when `a` is older, 0 when equal (or incomparable-but-equal-string),
 * positive when `a` is newer, and `null` when the two are non-numeric and
 * unequal (ordering undefined across stable/unstable ids). Parses `/^(\d+)/`.
 */
export function compareRoomVersions(a: string, b: string): number | null {
    if (a === b) return 0;
    const ma = /^(\d+)/.exec(a.trim());
    const mb = /^(\d+)/.exec(b.trim());
    if (!ma || !mb) return null;
    return parseInt(ma[1], 10) - parseInt(mb[1], 10);
}

/**
 * Whether `current` is the recommended version or newer (→ no upgrade offered).
 * Equal strings → true; both numeric → `compareRoomVersions >= 0`; incomparable
 * and unequal → false (offer the upgrade rather than hide the feature).
 */
export function isRoomVersionAtLeast(
    current: string,
    recommended: string,
): boolean {
    if (current === recommended) return true;
    const cmp = compareRoomVersions(current, recommended);
    if (cmp === null) return false;
    return cmp >= 0;
}

export interface RoomUpgradeStateInput {
    /** room.getVersion(). */
    currentVersion: string;
    /** capabilities["m.room_versions"].default; "" when the server didn't advertise. */
    defaultVersion: string;
    /** Object.keys(capabilities["m.room_versions"].available); v1: informational only. */
    availableVersions: string[];
    /** getMyPowerLevel(room) — creator-aware effective level. */
    myPowerLevel: number;
    /** pl.events["m.room.tombstone"] ?? pl.state_default. */
    tombstonePowerLevel: number;
}

export interface RoomUpgradeState {
    /** True only when an upgrade can be initiated right now. */
    available: boolean;
    /** Empty when available; else the one-line disabled/idle reason. */
    reason: string;
    /** The target version the UI upgrades to (= recommended; falls back to current). */
    recommendedVersion: string;
    /** True when the room is already on (or newer than) the recommended version. */
    isCurrentLatest: boolean;
}

/**
 * Pure gate for whether/why a room upgrade is offered and to what version.
 * - recommendedVersion = defaultVersion when non-empty, else currentVersion.
 * - isCurrentLatest = isRoomVersionAtLeast(currentVersion, recommendedVersion).
 * - available = !isCurrentLatest && myPowerLevel >= tombstonePowerLevel.
 * Reason precedence: isCurrentLatest → "This room is on the latest version (vX).";
 *   else insufficient power → "You don't have permission to upgrade this room.";
 *   else "" (available).
 */
export function getRoomUpgradeState(
    input: RoomUpgradeStateInput,
): RoomUpgradeState {
    const recommendedVersion =
        input.defaultVersion !== ""
            ? input.defaultVersion
            : input.currentVersion;
    const isCurrentLatest = isRoomVersionAtLeast(
        input.currentVersion,
        recommendedVersion,
    );
    if (isCurrentLatest) {
        return {
            available: false,
            reason: `This room is on the latest version (v${recommendedVersion}).`,
            recommendedVersion,
            isCurrentLatest: true,
        };
    }
    if (input.myPowerLevel < input.tombstonePowerLevel) {
        return {
            available: false,
            reason: "You don't have permission to upgrade this room.",
            recommendedVersion,
            isCurrentLatest: false,
        };
    }
    return {
        available: true,
        reason: "",
        recommendedVersion,
        isCurrentLatest: false,
    };
}
