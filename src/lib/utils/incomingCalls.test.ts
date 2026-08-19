import { describe, it, expect } from "vitest";
import { diffIncomingCalls, type CallSnapshot } from "./incomingCalls";

const ME = "@me:example.org";
const THEM = "@them:example.org";
const DM = "!dm:example.org";
const DM2 = "!dm2:example.org";
const GROUP = "!group:example.org";

const snap = (entries: Record<string, string[]>): CallSnapshot =>
    new Map(Object.entries(entries));

const opts = (over: Partial<Parameters<typeof diffIncomingCalls>[2]> = {}) => ({
    dmRoomIds: new Set([DM, DM2]),
    ownUserId: ME,
    declined: new Set<string>(),
    prevRinging: [] as string[],
    busy: false,
    ...over,
});

describe("diffIncomingCalls", () => {
    it("rings on the boot seed for an already-active call (catch-up on entry)", () => {
        const r = diffIncomingCalls(
            null,
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts(),
        );
        expect(r.ringing).toEqual([DM]);
        expect(r.startRing).toBe(DM);
        expect(r.blip).toBe(false);
    });

    it("stays quiet on the boot seed when no call is active", () => {
        const r = diffIncomingCalls(null, snap({ [DM]: [] }), opts());
        expect(r.ringing).toEqual([]);
        expect(r.startRing).toBeNull();
        expect(r.blip).toBe(false);
    });

    it("blips instead of ringing on the boot seed while busy", () => {
        const r = diffIncomingCalls(
            null,
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts({ busy: true }),
        );
        expect(r.startRing).toBeNull();
        expect(r.blip).toBe(true);
        expect(r.ringing).toEqual([DM]);
    });

    it("does not ring on the boot seed for a call declined earlier", () => {
        const r = diffIncomingCalls(
            null,
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts({ declined: new Set([DM]) }),
        );
        expect(r.ringing).toEqual([]);
        expect(r.startRing).toBeNull();
    });

    it("never rings on the boot seed for your own membership (another device)", () => {
        const r = diffIncomingCalls(
            null,
            snap({ [DM]: [`${ME}:OTHERDEVICE`] }),
            opts(),
        );
        expect(r.ringing).toEqual([]);
        expect(r.startRing).toBeNull();
    });

    it("rings once and blips for two calls already active on the boot seed", () => {
        const r = diffIncomingCalls(
            null,
            snap({ [DM]: [`${THEM}:AAA`], [DM2]: [`${THEM}:CCC`] }),
            opts(),
        );
        expect(r.startRing).toBe(DM);
        expect(r.blip).toBe(true);
        expect(r.ringing).toEqual([DM, DM2]);
    });

    it("rings when a caller newly appears", () => {
        const r = diffIncomingCalls(
            snap({ [DM]: [] }),
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts(),
        );
        expect(r.ringing).toEqual([DM]);
        expect(r.startRing).toBe(DM);
        expect(r.blip).toBe(false);
    });

    it("does not re-ring when a second device of the same caller joins", () => {
        const r = diffIncomingCalls(
            snap({ [DM]: [`${THEM}:AAA`] }),
            snap({ [DM]: [`${THEM}:AAA`, `${THEM}:BBB`] }),
            opts({ prevRinging: [DM] }),
        );
        expect(r.startRing).toBeNull();
        expect(r.ringing).toEqual([DM]);
    });

    it("does not ring on session re-emission of an unchanged roster", () => {
        const s = snap({ [DM]: [`${THEM}:AAA`] });
        const r = diffIncomingCalls(
            s,
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts({ prevRinging: [DM] }),
        );
        expect(r.startRing).toBeNull();
    });

    it("never rings for your own membership from another device", () => {
        const r = diffIncomingCalls(
            snap({ [DM]: [] }),
            snap({ [DM]: [`${ME}:OTHERDEVICE`] }),
            opts(),
        );
        expect(r.ringing).toEqual([]);
        expect(r.startRing).toBeNull();
    });

    it("drops the room once your own membership appears (accept)", () => {
        const r = diffIncomingCalls(
            snap({ [DM]: [`${THEM}:AAA`] }),
            snap({ [DM]: [`${THEM}:AAA`, `${ME}:MINE`] }),
            opts({ prevRinging: [DM] }),
        );
        expect(r.ringing).toEqual([]);
    });

    it("does not ring a room that is not a DM", () => {
        const r = diffIncomingCalls(
            snap({ [GROUP]: [] }),
            snap({ [GROUP]: [`${THEM}:AAA`] }),
            opts(),
        );
        expect(r.ringing).toEqual([]);
        expect(r.startRing).toBeNull();
    });

    it("suppresses a declined room", () => {
        const r = diffIncomingCalls(
            snap({ [DM]: [] }),
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts({ declined: new Set([DM]) }),
        );
        expect(r.ringing).toEqual([]);
        expect(r.startRing).toBeNull();
        expect(r.declined.has(DM)).toBe(true);
    });

    it("clears the decline once the caller leaves, so a re-call rings again", () => {
        const cleared = diffIncomingCalls(
            snap({ [DM]: [`${THEM}:AAA`] }),
            snap({ [DM]: [] }),
            opts({ declined: new Set([DM]) }),
        );
        expect(cleared.declined.has(DM)).toBe(false);

        const recall = diffIncomingCalls(
            snap({ [DM]: [] }),
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts({ declined: cleared.declined }),
        );
        expect(recall.startRing).toBe(DM);
    });

    it("blips instead of ringing when busy", () => {
        const r = diffIncomingCalls(
            snap({ [DM]: [] }),
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts({ busy: true }),
        );
        expect(r.startRing).toBeNull();
        expect(r.blip).toBe(true);
        expect(r.ringing).toEqual([DM]);
    });

    it("rings once and blips for a second simultaneous caller", () => {
        const r = diffIncomingCalls(
            snap({ [DM]: [], [DM2]: [] }),
            snap({ [DM]: [`${THEM}:AAA`], [DM2]: [`${THEM}:CCC`] }),
            opts(),
        );
        expect(r.startRing).toBe(DM);
        expect(r.blip).toBe(true);
        expect(r.ringing).toEqual([DM, DM2]);
    });

    it("keeps ringing order stable as rooms come and go", () => {
        const r = diffIncomingCalls(
            snap({ [DM]: [`${THEM}:AAA`], [DM2]: [`${THEM}:CCC`] }),
            snap({ [DM]: [`${THEM}:AAA`], [DM2]: [`${THEM}:CCC`] }),
            opts({ prevRinging: [DM2, DM] }),
        );
        expect(r.ringing).toEqual([DM2, DM]);
    });

    it("does not ring when you hang up but the caller stays", () => {
        // You were in the call; you leave; their membership is unchanged.
        // The card returns (they are still waiting) but nothing sounds.
        const r = diffIncomingCalls(
            snap({ [DM]: [`${THEM}:AAA`, `${ME}:MINE`] }),
            snap({ [DM]: [`${THEM}:AAA`] }),
            opts(),
        );
        expect(r.ringing).toEqual([DM]);
        expect(r.startRing).toBeNull();
    });
});
