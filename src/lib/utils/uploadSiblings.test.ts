import { describe, it, expect } from "vitest";
import { siblingUploadIndices } from "./uploadSiblings";
import type { TimelineDisplayEvent } from "./timelineDisplay";

const MIN = 60_000;
const ev = (id: string, sender: string, ts: number): TimelineDisplayEvent => ({
    getId: () => id,
    getSender: () => sender,
    getTs: () => ts,
});

describe("siblingUploadIndices", () => {
    it("returns the single index for a lone pageable upload", () => {
        const events = [ev("a", "@u", 0)];
        expect(siblingUploadIndices(events, [true], 0)).toEqual([0]);
    });

    it("returns all three consecutive same-sender uploads within the window", () => {
        const events = [
            ev("a", "@u", 0),
            ev("b", "@u", 10_000),
            ev("c", "@u", 20_000),
        ];
        const p = [true, true, true];
        expect(siblingUploadIndices(events, p, 0)).toEqual([0, 1, 2]);
        expect(siblingUploadIndices(events, p, 1)).toEqual([0, 1, 2]);
        expect(siblingUploadIndices(events, p, 2)).toEqual([0, 1, 2]);
    });

    it("excludes a different sender's adjacent upload", () => {
        const events = [
            ev("a", "@u", 0),
            ev("b", "@u", 5_000),
            ev("c", "@other", 6_000),
        ];
        expect(siblingUploadIndices(events, [true, true, true], 0)).toEqual([
            0, 1,
        ]);
        // The clicked other-sender image only pages within its own run.
        expect(siblingUploadIndices(events, [true, true, true], 2)).toEqual([
            2,
        ]);
    });

    it("a non-pageable event between uploads breaks the run", () => {
        // a=img, b=text (not pageable), c=img — all same sender/window.
        const events = [
            ev("a", "@u", 0),
            ev("b", "@u", 1_000),
            ev("c", "@u", 2_000),
        ];
        const p = [true, false, true];
        expect(siblingUploadIndices(events, p, 0)).toEqual([0]);
        expect(siblingUploadIndices(events, p, 2)).toEqual([2]);
    });

    it("a > 5-minute gap breaks the run", () => {
        const events = [
            ev("a", "@u", 0),
            ev("b", "@u", 6 * MIN), // gap > GROUP_WINDOW_MS
        ];
        expect(siblingUploadIndices(events, [true, true], 0)).toEqual([0]);
        expect(siblingUploadIndices(events, [true, true], 1)).toEqual([1]);
    });

    it("returns [] when the clicked event is not pageable", () => {
        const events = [ev("a", "@u", 0), ev("b", "@u", 1_000)];
        expect(siblingUploadIndices(events, [false, true], 0)).toEqual([]);
    });

    it("returns [] for an out-of-range clicked index", () => {
        const events = [ev("a", "@u", 0)];
        expect(siblingUploadIndices(events, [true], -1)).toEqual([]);
        expect(siblingUploadIndices(events, [true], 5)).toEqual([]);
    });

    it("treats a short/undefined pageable entry as not pageable", () => {
        const events = [ev("a", "@u", 0), ev("b", "@u", 1_000)];
        // pageable only has one entry → index 1 is undefined → falsey.
        expect(siblingUploadIndices(events, [true], 0)).toEqual([0]);
    });

    it("picks only the clicked contiguous run when several runs exist", () => {
        // img img | text | img img  (same sender, all within window)
        const events = [
            ev("a", "@u", 0),
            ev("b", "@u", 1_000),
            ev("t", "@u", 2_000),
            ev("c", "@u", 3_000),
            ev("d", "@u", 4_000),
        ];
        const p = [true, true, false, true, true];
        expect(siblingUploadIndices(events, p, 0)).toEqual([0, 1]);
        expect(siblingUploadIndices(events, p, 3)).toEqual([3, 4]);
    });
});
