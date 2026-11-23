import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/** An empty but valid wasm module: passes isWasm and WebAssembly.compile. */
const WASM = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);

let fetchCount = 0;

beforeEach(() => {
    vi.resetModules();
    fetchCount = 0;
    vi.useFakeTimers();
    // Jsdom has no AudioWorklet; the loaders only check that it exists.
    vi.stubGlobal("AudioWorkletNode", class {});
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
            fetchCount++;
            return {
                ok: true,
                arrayBuffer: async () => WASM.slice().buffer,
            };
        }),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("releasing the voice filters makes the next use reload", () => {
    it("RNNoise: a cached module is reused until released, then fetched again", async () => {
        const { prepareRnnoise, releaseRnnoise } = await import("./rnnoise");
        expect(await prepareRnnoise()).toBe(true);
        expect(fetchCount).toBe(1);
        expect(await prepareRnnoise()).toBe(true);
        expect(fetchCount).toBe(1);
        releaseRnnoise();
        expect(await prepareRnnoise()).toBe(true);
        expect(fetchCount).toBe(2);
    });

    it("FastEnhancer: engine module and weights are fetched again after release", async () => {
        const { prepareFastEnhancer, releaseFastEnhancer } =
            await import("./fastenhancer");
        expect(await prepareFastEnhancer("base")).toBe(true);
        // The engine module and the weights.
        expect(fetchCount).toBe(2);
        expect(await prepareFastEnhancer("base")).toBe(true);
        expect(fetchCount).toBe(2);
        releaseFastEnhancer();
        expect(await prepareFastEnhancer("base")).toBe(true);
        expect(fetchCount).toBe(4);
    });

    it("DeepFilterNet3: the compiled module is rebuilt after release", async () => {
        const { prepareDeepFilter, releaseDeepFilter } =
            await import("./deepFilter");
        expect(await prepareDeepFilter(60_000)).toBe(true);
        expect(fetchCount).toBe(1);
        expect(await prepareDeepFilter(60_000)).toBe(true);
        expect(fetchCount).toBe(1);
        releaseDeepFilter();
        expect(await prepareDeepFilter(60_000)).toBe(true);
        expect(fetchCount).toBe(2);
    });

    it("a lease released with no call after it drops the caches after the grace", async () => {
        const { prepareRnnoise } = await import("./rnnoise");
        const { acquireVoiceFilters, VOICE_FILTER_RELEASE_GRACE_MS } =
            await import("./voiceFilterLifetime");
        const lease = acquireVoiceFilters();
        expect(await prepareRnnoise()).toBe(true);
        expect(fetchCount).toBe(1);
        lease();
        await vi.advanceTimersByTimeAsync(VOICE_FILTER_RELEASE_GRACE_MS);
        expect(await prepareRnnoise()).toBe(true);
        expect(fetchCount).toBe(2);
    });

    it("a lease held through the grace keeps the caches", async () => {
        const { prepareRnnoise } = await import("./rnnoise");
        const { acquireVoiceFilters, VOICE_FILTER_RELEASE_GRACE_MS } =
            await import("./voiceFilterLifetime");
        const lease = acquireVoiceFilters();
        expect(await prepareRnnoise()).toBe(true);
        await vi.advanceTimersByTimeAsync(VOICE_FILTER_RELEASE_GRACE_MS * 2);
        expect(await prepareRnnoise()).toBe(true);
        expect(fetchCount).toBe(1);
        lease();
    });
});
