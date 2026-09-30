/**
 * Pure state helpers for the self-participant call menu's audio-device
 * accordion. The menu collapses its flat mic/speaker lists into two expandable
 * "Input" / "Output" rows; this module owns the open/close truth and the
 * collapsed-row label. Browser device enumeration lives in $lib/audio/devices;
 * device-option shaping in $lib/utils/audioDevices.
 */

import { t } from "$lib/i18n";
import type { DeviceOption } from "./audioDevices";

export type SubmenuSection = "input" | "output";

/**
 * Accordion toggle: re-selecting the open section collapses it; selecting the
 * other section switches (collapsing the first). Only one section is ever open.
 */
export function toggleSubmenu(
    current: SubmenuSection | null,
    section: SubmenuSection,
): SubmenuSection | null {
    return current === section ? null : section;
}

/**
 * Label for the collapsed Input/Output row: the active device's label, or
 * "Default" when nothing explicit is selected OR the saved id is no longer
 * present (a vanished device resolves to the default, mirroring resolveDeviceId).
 */
export function activeDeviceLabel(
    devices: DeviceOption[],
    selectedId: string | null,
): string {
    if (!selectedId) return t("common.default");
    return (
        devices.find((d) => d.id === selectedId)?.label ?? t("common.default")
    );
}
