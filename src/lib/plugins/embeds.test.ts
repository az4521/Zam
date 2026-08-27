// src/lib/plugins/embeds.test.ts
import { describe, it, expect, vi } from "vitest";
import { resolveEmbed } from "./embeds";
import type { RegistryEntry } from "./registry";
import type { MessageEmbed } from "./types";

function entry(
    pluginId: string,
    entryId: number,
    match: (u: string) => boolean,
): RegistryEntry<MessageEmbed> {
    return { pluginId, entryId, value: { match, render: () => {} } };
}

describe("resolveEmbed", () => {
    it("returns null when there are no entries", () => {
        expect(resolveEmbed([], "https://x.example")).toBeNull();
    });

    it("returns null when nothing matches", () => {
        const e = [entry("a", 1, () => false)];
        expect(resolveEmbed(e, "https://x.example")).toBeNull();
    });

    it("returns the matching entry", () => {
        const e = [entry("a", 1, (u) => u.includes("match"))];
        expect(resolveEmbed(e, "https://match.example")).toBe(e[0]);
    });

    it("returns the FIRST match in registry order when several match", () => {
        const first = entry("a", 1, () => true);
        const second = entry("b", 2, () => true);
        expect(resolveEmbed([first, second], "https://x")).toBe(first);
    });

    it("passes the exact url to each match()", () => {
        const match = vi.fn(() => false);
        resolveEmbed([entry("a", 1, match)], "https://exact.example/p?q=1");
        expect(match).toHaveBeenCalledWith("https://exact.example/p?q=1");
    });

    it("treats a throwing match() as no-match and keeps scanning", () => {
        const thrower = entry("bad", 1, () => {
            throw new Error("boom");
        });
        const good = entry("good", 2, () => true);
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(resolveEmbed([thrower, good], "https://x")).toBe(good);
        spy.mockRestore();
    });

    it("returns null if the only entry's match() throws", () => {
        const thrower = entry("bad", 1, () => {
            throw new Error("boom");
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(resolveEmbed([thrower], "https://x")).toBeNull();
        spy.mockRestore();
    });
});
