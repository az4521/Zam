import { describe, it, expect } from "vitest";
import { filesToRestoreAfterSend } from "./composerFileRestore";

type F = { id: string; name: string };
const batch: F[] = [
    { id: "q1", name: "a.png" },
    { id: "q2", name: "b.png" },
    { id: "q3", name: "c.png" },
];

describe("filesToRestoreAfterSend", () => {
    it("restores nothing when every file was sent", () => {
        const sent = new Set(["q1", "q2", "q3"]);
        expect(filesToRestoreAfterSend(batch, sent)).toEqual([]);
    });

    it("restores the whole batch when nothing was sent", () => {
        expect(filesToRestoreAfterSend(batch, new Set())).toEqual(batch);
    });

    it("restores only the unsent files after a partial failure (MEDIA-03: no already-sent file is restored)", () => {
        // First file sent, then #2 failed and #3 never attempted.
        const sent = new Set(["q1"]);
        const restored = filesToRestoreAfterSend(batch, sent);
        expect(restored).toEqual([
            { id: "q2", name: "b.png" },
            { id: "q3", name: "c.png" },
        ]);
        // The MEDIA-03 invariant, asserted directly:
        expect(restored.some((f) => f.id === "q1")).toBe(false);
    });

    it("preserves original order in the restore set", () => {
        const sent = new Set(["q2"]);
        expect(filesToRestoreAfterSend(batch, sent).map((f) => f.id)).toEqual([
            "q1",
            "q3",
        ]);
    });

    it("returns an empty array for an empty batch", () => {
        expect(filesToRestoreAfterSend([], new Set(["q1"]))).toEqual([]);
    });
});
