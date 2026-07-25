// Renderer-side bridge to the packaged desktop auto-updater. The real logic
// lives in the Electron main process and is surfaced on `window.desktop.updates`
// (see electron/preload.cjs). This module is a thin pass-through that guards on
// the bridge's presence, so importing/calling it is safe on web and Android
// (where `window.desktop` is undefined) — every function no-ops there.

import type { UpdateStatusInput } from "$lib/utils/updateStatus";

function bridge() {
    return typeof window !== "undefined" ? window.desktop?.updates : undefined;
}

/** Whether the desktop auto-updater bridge is present (packaged Electron). */
export function isDesktopUpdater(): boolean {
    return bridge() != null;
}

export function desktopCheck(): void {
    bridge()?.check();
}

export function desktopDownload(): void {
    bridge()?.download();
}

export function desktopRestartToInstall(): void {
    bridge()?.restartToInstall();
}

export function desktopSetAutoDownload(enabled: boolean): void {
    bridge()?.setAutoDownload(enabled);
}

/**
 * Subscribe to update-status pushes from the main process. Returns an
 * unsubscribe function (a no-op when no bridge is present).
 */
export function onDesktopUpdateStatus(
    cb: (s: UpdateStatusInput) => void,
): () => void {
    const b = bridge();
    if (!b) return () => {};
    return b.onStatus(cb);
}
