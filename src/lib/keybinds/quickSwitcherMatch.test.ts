import { describe, it, expect } from "vitest";
import { matchScore } from "./quickSwitcherMatch";

describe("matchScore", () => {
    it("ranks exact > prefix > word start > substring > letters in order", () => {
        const s = (n: string) => matchScore(n, "gen")!;
        expect(matchScore("gen", "gen")!).toBeGreaterThan(s("general"));
        expect(s("general")).toBeGreaterThan(s("off-general"));
        expect(s("off-general")).toBeGreaterThan(s("regenerate"));
        expect(s("regenerate")).toBeGreaterThan(
            matchScore("green engine", "gen")!,
        );
    });

    it("finds letters in order and rejects the rest", () => {
        expect(matchScore("general", "gnrl")).not.toBeNull();
        expect(matchScore("general", "xyz")).toBeNull();
    });

    it("ignores case and surrounding space", () => {
        expect(matchScore("General", "  GEN ")).toBe(
            matchScore("general", "gen"),
        );
    });
});
