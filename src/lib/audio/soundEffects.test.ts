import { describe, it, expect, vi, afterEach } from "vitest";
import {
    SOUND_RECIPES,
    RING_PATTERN,
    RING_BLIP_PATTERN,
    RING_MAX_MS,
    startRingtone,
    playRingBlip,
    configureRing,
} from "./soundEffects";

const ALL_NAMES = [
    "selfJoin",
    "selfLeave",
    "peerJoin",
    "peerLeave",
    "mute",
    "unmute",
    "deafen",
    "undeafen",
    "error",
] as const;

describe("SOUND_RECIPES", () => {
    it("defines every call sound", () => {
        for (const name of ALL_NAMES) {
            expect(SOUND_RECIPES[name]?.length, name).toBeGreaterThan(0);
        }
    });
    it("keeps segments short, audible, and in range", () => {
        for (const [name, segments] of Object.entries(SOUND_RECIPES)) {
            for (const seg of segments) {
                expect(seg.duration, name).toBeGreaterThan(0);
                expect(seg.at, name).toBeGreaterThanOrEqual(0);
                expect(seg.at + seg.duration, name).toBeLessThanOrEqual(0.5);
                expect(seg.from, name).toBeGreaterThanOrEqual(100);
                expect(seg.from, name).toBeLessThanOrEqual(2000);
                expect(seg.to, name).toBeGreaterThanOrEqual(100);
                expect(seg.to, name).toBeLessThanOrEqual(2000);
                expect(seg.peak, name).toBeGreaterThan(0);
                expect(seg.peak, name).toBeLessThanOrEqual(1);
            }
        }
    });
});

const inRange = (
    segments: typeof RING_PATTERN,
    maxEnd: number,
    label: string,
) => {
    for (const seg of segments) {
        expect(seg.duration, label).toBeGreaterThan(0);
        expect(seg.at, label).toBeGreaterThanOrEqual(0);
        expect(seg.at + seg.duration, label).toBeLessThanOrEqual(maxEnd);
        expect(seg.from, label).toBeGreaterThanOrEqual(100);
        expect(seg.from, label).toBeLessThanOrEqual(2000);
        expect(seg.to, label).toBeGreaterThanOrEqual(100);
        expect(seg.to, label).toBeLessThanOrEqual(2000);
        expect(seg.peak, label).toBeGreaterThan(0);
        expect(seg.peak, label).toBeLessThanOrEqual(1);
    }
};

describe("ring patterns", () => {
    it("defines a ring and a blip", () => {
        expect(RING_PATTERN.length).toBeGreaterThan(0);
        expect(RING_BLIP_PATTERN.length).toBeGreaterThan(0);
    });
    it("keeps the ring cycle inside its 2s slot, audible and in range", () => {
        inRange(RING_PATTERN, 2, "RING_PATTERN");
    });
    it("keeps the blip short, audible and in range", () => {
        inRange(RING_BLIP_PATTERN, 0.5, "RING_BLIP_PATTERN");
    });
    it("caps the ring at ten seconds", () => {
        expect(RING_MAX_MS).toBe(10000);
    });
});

describe("ringtone handle", () => {
    // jsdom has no AudioContext: the engine must degrade silently rather
    // than throw, and the handle contract must hold either way.
    it("returns a stoppable handle without an AudioContext", () => {
        const handle = startRingtone();
        expect(handle).toBeDefined();
        expect(() => handle.stop()).not.toThrow();
    });
    it("tolerates stop() being called twice", () => {
        const handle = startRingtone();
        handle.stop();
        expect(() => handle.stop()).not.toThrow();
    });
    it("does not throw on blip or configure without an AudioContext", () => {
        expect(() => playRingBlip()).not.toThrow();
        expect(() =>
            configureRing({ enabled: false, volume: 0.5 }),
        ).not.toThrow();
        configureRing({ enabled: true, volume: 1 });
    });
});

// ── Ring routing invariant ─────────────────────────────────────────────────
// The ringtone must hang off its OWN gain node, never `master`: the
// call-sound toggle/volume must not silence or duck the ring (and vice
// versa). That routing lives inside soundEffects and is only visible through
// the WebAudio graph, so these tests stub a minimal AudioContext and trace
// which gain node each sound terminates at. Guards against a future
// soundEffects rewrite quietly re-routing the ring through `master`.

interface FakeParam {
    value: number;
    setValueAtTime(v: number): void;
    linearRampToValueAtTime(v: number): void;
    exponentialRampToValueAtTime(v: number): void;
    cancelScheduledValues(): void;
}
function makeParam(v = 0): FakeParam {
    return {
        value: v,
        setValueAtTime(x) {
            this.value = x;
        },
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
    };
}

interface FakeNode {
    outputs: unknown[];
    connect(target: unknown): void;
}
interface FakeGain extends FakeNode {
    gain: FakeParam;
}

class FakeAudioContext {
    state = "running";
    currentTime = 0;
    destination = { node: "destination" };
    gains: FakeGain[] = [];
    oscillators: FakeNode[] = [];
    constructor(sink: FakeAudioContext[]) {
        sink.push(this);
    }
    resume() {
        return Promise.resolve();
    }
    createGain(): FakeGain {
        const g: FakeGain = {
            gain: makeParam(),
            outputs: [],
            connect(t) {
                this.outputs.push(t);
            },
        };
        this.gains.push(g);
        return g;
    }
    createOscillator(): FakeNode & {
        type: string;
        frequency: FakeParam;
        start(): void;
        stop(): void;
    } {
        const o = {
            type: "sine",
            frequency: makeParam(),
            outputs: [] as unknown[],
            connect(t: unknown) {
                this.outputs.push(t);
            },
            start() {},
            stop() {},
        };
        this.oscillators.push(o);
        return o;
    }
}

/** Install a stubbed AudioContext and return the array of contexts it creates. */
function installFakeAudio(): FakeAudioContext[] {
    const instances: FakeAudioContext[] = [];
    vi.stubGlobal(
        "AudioContext",
        class extends FakeAudioContext {
            constructor() {
                super(instances);
            }
        },
    );
    return instances;
}

/** Follow `connect()` edges from a node until we reach the one that feeds the
 *  context destination — i.e. the gain node the sound's volume is set on. */
function terminalBeforeDestination(
    start: FakeNode,
    destination: unknown,
): FakeGain | null {
    const seen = new Set<unknown>();
    const stack: FakeNode[] = [start];
    while (stack.length) {
        const node = stack.pop()!;
        if (seen.has(node)) continue;
        seen.add(node);
        if (node.outputs.includes(destination)) return node as FakeGain;
        for (const t of node.outputs)
            if (t !== destination) stack.push(t as FakeNode);
    }
    return null;
}

async function freshSoundEngine() {
    const instances = installFakeAudio();
    vi.resetModules();
    const mod = await import("./soundEffects");
    return { instances, mod };
}

describe("ring routing invariant", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it("routes the ring through its own gain node, not the call-sound master", async () => {
        const { instances, mod } = await freshSoundEngine();
        // Distinct volumes so the two terminal gains are distinguishable.
        mod.configureCallSounds({ enabled: true, volume: 0.9 });
        mod.configureRing({ enabled: true, volume: 0.3 });

        mod.playCallSound("selfJoin");
        mod.startRingtone();

        const ctx = instances[0];
        expect(ctx).toBeDefined();
        const callNode = terminalBeforeDestination(
            ctx.oscillators[0],
            ctx.destination,
        );
        const ringNode = terminalBeforeDestination(
            ctx.oscillators[ctx.oscillators.length - 1],
            ctx.destination,
        );

        expect(callNode).not.toBeNull();
        expect(ringNode).not.toBeNull();
        // The whole point: separate nodes with separate volumes.
        expect(ringNode).not.toBe(callNode);
        expect(callNode!.gain.value).toBe(0.9);
        expect(ringNode!.gain.value).toBe(0.3);
    });

    it("keeps the ring at full ring volume when call sounds are turned off", async () => {
        const { instances, mod } = await freshSoundEngine();
        mod.configureRing({ enabled: true, volume: 1 });
        mod.configureCallSounds({ enabled: false, volume: 0 });

        mod.startRingtone();

        const ctx = instances[0];
        // The ring actually scheduled audible oscillators...
        expect(ctx.oscillators.length).toBeGreaterThan(0);
        const ringNode = terminalBeforeDestination(
            ctx.oscillators[ctx.oscillators.length - 1],
            ctx.destination,
        );
        // ...at full ring volume, unaffected by call sounds being silenced.
        // (If the ring were routed through master this would be 0.)
        expect(ringNode!.gain.value).toBe(1);
    });

    it("schedules nothing when the ring is disabled, even with call sounds on", async () => {
        const { instances, mod } = await freshSoundEngine();
        mod.configureCallSounds({ enabled: true, volume: 0.8 });
        mod.configureRing({ enabled: false, volume: 1 });

        mod.playCallSound("selfJoin"); // creates the context + call oscillators
        const ctx = instances[0];
        const before = ctx.oscillators.length;
        mod.startRingtone();

        // The ring's own enable gate held; the call-sound toggle did not
        // override it.
        expect(ctx.oscillators.length).toBe(before);
    });
});
