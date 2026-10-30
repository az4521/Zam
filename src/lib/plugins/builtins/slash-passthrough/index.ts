// Built-in "bot commands" plugin: teaches the slash-command popup the names of
// commands that belong to a BOT on the other side (Hermes, a bridge, any
// command-driven bot), so they complete and show a description like a native
// command, while the message that actually goes out is the plain text
// "/name args".
//
// This is the missing half of the pass-through behaviour in MessageInput: an
// unknown "/cmd" is already sent as text, but nothing suggests it beforehand.
// Matrix has no command-discovery API, so the list is a setting (name +
// optional description), seeded with the common Hermes commands.
//
// Text-transform commands go through the SAME core send path as a native
// command (markdown, mentions, thread targeting), so nothing about the sent
// event is special: a client without this plugin sees ordinary m.text.
import { t } from "$lib/i18n";
import type { Manifest } from "../../manifest";
import type {
    PluginModule,
    PluginTransformCommand,
    Disposable,
} from "../../types";

/** Name/description pair as stored in settings. */
export interface BotCommandEntry {
    name: string;
    description?: string;
}

/** Seeds the popup with the commands Hermes answers to. Editable by the user;
 *  a command ZAM already implements always wins over an entry here. */
export const DEFAULT_BOT_COMMANDS: BotCommandEntry[] = [
    { name: "model" },
    { name: "new" },
    { name: "status" },
    { name: "help" },
    { name: "resume" },
    { name: "stop" },
    { name: "usage" },
    { name: "context" },
    { name: "memory" },
    { name: "skills" },
    { name: "agents" },
    { name: "title" },
];

/** Normalise one settings entry into a command, or null when unusable. */
export function toPassthroughCommand(
    entry: BotCommandEntry,
): PluginTransformCommand | null {
    const name = (entry?.name ?? "").trim().replace(/^\/+/, "").toLowerCase();
    // The parser matches /^\/(\w+)/, so anything else could never be typed.
    if (!/^\w+$/.test(name)) return null;
    const description =
        (entry.description ?? "").trim() ||
        t("slashPassthrough.sendToTheBot", { command: `/${name}` });
    return {
        name,
        description,
        kind: "text-transform",
        argKind: "text",
        argHint: t("slashPassthrough.optionalArguments"),
        transform: (arg: string) => (arg ? `/${name} ${arg}` : `/${name}`),
    };
}

/** Every usable command from the settings value, first occurrence winning. */
export function passthroughCommands(
    entries: BotCommandEntry[] | undefined,
): PluginTransformCommand[] {
    const seen = new Set<string>();
    const out: PluginTransformCommand[] = [];
    for (const entry of entries ?? []) {
        const cmd = toPassthroughCommand(entry);
        if (!cmd || seen.has(cmd.name)) continue;
        seen.add(cmd.name);
        out.push(cmd);
    }
    return out;
}

export const manifest: Manifest = {
    id: "zam.slash-passthrough",
    name: t("slashPassthrough.botCommands"),
    version: "1.0.0",
    description: t("slashPassthrough.suggestBotCommandsInTheSlashPopup"),
    author: "Zam",
    entry: "builtin",
    capabilities: ["commands"],
    settings: [
        {
            key: "commands",
            type: "list",
            label: t("slashPassthrough.commands"),
            description: t("slashPassthrough.commandsDescription"),
            default: DEFAULT_BOT_COMMANDS as unknown as Record<
                string,
                unknown
            >[],
            fields: [
                {
                    key: "name",
                    type: "text",
                    label: t("slashPassthrough.command"),
                    placeholder: "model",
                },
                {
                    key: "description",
                    type: "text",
                    label: t("slashPassthrough.description"),
                    placeholder: t("slashPassthrough.optional"),
                },
            ],
        },
    ],
};

let commandDisposables: Disposable[] = [];
let subscription: Disposable | null = null;

export const plugin: PluginModule = {
    onload(zam) {
        zam.settings.define(manifest.settings!);
        // `values` is the coerced payload of a settings change; without it (the
        // initial registration) the stored value is read back.
        const registerAll = (values?: Record<string, unknown>): void => {
            for (const d of commandDisposables) d.dispose();
            commandDisposables = [];
            const entries =
                (values?.commands as BotCommandEntry[] | undefined) ??
                zam.settings.get<BotCommandEntry[]>(
                    "commands",
                    DEFAULT_BOT_COMMANDS,
                );
            for (const cmd of passthroughCommands(entries)) {
                commandDisposables.push(zam.commands.register(cmd));
            }
        };
        registerAll();
        // Editing the list re-registers in place, so the popup reflects it
        // without a reload.
        subscription = zam.settings.onChange(registerAll);
    },
    onunload() {
        for (const d of commandDisposables) d.dispose();
        commandDisposables = [];
        subscription?.dispose();
        subscription = null;
    },
};
