import { describe, it, expect } from "vitest";
import {
    parseSlashCommand,
    matchSlashCommands,
    SLASH_COMMANDS,
    parseNickArg,
    parseOpArg,
    parseDeopArg,
    resolveMentionTokens,
    DEFAULT_OP_LEVEL,
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

describe("parseNickArg", () => {
    it("returns the trimmed name", () => {
        expect(parseNickArg("Alice")).toEqual({ name: "Alice" });
        expect(parseNickArg("  Alice  ")).toEqual({ name: "Alice" });
    });
    it("preserves internal spaces", () => {
        expect(parseNickArg("Dr. Alice Smith")).toEqual({
            name: "Dr. Alice Smith",
        });
    });
    it("errors on empty / whitespace-only", () => {
        expect("error" in parseNickArg("")).toBe(true);
        expect("error" in parseNickArg("   ")).toBe(true);
    });
});

describe("parseOpArg", () => {
    it("defaults the level to DEFAULT_OP_LEVEL (50)", () => {
        expect(parseOpArg("@bob:hs")).toEqual({
            user: "@bob:hs",
            level: DEFAULT_OP_LEVEL,
        });
        expect(DEFAULT_OP_LEVEL).toBe(50);
    });
    it("accepts an explicit level", () => {
        expect(parseOpArg("@bob:hs 100")).toEqual({
            user: "@bob:hs",
            level: 100,
        });
        expect(parseOpArg("bob 0")).toEqual({ user: "bob", level: 0 });
    });
    it("errors on a missing user", () => {
        expect("error" in parseOpArg("")).toBe(true);
        expect("error" in parseOpArg("   ")).toBe(true);
    });
    it("errors on a non-integer / negative level", () => {
        expect("error" in parseOpArg("@bob:hs 5.5")).toBe(true);
        expect("error" in parseOpArg("@bob:hs fifty")).toBe(true);
        expect("error" in parseOpArg("@bob:hs 50x")).toBe(true);
        expect("error" in parseOpArg("@bob:hs -3")).toBe(true);
    });
    it("errors on too many arguments", () => {
        expect("error" in parseOpArg("@bob:hs 50 please")).toBe(true);
    });
});

describe("parseDeopArg", () => {
    it("returns the user token", () => {
        expect(parseDeopArg("@bob:hs")).toEqual({ user: "@bob:hs" });
        expect(parseDeopArg("bob")).toEqual({ user: "bob" });
    });
    it("errors on a missing user", () => {
        expect("error" in parseDeopArg("")).toBe(true);
    });
    it("errors on too many arguments", () => {
        expect("error" in parseDeopArg("@bob:hs x")).toBe(true);
    });
});

describe("resolveMentionTokens", () => {
    const m = (entries: [string, string][]) => new Map(entries);

    it("replaces a mention pill with its user id", () => {
        expect(
            resolveMentionTokens("@dev 50", m([["@dev", "@dev:hs.tld"]])),
        ).toBe("@dev:hs.tld 50");
    });

    it("leaves text without pills unchanged (and tolerates an empty map)", () => {
        expect(resolveMentionTokens("@bob:hs.tld 50", m([]))).toBe(
            "@bob:hs.tld 50",
        );
        expect(
            resolveMentionTokens("plain text", m([["@dev", "@dev:hs.tld"]])),
        ).toBe("plain text");
    });

    it("does not match inside a longer token or a typed mxid", () => {
        const map = m([["@dev", "@dev:hs.tld"]]);
        expect(resolveMentionTokens("@devil", map)).toBe("@devil");
        expect(resolveMentionTokens("@dev:other.tld", map)).toBe(
            "@dev:other.tld",
        );
    });

    it("replaces a multi-word display-name pill as one token", () => {
        expect(
            resolveMentionTokens(
                "@Ann Example 100",
                m([["@Ann Example", "@ann:hs.tld"]]),
            ),
        ).toBe("@ann:hs.tld 100");
    });

    it("prefers the longest pill when one is a prefix of another", () => {
        const map = m([
            ["@Ann", "@a:hs.tld"],
            ["@Ann Example", "@ae:hs.tld"],
        ]);
        expect(resolveMentionTokens("@Ann Example", map)).toBe("@ae:hs.tld");
    });

    it("escapes regex metacharacters in display names", () => {
        expect(
            resolveMentionTokens("@a.b(c) 1", m([["@a.b(c)", "@abc:hs.tld"]])),
        ).toBe("@abc:hs.tld 1");
    });

    it("replaces multiple pills in one argument", () => {
        const map = m([
            ["@dev", "@dev:hs.tld"],
            ["@ops", "@ops:hs.tld"],
        ]);
        expect(resolveMentionTokens("@dev spam by @ops", map)).toBe(
            "@dev:hs.tld spam by @ops:hs.tld",
        );
    });
});

describe("admin command registry", () => {
    it("registers /nick, /op, /deop as action commands", () => {
        for (const name of ["nick", "op", "deop"]) {
            const cmd = SLASH_COMMANDS.find((c) => c.name === name);
            expect(cmd?.kind).toBe("action");
            expect(cmd?.requiresArg).toBe(true);
        }
    });
    it("matchSlashCommands('op') includes op", () => {
        expect(matchSlashCommands("op").map((c) => c.name)).toContain("op");
    });
    it("parseSlashCommand recognizes the new commands", () => {
        for (const name of ["nick", "op", "deop"]) {
            const r = parseSlashCommand(`/${name} x`);
            expect(r && "command" in r ? r.command.name : null).toBe(name);
        }
    });
});

import {
    pluginCommandToSlash,
    mergeSlashCommands,
    type SlashCommand,
} from "./slashCommands";
import type { PluginCommand } from "$lib/plugins/types";

describe("pluginCommandToSlash", () => {
    const base: PluginCommand = {
        name: "Greet",
        description: "Say hi",
        run: () => {},
    };

    it("lowercases the name and aliases so lookups match", () => {
        const s = pluginCommandToSlash(
            { ...base, aliases: ["Hi", "HELLO"] },
            "p.one",
        );
        expect(s.name).toBe("greet");
        expect(s.aliases).toEqual(["hi", "hello"]);
    });

    it("marks it as an action carrying pluginId + pluginRun, no requiresArg", () => {
        const s = pluginCommandToSlash(base, "p.one");
        expect(s.kind).toBe("action");
        expect(s.pluginId).toBe("p.one");
        expect(typeof s.pluginRun).toBe("function");
        expect(s.requiresArg).toBeFalsy();
    });

    it("defaults argKind to none (no hint) and derives a hint otherwise", () => {
        expect(pluginCommandToSlash(base, "p").argKind).toBe("none");
        expect(pluginCommandToSlash(base, "p").argHint).toBeUndefined();
        const withArg = pluginCommandToSlash({ ...base, argKind: "text" }, "p");
        expect(withArg.argKind).toBe("text");
        expect(withArg.argHint).toBe("<arg>");
    });
});

describe("pluginCommandToSlash — transform/emote commands", () => {
    it("emits a core-dispatched text-transform command (transform, no pluginRun)", () => {
        const s = pluginCommandToSlash(
            {
                name: "Shrug",
                description: "Append shrug",
                kind: "text-transform",
                argKind: "text",
                argHint: "[message]",
                transform: (a) => (a ? `${a} shrug` : "shrug"),
            },
            "zam.slash-fun",
        );
        expect(s.name).toBe("shrug");
        expect(s.kind).toBe("text-transform");
        expect(s.pluginId).toBe("zam.slash-fun");
        expect(s.pluginRun).toBeUndefined();
        expect(s.transform?.("hi")).toBe("hi shrug");
        expect(s.transform?.("")).toBe("shrug");
        expect(s.argHint).toBe("[message]");
        expect(s.argKind).toBe("text");
    });

    it("carries plain + requiresArg for a /plain-style command", () => {
        const s = pluginCommandToSlash(
            {
                name: "plain",
                description: "no markdown",
                kind: "text-transform",
                requiresArg: true,
                plain: true,
                transform: (a) => a,
            },
            "p",
        );
        expect(s.plain).toBe(true);
        expect(s.requiresArg).toBe(true);
        expect(s.pluginRun).toBeUndefined();
    });

    it("emits an emote command with no transform (body = arg)", () => {
        const s = pluginCommandToSlash(
            { name: "me", description: "action", kind: "emote", requiresArg: true },
            "p",
        );
        expect(s.kind).toBe("emote");
        expect(s.transform).toBeUndefined();
        expect(s.requiresArg).toBe(true);
        expect(s.pluginRun).toBeUndefined();
    });

    it("defaults transform-command argKind to text", () => {
        const s = pluginCommandToSlash(
            { name: "x", description: "d", kind: "text-transform", transform: (a) => a },
            "p",
        );
        expect(s.argKind).toBe("text");
    });
});

describe("mergeSlashCommands (core precedence)", () => {
    const plug = (name: string): SlashCommand =>
        pluginCommandToSlash({ name, description: "d", run: () => {} }, "p");

    it("appends plugin commands after core, in order", () => {
        const merged = mergeSlashCommands(
            [{ name: "me", description: "d", argKind: "text", kind: "emote" }],
            [plug("greet")],
        );
        expect(merged.map((c) => c.name)).toEqual(["me", "greet"]);
    });

    it("drops a plugin command whose name collides with a core name", () => {
        const merged = mergeSlashCommands(
            [
                {
                    name: "ban",
                    description: "d",
                    argKind: "user",
                    kind: "action",
                },
            ],
            [plug("ban")],
        );
        expect(merged.filter((c) => c.name === "ban").length).toBe(1);
        expect(merged[0].pluginRun).toBeUndefined(); // the core one survived
    });

    it("drops a plugin command whose name collides with a core alias", () => {
        const core: SlashCommand[] = [
            {
                name: "part",
                aliases: ["leave"],
                description: "d",
                argKind: "none",
                kind: "action",
            },
        ];
        const merged = mergeSlashCommands(core, [plug("leave")]);
        expect(merged.length).toBe(1);
    });

    it("keeps the first plugin when two plugins share a name", () => {
        const a = plug("dup");
        a.description = "first";
        const b = plug("dup");
        b.description = "second";
        const merged = mergeSlashCommands([], [a, b]);
        expect(merged.length).toBe(1);
        expect(merged[0].description).toBe("first");
    });
});

describe("matchSlashCommands with plugin extras", () => {
    const greet = pluginCommandToSlash(
        { name: "greet", aliases: ["hi"], description: "d", run: () => {} },
        "p",
    );

    it("includes a plugin command by name prefix", () => {
        expect(matchSlashCommands("gr", [greet]).map((c) => c.name)).toContain(
            "greet",
        );
    });

    it("includes a plugin command by alias prefix", () => {
        expect(matchSlashCommands("hi", [greet]).map((c) => c.name)).toContain(
            "greet",
        );
    });

    it("empty query returns core + plugin (plugin last)", () => {
        const all = matchSlashCommands("", [greet]);
        expect(all.length).toBe(SLASH_COMMANDS.length + 1);
        expect(all[all.length - 1].name).toBe("greet");
    });

    it("with no extras behaves exactly as before", () => {
        expect(matchSlashCommands("").length).toBe(SLASH_COMMANDS.length);
    });
});

describe("parseSlashCommand with plugin extras", () => {
    const greet = pluginCommandToSlash(
        { name: "greet", aliases: ["hi"], description: "d", run: () => {} },
        "p",
    );

    it("recognizes a plugin command and its argument", () => {
        const r = parseSlashCommand("/greet world", [greet]);
        expect(r && "command" in r ? r.command.name : null).toBe("greet");
        expect(r && "command" in r ? r.command.pluginRun : null).toBeTruthy();
        expect(r && "command" in r ? r.arg : null).toBe("world");
    });

    it("recognizes a plugin command by alias", () => {
        const r = parseSlashCommand("/hi", [greet]);
        expect(r && "command" in r ? r.command.name : null).toBe("greet");
    });

    it("a plugin cannot override a core command", () => {
        const evil = pluginCommandToSlash(
            { name: "ban", description: "evil", run: () => {} },
            "evil",
        );
        const r = parseSlashCommand("/ban @x:hs", [evil]);
        expect(r && "command" in r ? r.command.pluginRun : "x").toBeUndefined();
    });

    it("still flags a genuinely unknown command", () => {
        expect(parseSlashCommand("/nope", [greet])).toEqual({
            unknown: "nope",
        });
    });
});
