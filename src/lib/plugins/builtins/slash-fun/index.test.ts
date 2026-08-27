import { describe, it, expect } from "vitest";
import { FUN_COMMANDS, manifest } from "./index";

function cmd(name: string) {
    const c = FUN_COMMANDS.find((c) => c.name === name);
    if (!c) throw new Error(`no fun command ${name}`);
    return c;
}

describe("slash-fun manifest", () => {
    it("declares the built-in id + commands capability", () => {
        expect(manifest.id).toBe("zam.slash-fun");
        expect(manifest.entry).toBe("builtin");
        expect(manifest.capabilities).toContain("commands");
    });
});

describe("slash-fun commands — set + metadata", () => {
    it("registers exactly the 7 fun commands", () => {
        expect(FUN_COMMANDS.map((c) => c.name).sort()).toEqual(
            ["lenny", "me", "plain", "shrug", "spoiler", "tableflip", "unflip"].sort(),
        );
    });
    it("me is an emote with no transform, requiresArg", () => {
        expect(cmd("me").kind).toBe("emote");
        expect(cmd("me").transform).toBeUndefined();
        expect(cmd("me").requiresArg).toBe(true);
    });
    it("spoiler + plain require an arg; plain is plain", () => {
        expect(cmd("spoiler").requiresArg).toBe(true);
        expect(cmd("plain").requiresArg).toBe(true);
        expect(cmd("plain").plain).toBe(true);
    });
    it("all are text argKind", () => {
        for (const c of FUN_COMMANDS) expect(c.argKind).toBe("text");
    });
});

describe("slash-fun transforms — output parity", () => {
    const t = (name: string) => {
        const fn = cmd(name).transform;
        if (!fn) throw new Error(`no transform for ${name}`);
        return fn;
    };
    it("shrug appends the shrug, with and without a message", () => {
        expect(t("shrug")("")).toBe("¯\\_(ツ)_/¯");
        expect(t("shrug")("meh")).toBe("meh ¯\\_(ツ)_/¯");
    });
    it("tableflip / unflip / lenny produce their art", () => {
        expect(t("tableflip")("")).toContain("┻━┻");
        expect(t("unflip")("")).toContain("┬─┬");
        expect(t("lenny")("")).toContain("͡°");
    });
    it("spoiler wraps the message in spoiler markers", () => {
        expect(t("spoiler")("secret")).toBe("||secret||");
    });
    it("plain passes the message through unchanged", () => {
        expect(t("plain")("**bold**")).toBe("**bold**");
    });
});
