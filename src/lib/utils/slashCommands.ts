/**
 * Pure slash-command parsing + registry. No SDK or Svelte imports — the
 * component (MessageInput) owns dispatch and the live autocomplete popup; this
 * module only recognises commands and carries their metadata + pure text
 * transforms, so it can be unit-tested in isolation.
 */

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
];

function findCommand(name: string): SlashCommand | undefined {
    const lower = name.toLowerCase();
    return SLASH_COMMANDS.find(
        (c) =>
            c.name === lower || (c.aliases ?? []).some((a) => a === lower),
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
): ParsedCommand | { unknown: string } | null {
    const start = text.replace(/^\s+/, "");
    if (!start.startsWith("/")) return null;
    if (start.startsWith("//")) return null; // escape for a literal leading slash
    const m = start.match(/^\/(\w+)([\s\S]*)$/);
    if (!m) return null; // bare "/" or "/@#!"
    const name = m[1].toLowerCase();
    const arg = m[2].trim();
    const command = findCommand(name);
    if (!command) return { unknown: name };
    return { command, arg };
}

/**
 * Candidates for the autocomplete popup. A leading slash in the query is
 * tolerated. Empty query returns the whole registry (in order).
 */
export function matchSlashCommands(query: string): SlashCommand[] {
    const q = query.replace(/^\//, "").toLowerCase();
    if (q === "") return [...SLASH_COMMANDS];
    return SLASH_COMMANDS.filter(
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
