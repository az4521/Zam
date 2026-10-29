/**
 * Get the mic's noise model ready ahead of a call, so the mic is filtered
 * from its first sample: a plugin's filter where it runs, else FastEnhancer
 * (RNNoise or DeepFilterNet3 where they were asked for).
 */
import { prepareDeepFilter } from "./deepFilter";
import { prepareRnnoise } from "./rnnoise";
import { prepareFastEnhancer } from "./fastenhancer";
import { micFilterUsable, waitForMicFilter } from "./micFilters";
import type { DenoiseEngine } from "./micChain";

/** How long a join waits for the filter's plugin to finish loading. */
const PLUGIN_LOAD_WAIT_MS = 3000;

/** Resolves true once the engine the chain will use is ready, false after
 *  `timeoutMs` or when nothing can be. */
export async function prepareDenoiser(
    engine: DenoiseEngine,
    timeoutMs: number,
): Promise<boolean> {
    if (engine === "fastenhancer")
        return (await prepareFastEnhancer()) || prepareRnnoise();
    if (engine === "rnnoise") return prepareRnnoise();
    if (engine !== "deepfilter") {
        const filter = await waitForMicFilter(engine, PLUGIN_LOAD_WAIT_MS);
        if (filter && micFilterUsable(filter)) {
            if (!filter.prepare) return true;
            const r = await filter
                .prepare(timeoutMs)
                .catch((): "failed" => "failed");
            // Still getting ready: the chain tries it again and falls back
            // to FastEnhancer itself if it must.
            if (r !== "failed") return r === "ready";
        }
        return (await prepareFastEnhancer()) || prepareRnnoise();
    }
    return prepareDeepFilter(timeoutMs);
}

/** Background download of whatever the chosen mode will need. */
export async function prefetchDenoiser(engine: DenoiseEngine): Promise<void> {
    if (engine === "fastenhancer" || engine === "rnnoise") {
        await (engine === "rnnoise" ? prepareRnnoise() : prepareFastEnhancer());
        return;
    }
    const { prefetchDeepFilter } = await import("./deepFilter");
    if (engine !== "deepfilter") {
        // Plugins load at startup; give them a while.
        const filter = await waitForMicFilter(engine, 30_000);
        if (filter && micFilterUsable(filter)) {
            await filter
                .prefetch?.()
                .catch((err) =>
                    console.warn(`Noise filter ${engine} prefetch:`, err),
                );
            return;
        }
        await prepareFastEnhancer();
        return;
    }
    await prefetchDeepFilter();
}
