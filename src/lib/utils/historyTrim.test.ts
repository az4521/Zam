import { describe, expect, it } from "vitest";
import {
    HISTORY_TRIM_IDLE_MS,
    historyTrimCut,
    mayTrimRoom,
} from "./historyTrim";

describe("historyTrimCut", () => {
    it("keeps the newest rendered events, not the newest events", () => {
        // 10 rendered, then 30 hidden (joins, reactions) at the bottom.
        const rendered = [...Array(60).fill(true), ...Array(30).fill(false)];
        const cut = historyTrimCut(rendered, 10, 5);
        expect(cut).toBe(50);
        expect(rendered.slice(cut!).filter(Boolean)).toHaveLength(10);
    });

    it("keeps hidden events between the kept ones", () => {
        const rendered = Array.from({ length: 200 }, (_, i) => i % 2 === 0);
        const cut = historyTrimCut(rendered, 50, 10)!;
        expect(rendered[cut]).toBe(true);
        expect(rendered.slice(cut).filter(Boolean)).toHaveLength(50);
        expect(rendered.length - cut).toBe(100);
    });

    it("leaves a room with too few rendered events alone", () => {
        // 1000 events, only 20 render: all of them must stay.
        const rendered = Array.from({ length: 1000 }, (_, i) => i % 50 === 0);
        expect(historyTrimCut(rendered, 100, 50)).toBeNull();
    });

    it("skips a trim that would drop too little", () => {
        expect(historyTrimCut(Array(120).fill(true), 100, 50)).toBeNull();
        expect(historyTrimCut(Array(150).fill(true), 100, 50)).toBe(50);
    });

    it("handles an empty room", () => {
        expect(historyTrimCut([])).toBeNull();
    });
});

describe("mayTrimRoom", () => {
    it("never trims the open room", () => {
        expect(mayTrimRoom("!a", "!a", undefined, 1e9)).toBe(false);
    });

    it("waits after the room is left", () => {
        expect(mayTrimRoom("!a", "!b", 1000, 1000 + 5000)).toBe(false);
        expect(mayTrimRoom("!a", "!b", 1000, 1000 + HISTORY_TRIM_IDLE_MS)).toBe(
            true,
        );
    });

    it("trims a room never opened this session", () => {
        expect(mayTrimRoom("!a", null, undefined, 0)).toBe(true);
    });
});
