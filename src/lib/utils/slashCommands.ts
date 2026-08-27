/**
 * Pure slash-command parsing + registry. No SDK or Svelte imports — the
 * component (MessageInput) owns dispatch and the live autocomplete popup; this
 * module only recognises commands and carries their metadata + pure text
 * transforms, so it can be unit-tested in isolation.
 */

import type { PluginCommand } from "$lib/plugins/types";

export type CommandArgKind = "none" | "text" | "user" | "roomAlias";

/** How MessageInput dispatches a matched command. */
export type CommandKind = "emote" | "text-transform" | "action" | "dialog";

export interface SlashCommand {
    /** Canonical name without the leading slash, e.g. "me". */
    name: string;
    /** Alternate names (also without slash), e.g. "leave" for "part". */
    aliases?: string[];
    description: string;
    /** Shown muted in the popup, e.g. "<@user:server>". */
    argHint?: string;
    argKind: CommandArgKind;
    kind: CommandKind;
    /** A missing argument is a usage error (vs merely producing an empty msg). */
    requiresArg?: boolean;
    /**
     * text-transform only: rewrite the argument into the message body that then
     * flows down the normal (markdown) send path. Pure.
     */
    transform?: (arg: string) => string;
    /** text-transform only: send verbatim, bypassing markdown/formatting. */
    plain?: boolean;
    /** plugin commands only: the id of the plugin that registered this command
     *  (dispatch routing + error attribution). Absent on core commands. */
    pluginId?: string;
    /** plugin commands only: the handler MessageInput calls instead of the core
     *  dispatch switch. Its presence marks a command as plugin-provided. */
    pluginRun?: (ctx: { roomId: string; arg: string }) => void | Promise<void>;
}

const SHRUG = "¯\\_(ツ)_/¯";
const TABLEFLIP = "(╯°□°)╯︵ ┻━┻";
const UNFLIP = "┬─┬ ノ( ゜-゜ノ)";
const LENNY = "( ͡° ͜ʖ ͡°)";

/** Append an emoticon to an optional message ("meh" + art, or just art). */
function withArt(art: string): (arg: string) => string {
    return (arg) => (arg ? `${arg} ${art}` : art);
}

/**
 * The command registry. Order is the popup order. Only commands that map to
 * existing, tested client.ts wrappers (or pure transforms) are here; dialog
 * commands (/poll, /location) register themselves when those features land.
 */
export const SLASH_COMMANDS: SlashCommand[] = [
    {
        name: "me",
        description: "Send an action message",
        argHint: "<message>",
        argKind: "text",
        kind: "emote",
        requiresArg: true,
    },
    {
        name: "shrug",
        description: "Append ¯\\_(ツ)_/¯ to your message",
        argHint: "[message]",
        argKind: "text",
        kind: "text-transform",
        transform: withArt(SHRUG),
    },
    {
        name: "tableflip",
        description: "Append (╯°□°)╯︵ ┻━┻ to your message",
        argHint: "[message]",
        argKind: "text",
        kind: "text-transform",
        transform: withArt(TABLEFLIP),
    },
    {
        name: "unflip",
        description: "Append ┬─┬ ノ( ゜-゜ノ) to your message",
        argHint: "[message]",
        argKind: "text",
        kind: "text-transform",
        transform: withArt(UNFLIP),
    },
    {
        name: "lenny",
        description: "Append ( ͡° ͜ʖ ͡°) to your message",
        argHint: "[message]",
        argKind: "text",
        kind: "text-transform",
        transform: withArt(LENNY),
    },
    {
        name: "spoiler",
        description: "Send your message as a spoiler",
        argHint: "<message>",
        argKind: "text",
        kind: "text-transform",
        requiresArg: true,
        transform: (arg) => `||${arg}||`,
    },
    {
        name: "plain",
        description: "Send your message without markdown formatting",
        argHint: "<message>",
        argKind: "text",
        kind: "text-transform",
        requiresArg: true,
        transform: (arg) => arg,
        plain: true,
    },
    {
        name: "poll",
        description: "Create a poll",
        argKind: "none",
        kind: "dialog",
    },
    {
        name: "location",
        description: "Share your location",
        argKind: "none",
        kind: "dialog",
    },
    {
        name: "join",
        description: "Join a room by address",
        argHint: "<#room:server>",
        argKind: "roomAlias",
        kind: "action",
        requiresArg: true,
    },
    {
        name: "part",
        aliases: ["leave"],
        description: "Leave the current room",
        argKind: "none",
        kind: "action",
    },
    {
        name: "invite",
        description: "Invite a user to this room",
        argHint: "<@user:server>",
        argKind: "user",
        kind: "action",
        requiresArg: true,
    },
    {
        name: "topic",
        description: "Set the room topic",
        argHint: "<text>",
        argKind: "text",
        kind: "action",
        requiresArg: true,
    },
    {
        name: "kick",
        description: "Remove a user from this room",
        argHint: "<@user:server> [reason]",
        argKind: "user",
        kind: "action",
        requiresArg: true,
    },
    {
        name: "ban",
        description: "Ban a user from this room",
        argHint: "<@user:server> [reason]",
        argKind: "user",
        kind: "action",
        requiresArg: true,
    },
    {
        name: "nick",
        description: "Set your display name",
        argHint: "<display name>",
        argKind: "text",
        kind: "action",
        requiresArg: true,
    },
    {
        name: "op",
        description: "Set a user's power level",
        argHint: "<@user:server> [level]",
        argKind: "user",
        kind: "action",
        requiresArg: true,
    },
    {
        name: "deop",
        description: "Reset a user's power level to default",
        argHint: "<@user:server>",
        argKind: "user",
        kind: "action",
        requiresArg: true,
    },
];

/** Adapt a plugin's command into a `SlashCommand` the pure matchers + the
 *  MessageInput dispatch understand. Names/aliases are lowercased (findCommand
 *  lowercases lookups). Plugin commands are either action-flavor (carry
 *  `pluginRun`) or transform/emote-flavor (core-dispatched, no `pluginRun`). */
export function pluginCommandToSlash(
    cmd: PluginCommand,
    pluginId: string,
): SlashCommand {
    // Transform/emote flavor → core-dispatched (no pluginRun). Flows through
    // MessageInput's emote/text-transform branch exactly like a built-in
    // command, so markdown / mentions / thread / reply-clear are preserved.
    if ("kind" in cmd) {
        return {
            name: cmd.name.toLowerCase(),
            aliases: cmd.aliases?.map((a) => a.toLowerCase()),
            description: cmd.description,
            argKind: cmd.argKind ?? "text",
            argHint: cmd.argHint,
            kind: cmd.kind,
            transform: cmd.transform,
            plain: cmd.plain,
            requiresArg: cmd.requiresArg,
            pluginId,
        };
    }
    // Action flavor (existing behavior) — dispatched via pluginRun.
    const argKind = cmd.argKind ?? "none";
    return {
        name: cmd.name.toLowerCase(),
        aliases: cmd.aliases?.map((a) => a.toLowerCase()),
        description: cmd.description,
        argKind,
        argHint: argKind === "none" ? undefined : "<arg>",
        kind: "action",
        pluginId,
        pluginRun: cmd.run,
    };
}

/** Merge core commands with plugin `extra`, core-precedence. A plugin command
 *  whose name collides with a core name/alias (or an earlier plugin's name) is
 *  dropped — a plugin can never shadow `/ban`, `/poll`, etc. */
export function mergeSlashCommands(
    core: SlashCommand[],
    extra: SlashCommand[],
): SlashCommand[] {
    const taken = new Set<string>();
    for (const c of core) {
        taken.add(c.name);
        for (const a of c.aliases ?? []) taken.add(a);
    }
    const merged = [...core];
    for (const e of extra) {
        if (taken.has(e.name)) continue;
        taken.add(e.name);
        for (const a of e.aliases ?? []) taken.add(a);
        merged.push(e);
    }
    return merged;
}

function findCommand(
    name: string,
    extra: SlashCommand[] = [],
): SlashCommand | undefined {
    const lower = name.toLowerCase();
    return mergeSlashCommands(SLASH_COMMANDS, extra).find(
        (c) => c.name === lower || (c.aliases ?? []).some((a) => a === lower),
    );
}

export type ParsedCommand = { command: SlashCommand; arg: string };

/**
 * Recognise a command line. Returns:
 * - `null` when the text is not a command (plain text, blank, mid-message
 *   slash, or a `//`-escaped literal slash);
 * - `{ unknown }` when it starts with `/word` but no command matches;
 * - `{ command, arg }` when it matches (arg trimmed; internal newlines kept).
 */
export function parseSlashCommand(
    text: string,
    extra: SlashCommand[] = [],
): ParsedCommand | { unknown: string } | null {
    const start = text.replace(/^\s+/, "");
    if (!start.startsWith("/")) return null;
    if (start.startsWith("//")) return null; // escape for a literal leading slash
    const m = start.match(/^\/(\w+)([\s\S]*)$/);
    if (!m) return null; // bare "/" or "/@#!"
    const name = m[1].toLowerCase();
    const arg = m[2].trim();
    const command = findCommand(name, extra);
    if (!command) return { unknown: name };
    return { command, arg };
}

/**
 * Candidates for the autocomplete popup. A leading slash in the query is
 * tolerated. Empty query returns the whole registry (in order).
 */
export function matchSlashCommands(
    query: string,
    extra: SlashCommand[] = [],
): SlashCommand[] {
    const all = mergeSlashCommands(SLASH_COMMANDS, extra);
    const q = query.replace(/^\//, "").toLowerCase();
    if (q === "") return [...all];
    return all.filter(
        (c) =>
            c.name.startsWith(q) ||
            (c.aliases ?? []).some((a) => a.startsWith(q)),
    );
}

/** Usage string for a command that was invoked without its required argument. */
export function usageFor(command: SlashCommand): string {
    return command.argHint
        ? `Usage: /${command.name} ${command.argHint}`
        : `Usage: /${command.name}`;
}

/**
 * Replace composer mention pills (display-name tokens like "@Alice") in a
 * user-arg command line with the Matrix IDs they were inserted for. Longest
 * pill first so "@Ann Example" isn't shadowed by "@Ann"; the lookahead keeps
 * a pill from matching inside a longer token or an already-substituted mxid
 * (same boundary rule as the composer's formatted-body mention pass).
 */
export function resolveMentionTokens(
    arg: string,
    mentions: ReadonlyMap<string, string>,
): string {
    let out = arg;
    const entries = [...mentions].sort((a, b) => b[0].length - a[0].length);
    for (const [token, userId] of entries) {
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`${escaped}(?![\\w:.-])`, "g"), userId);
    }
    return out;
}

/** Default power level `/op` grants when no explicit level is given (Moderator). */
export const DEFAULT_OP_LEVEL = 50;

export type NickArg = { name: string } | { error: string };
export type OpArg = { user: string; level: number } | { error: string };
export type DeopArg = { user: string } | { error: string };

/** Parse `/nick <display name>`. Internal spaces are preserved. */
export function parseNickArg(arg: string): NickArg {
    const name = arg.trim();
    if (!name) return { error: "/nick: a display name is required" };
    return { name };
}

/** Parse `/op <user> [level]`. Level defaults to DEFAULT_OP_LEVEL; must be a
 *  non-negative integer when given. User tokens never contain whitespace. */
export function parseOpArg(arg: string): OpArg {
    const parts = arg.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { error: "/op: a user is required" };
    if (parts.length === 1) return { user: parts[0], level: DEFAULT_OP_LEVEL };
    if (parts.length === 2) {
        if (!/^\d+$/.test(parts[1]))
            return { error: "/op: level must be a whole number" };
        return { user: parts[0], level: Number(parts[1]) };
    }
    return { error: "/op: too many arguments" };
}

/** Parse `/deop <user>`. */
export function parseDeopArg(arg: string): DeopArg {
    const parts = arg.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { error: "/deop: a user is required" };
    if (parts.length > 1) return { error: "/deop: too many arguments" };
    return { user: parts[0] };
}
