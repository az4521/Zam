import { describe, it, expect, vi } from "vitest";
import type { PluginCommand } from "../../types";
import { pluginCommandToSlash } from "$lib/utils/slashCommands";
import {
    DEFAULT_BOT_COMMANDS,
    manifest,
    passthroughCommands,
    plugin,
    toPassthroughCommand,
} from "./index";

function transformOf(name: string, entries = DEFAULT_BOT_COMMANDS) {
    const cmd = passthroughCommands(entries).find((c) => c.name === name);
    if (!cmd) throw new Error(`no passthrough command ${name}`);
    return cmd.transform!;
}

describe("slash-passthrough manifest", () => {
    it("declares the built-in id, commands capability and one settings list", () => {
        expect(manifest.id).toBe("zam.slash-passthrough");
        expect(manifest.entry).toBe("builtin");
        expect(manifest.capabilities).toContain("commands");
        expect(manifest.settings?.[0].key).toBe("commands");
        expect(manifest.settings?.[0].type).toBe("list");
    });
});

describe("toPassthroughCommand", () => {
    it("sends the typed command as plain text, with and without arguments", () => {
        const cmd = toPassthroughCommand({ name: "model" })!;
        expect(cmd.kind).toBe("text-transform");
        expect(cmd.transform!("")).toBe("/model");
        expect(cmd.transform!("deepseek-v4.1 --global")).toBe(
            "/model deepseek-v4.1 --global",
        );
    });

    it("normalises a leading slash and upper case", () => {
        expect(toPassthroughCommand({ name: " /Model " })!.name).toBe("model");
    });

    it("rejects names the parser could never match", () => {
        for (const name of ["", "   ", "two words", "with-dash", "/", "a/b"])
            expect(toPassthroughCommand({ name })).toBeNull();
    });

    it("falls back to a generated description and keeps a custom one", () => {
        expect(toPassthroughCommand({ name: "model" })!.description).toContain(
            "/model",
        );
        expect(
            toPassthroughCommand({ name: "model", description: "切替" })!
                .description,
        ).toBe("切替");
    });
});

describe("passthroughCommands", () => {
    it("keeps the seeded Hermes commands", () => {
        const names = passthroughCommands(DEFAULT_BOT_COMMANDS).map(
            (c) => c.name,
        );
        expect(names).toContain("model");
        expect(names).toContain("new");
        expect(names).toContain("status");
    });

    it("drops duplicates and unusable entries", () => {
        const names = passthroughCommands([
            { name: "model" },
            { name: "MODEL" },
            { name: "bad name" },
            { name: "new" },
        ]).map((c) => c.name);
        expect(names).toEqual(["model", "new"]);
    });

    it("is empty for an empty list", () => {
        expect(passthroughCommands([])).toEqual([]);
        expect(passthroughCommands(undefined)).toEqual([]);
    });
});

describe("plugin registration", () => {
    function fakeZam(initial: { name: string; description?: string }[]) {
        const registered: PluginCommand[] = [];
        let onChange: ((values: Record<string, unknown>) => void) | undefined;
        return {
            registered,
            fireChange: (commands: { name: string }[]) =>
                onChange?.({ commands }),
            zam: {
                app: { version: "test" },
                plugin: { id: manifest.id, manifest },
                commands: {
                    register: (cmd: PluginCommand) => {
                        registered.push(cmd);
                        return { dispose: () => {} };
                    },
                },
                settings: {
                    define: () => {},
                    get: <T>(_k: string, fallback?: T) =>
                        (initial ?? fallback) as unknown as T,
                    onChange: (
                        handler: (v: Record<string, unknown>) => void,
                    ) => {
                        onChange = handler;
                        return { dispose: () => {} };
                    },
                },
            } as never,
        };
    }

    it("registers one command per configured entry", () => {
        const { zam, registered } = fakeZam([
            { name: "model" },
            { name: "new" },
        ]);
        plugin.onload(zam);
        expect(registered.map((c) => c.name)).toEqual(["model", "new"]);
        plugin.onunload?.();
    });

    it("re-registers when the list changes", () => {
        const { zam, registered, fireChange } = fakeZam([{ name: "model" }]);
        plugin.onload(zam);
        expect(registered).toHaveLength(1);
        fireChange([{ name: "usage" }, { name: "skills" }]);
        expect(registered.map((c) => c.name)).toEqual([
            "model",
            "usage",
            "skills",
        ]);
        plugin.onunload?.();
    });
});

describe("popup integration", () => {
    // MessageInput adapts plugin commands with this before parsing.
    const asSlash = (entries = DEFAULT_BOT_COMMANDS) =>
        passthroughCommands(entries).map((c) =>
            pluginCommandToSlash(c, "zam.slash-passthrough"),
        );

    it("a seeded command resolves through the core parser", async () => {
        const { parseSlashCommand } = await import("$lib/utils/slashCommands");
        const parsed = parseSlashCommand("/model deepseek-v4.1", asSlash());
        expect(parsed && "command" in parsed).toBe(true);
        if (parsed && "command" in parsed) {
            expect(parsed.command.name).toBe("model");
            expect(parsed.arg).toBe("deepseek-v4.1");
        }
    });

    it("never shadows a command ZAM implements itself", async () => {
        const { parseSlashCommand } = await import("$lib/utils/slashCommands");
        const parsed = parseSlashCommand(
            "/topic hello",
            asSlash([{ name: "topic" }]),
        );
        expect(parsed && "command" in parsed).toBe(true);
        // The core /topic (room topic dialog) wins over the passthrough entry.
        if (parsed && "command" in parsed)
            expect(parsed.command.kind).toBe("action");
    });
});
