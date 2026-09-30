/**
 * Built-in "fun slash commands" plugin (item 13 migration). Moves the novelty
 * text-transform / emote commands out of core `SLASH_COMMANDS` into a plugin
 * registered via `zam.commands`. They are the transform/emote command flavor
 * (PluginTransformCommand), so MessageInput dispatches them through the SAME
 * core send path — markdown, mentions, thread targeting, reply-clear, /plain
 * bypass and m.emote are all preserved. Interop-safe: produces standard
 * m.text / m.emote. Written against the `zam` host API only — no client.ts.
 */
import { t } from "$lib/i18n";
import type { Manifest } from "../../manifest";
import type {
    PluginModule,
    PluginTransformCommand,
    Disposable,
} from "../../types";

const SHRUG = "¯\\_(ツ)_/¯";
const TABLEFLIP = "(╯°□°)╯︵ ┻━┻";
const UNFLIP = "┬─┬ ノ( ゜-゜ノ)";
const LENNY = "( ͡° ͜ʖ ͡°)";

/** Append an emoticon to an optional message ("meh" + art, or just art). */
function withArt(art: string): (arg: string) => string {
    return (arg) => (arg ? `${arg} ${art}` : art);
}

/** The 7 fun commands — the source of truth for their transforms + metadata.
 *  Exported so the migration's parity tests assert them directly. */
export const FUN_COMMANDS: PluginTransformCommand[] = [
    {
        name: "me",
        description: t("slashFun.sendAnActionMessage"),
        kind: "emote",
        argKind: "text",
        argHint: "<message>",
        requiresArg: true,
    },
    {
        name: "shrug",
        description: t("slashFun.appendToYourMessage"),
        kind: "text-transform",
        argKind: "text",
        argHint: "[message]",
        transform: withArt(SHRUG),
    },
    {
        name: "tableflip",
        description: t("slashFun.appendToYourMessage2"),
        kind: "text-transform",
        argKind: "text",
        argHint: "[message]",
        transform: withArt(TABLEFLIP),
    },
    {
        name: "unflip",
        description: t("slashFun.appendToYourMessage3"),
        kind: "text-transform",
        argKind: "text",
        argHint: "[message]",
        transform: withArt(UNFLIP),
    },
    {
        name: "lenny",
        description: t("slashFun.appendToYourMessage4"),
        kind: "text-transform",
        argKind: "text",
        argHint: "[message]",
        transform: withArt(LENNY),
    },
    {
        name: "spoiler",
        description: t("slashFun.sendYourMessageAsASpoiler"),
        kind: "text-transform",
        argKind: "text",
        argHint: "<message>",
        requiresArg: true,
        transform: (arg) => `||${arg}||`,
    },
    {
        name: "plain",
        description: t("slashFun.sendYourMessageWithoutMarkdownFormatting"),
        kind: "text-transform",
        argKind: "text",
        argHint: "<message>",
        requiresArg: true,
        plain: true,
        transform: (arg) => arg,
    },
];

export const manifest: Manifest = {
    id: "zam.slash-fun",
    name: t("slashFun.funSlashCommands"),
    version: "1.0.0",
    description: t("slashFun.noveltySlashCommandsMeShrugTableflip"),
    author: "Zam",
    entry: "builtin",
    capabilities: ["commands"],
};

let disposables: Disposable[] = [];

export const plugin: PluginModule = {
    onload(zam) {
        for (const cmd of FUN_COMMANDS) {
            disposables.push(zam.commands.register(cmd));
        }
    },
    onunload() {
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
