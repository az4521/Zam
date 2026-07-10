export type SyncTone = "ok" | "warn" | "error" | "idle";

export interface SyncStatus {
    label: string;
    tone: SyncTone;
}

/**
 * Map a raw matrix-js-sdk sync state to a human-friendly label and status
 * tone. The SDK's steady state is "SYNCING", which reads as "stuck" when shown
 * verbatim — here it (and the initial "PREPARED") becomes "Connected".
 */
export function syncStateLabel(state: string | null | undefined): SyncStatus {
    switch (state) {
        case "PREPARED":
        case "SYNCING":
            return { label: "Connected", tone: "ok" };
        case "RECONNECTING":
        case "CATCHUP":
            return { label: "Reconnecting…", tone: "warn" };
        case "ERROR":
            return { label: "Connection error", tone: "error" };
        case "STOPPED":
            return { label: "Offline", tone: "idle" };
        default:
            return { label: "Connecting…", tone: "idle" };
    }
}
