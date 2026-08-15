// src/lib/utils/audioPlayback.ts

// Pure view logic for the lazy audio row in MessageItem. The component owns the
// three flags (a fetched blob, a fetch in flight, a fetch that errored); this
// maps them to one display mode so the markup and the tests agree on precedence.

export type AudioPlaybackMode = "idle" | "loading" | "ready" | "failed";

/**
 * Precedence: a decoded blob (`ready`) always wins so a stale `failed` flag can
 * never hide a playable clip; `loading` outranks `failed` so a retry in flight
 * shows the spinner rather than the previous error.
 */
export function audioPlaybackMode(state: {
    hasBlob: boolean;
    loading: boolean;
    failed: boolean;
}): AudioPlaybackMode {
    if (state.hasBlob) return "ready";
    if (state.loading) return "loading";
    if (state.failed) return "failed";
    return "idle";
}

/** The muted caption under the filename for a non-playing audio row. */
export function audioStatusLabel(mode: AudioPlaybackMode): string {
    switch (mode) {
        case "loading":
            return "Loading…";
        case "failed":
            return "Failed to load · Retry";
        case "idle":
            return "Click to play";
        case "ready":
            return "";
    }
}
