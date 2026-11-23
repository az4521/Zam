/**
 * When the voice filters' in-memory state (compiled DeepFilterNet3 module,
 * FastEnhancer and RNNoise and AGC2 wasm bytes and weights, the GPU worker
 * with its GPUDevice) is dropped.
 *
 * Users hold a lease while they may need the filters: a live mic chain
 * (createMicChain until its destroy: calls, the settings mic test, prefetch),
 * a call between join and leave, and a prepare or prefetch in progress. When
 * the last lease goes, the release runs after a grace period, so a quick
 * rejoin does not reload. Nothing here touches the disk copy of the models
 * (modelCache): a reload reads from it, not the network.
 *
 * Nodes that are already built keep their own copy of the module, so the
 * release never breaks a running chain; it is still gated on the lease count
 * so no chain can be using the GPU worker when it is terminated.
 */
import { releaseDeepFilter } from "./deepFilter";
import { releaseFastEnhancer } from "./fastenhancer";
import { releaseFastEnhancerGpu } from "./fastenhancerGpu";
import { releaseRnnoise } from "./rnnoise";
import { releaseAgc2 } from "./agc2";

/** How long the filters stay loaded after the last user lets go. */
export const VOICE_FILTER_RELEASE_GRACE_MS = 30_000;

const releasers: Array<() => void> = [
    releaseDeepFilter,
    releaseFastEnhancer,
    releaseFastEnhancerGpu,
    releaseRnnoise,
    releaseAgc2,
];

let users = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

function cancelTimer(): void {
    if (timer !== null) {
        clearTimeout(timer);
        timer = null;
    }
}

function scheduleRelease(): void {
    if (timer !== null) return;
    timer = setTimeout(() => {
        timer = null;
        if (users === 0) releaseVoiceFilters();
    }, VOICE_FILTER_RELEASE_GRACE_MS);
}

/** Takes a lease on the voice filters: they stay loaded while it is held.
 *  Returns the release for it; calling that more than once is harmless. */
export function acquireVoiceFilters(): () => void {
    users++;
    cancelTimer();
    let held = true;
    return () => {
        if (!held) return;
        held = false;
        users--;
        if (users === 0) scheduleRelease();
    };
}

/** How many leases are held right now. */
export function voiceFilterUsers(): number {
    return users;
}

/** Drops every voice filter's in-memory state now, so the next use reloads
 *  it. Refuses (returns false) while any lease is held, so a filter in use
 *  is never taken from under a chain. */
export function releaseVoiceFilters(): boolean {
    if (users > 0) return false;
    cancelTimer();
    for (const release of releasers) {
        try {
            release();
        } catch (err) {
            console.warn("Voice filter release failed:", err);
        }
    }
    return true;
}
