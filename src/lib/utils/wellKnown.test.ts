import { describe, it, expect } from "vitest";
import { classifyWellKnown } from "./wellKnown";

describe("classifyWellKnown", () => {
    it("treats 404 as IGNORE (use typed input, silently)", () => {
        expect(classifyWellKnown(404, undefined)).toEqual({ action: "ignore" });
        // Body is irrelevant on a 404.
        expect(classifyWellKnown(404, { "m.homeserver": {} })).toEqual({
            action: "ignore",
        });
    });

    it("prompts on a network/connection failure (status null)", () => {
        expect(classifyWellKnown(null, undefined)).toEqual({
            action: "prompt",
        });
    });

    it("prompts on a non-404 error status", () => {
        expect(classifyWellKnown(500, undefined)).toEqual({ action: "prompt" });
        expect(classifyWellKnown(403, undefined)).toEqual({ action: "prompt" });
    });

    it("prompts on a 2xx with invalid/absent JSON", () => {
        expect(classifyWellKnown(200, undefined)).toEqual({ action: "prompt" });
        expect(classifyWellKnown(200, null)).toEqual({ action: "prompt" });
        expect(classifyWellKnown(200, "not-an-object")).toEqual({
            action: "prompt",
        });
    });

    it("prompts on a 2xx missing m.homeserver.base_url", () => {
        expect(classifyWellKnown(200, {})).toEqual({ action: "prompt" });
        expect(classifyWellKnown(200, { "m.homeserver": {} })).toEqual({
            action: "prompt",
        });
        expect(
            classifyWellKnown(200, { "m.homeserver": { base_url: "" } }),
        ).toEqual({ action: "prompt" });
        expect(
            classifyWellKnown(200, { "m.homeserver": { base_url: 42 } }),
        ).toEqual({ action: "prompt" });
    });

    it("returns OK with a trimmed base_url on a valid discovery", () => {
        expect(
            classifyWellKnown(200, {
                "m.homeserver": { base_url: "https://matrix.example.org" },
            }),
        ).toEqual({ action: "ok", baseUrl: "https://matrix.example.org" });
        // A trailing slash is stripped so it composes cleanly with paths.
        expect(
            classifyWellKnown(200, {
                "m.homeserver": { base_url: "https://matrix.example.org/" },
            }),
        ).toEqual({ action: "ok", baseUrl: "https://matrix.example.org" });
    });

    it("accepts any 2xx status, not just 200", () => {
        expect(
            classifyWellKnown(299, {
                "m.homeserver": { base_url: "https://hs.example" },
            }),
        ).toEqual({ action: "ok", baseUrl: "https://hs.example" });
    });
});
