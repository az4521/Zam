// Renderer-side bridge to the Electron screen-share source picker. The real
// work happens in the main process (see electron/main.cjs), which arbitrates
// getDisplayMedia() and pushes the enumerated source list here. This module is
// a thin pass-through that guards on the bridge's presence, so importing or
// calling it is safe on web and Android (where `window.desktop` is undefined)
// — every function no-ops there and no picker ever appears.

import type { DisplaySourceRequest } from "$lib/utils/displaySources";

function bridge() {
    return typeof window !== "undefined"
        ? window.desktop?.screenShare
        : undefined;
}

/** Subscribe to source-list pushes. Returns an unsubscribe function (a no-op
 *  when no bridge is present). */
export function onScreenShareRequest(
    cb: (req: DisplaySourceRequest) => void,
): () => void {
    return bridge()?.onRequest(cb) ?? (() => {});
}

/** Subscribe to main giving up on a pending pick (its timeout fired). */
export function onScreenShareCancel(
    cb: (requestId: number) => void,
): () => void {
    return bridge()?.onCancel(cb) ?? (() => {});
}

/** Answer a pending request. `sourceId === null` means the user cancelled. */
export function respondToScreenShare(
    requestId: number,
    sourceId: string | null,
    sourceName?: string,
): void {
    bridge()?.respond(requestId, sourceId, sourceName);
}
