import { describe, it, expect } from "vitest";
import {
    parseSlashCommand,
    matchSlashCommands,
    SLASH_COMMANDS,
} from "./slashCommands";

describe("parseSlashCommand", () => {
    it("returns null for plain text", () => {
        expect(parseSlashCommand("hello world")).toBeNull();
    });

    it("returns null for empty or whitespace-only text", () => {
        expect(parseSlashCommand("")).toBeNull();
        expect(parseSlashCommand("   ")).toBeNull();
    });

    it("parses a known command with no argument", () => {
        const r = parseSlashCommand("/shrug");
        expect(r && "command" in r ? r.command.name : null).toBe("shrug");
        expect(r && "command" in r ? r.arg : null).toBe("");
    });

    it("parses a known command with an argument", () => {
        const r = parseSlashCommand("/me waves hello");
        expect(r && "command" in r ? r.command.name : null).toBe("me");
        expect(r && "command" in r ? r.arg : null).toBe("waves hello");
    });

    it("tolerates leading whitespace", () => {
        const r = parseSlashCommand("   /me hi");
        expect(r && "command" in r ? r.command.name : null).toBe("me");
        expect(r && "command" in r ? r.arg : null).toBe("hi");
    });

    it("resolves aliases (/leave -> part)", () => {
        const r = parseSlashCommand("/leave");
        expect(r && "command" in r ? r.command.name : null).toBe("part");
    });

    it("is case-insensitive for the command word", () => {
        const r = parseSlashCommand("/ME hi");
        expect(r && "command" in r ? r.command.name : null).toBe("me");
    });

    it("flags an unknown command", () => {
        expect(parseSlashCommand("/frobnicate x")).toEqual({
            unknown: "frobnicate",
        });
    });

    it("treats a // escape as plain text (null)", () => {
        expect(parseSlashCommand("//not a command")).toBeNull();
        expect(parseSlashCommand("//")).toBeNull();
    });

    it("does not treat a mid-message slash as a command", () => {
        expect(parseSlashCommand("hello /me")).toBeNull();
    });

    it("keeps a multiline argument intact", () => {
        const r = parseSlashCommand("/plain line1\nline2");
        expect(r && "command" in r ? r.arg : null).toBe("line1\nline2");
    });
});

describe("text transforms", () => {
    function transformOf(name: string) {
        const cmd = SLASH_COMMANDS.find((c) => c.name === name);
        if (!cmd?.transform) throw new Error(`no transform for ${name}`);
        return cmd.transform;
    }

    it("shrug appends the shrug, with and without a message", () => {
        expect(transformOf("shrug")("")).toBe("¯\\_(ツ)_/¯");
        expect(transformOf("shrug")("meh")).toBe("meh ¯\\_(ツ)_/¯");
    });

    it("tableflip / unflip / lenny produce their art", () => {
        expect(transformOf("tableflip")("")).toContain("┻━┻");
        expect(transformOf("unflip")("")).toContain("┬─┬");
        expect(transformOf("lenny")("")).toContain("͡°");
    });

    it("spoiler wraps the message in spoiler markers", () => {
        expect(transformOf("spoiler")("secret")).toBe("||secret||");
    });

    it("plain passes the message through unchanged", () => {
        expect(transformOf("plain")("**bold**")).toBe("**bold**");
    });
});

describe("matchSlashCommands", () => {
    it("returns every command for an empty query", () => {
        expect(matchSlashCommands("").length).toBe(SLASH_COMMANDS.length);
    });

    it("prefix-matches by command name", () => {
        const names = matchSlashCommands("sh").map((c) => c.name);
        expect(names).toContain("shrug");
        expect(names).not.toContain("me");
    });

    it("matches on aliases", () => {
        expect(matchSlashCommands("lea").map((c) => c.name)).toContain("part");
    });

    it("is case-insensitive", () => {
        expect(matchSlashCommands("SH").map((c) => c.name)).toContain("shrug");
    });

    it("tolerates a leading slash in the query", () => {
        expect(matchSlashCommands("/sh").map((c) => c.name)).toContain("shrug");
    });
});
