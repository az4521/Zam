// src/lib/plugins/builtins/example/index.ts
/**
 * zam.example — the canonical template plugin. Copy this directory to build
 * your own plugin. It exercises the THREE most common hooks together:
 *   1. a slash command (text-transform flavor → interop-safe, routes through
 *      the same core send path as a built-in command),
 *   2. a custom embed (an ADDITIVE nicer card for a matching URL — never
 *      replaces inbound rendering; host-sanitized via ctx.html),
 *   3. a settings schema (a text field + a toggle) that DRIVES both hooks,
 *      read fresh on every invocation so changes apply without a reload.
 *
 * Boundary: a plugin talks ONLY to the `zam` host API. It never imports
 * client.ts / matrix-js-sdk / localStorage / stores. Sanitizing embed HTML is
 * the host's job (ctx.html) — the plugin just supplies escaped, allowlist-safe
 * markup via the pure ./example helpers.
 *
 * To publish this as a GitHub repo plugin instead of a built-in (spec §4):
 *   - Pre-bundle this module to a single-file ESM `main.js` with a default
 *     export `{ onload, onunload }`.
 *   - Ship `plugins/zam.example/manifest.json` (this manifest, with
 *     `entry: "main.js"`) and `plugins/zam.example/main.js`.
 *   - Add an entry to the repo's root `index.json`:
 *       { "schema": 1, "plugins": [
 *           { "id": "zam.example", "name": "Example Plugin",
 *             "version": "1.0.0", "description": "...", "author": "Zam",
 *             "path": "plugins/zam.example" } ] }
 *   - Users install it via Settings → Plugins → add repo `owner/repo`.
 */
import type { Manifest } from "../../manifest";
import type { Disposable, PluginModule } from "../../types";
import { buildExampleEmbedHtml, formatExampleMessage } from "./example";

// Fallback constants mirror the schema defaults below, so a settings.get that
// runs before the user ever opens the form still returns sane values.
const DEFAULT_GREETING = "gg";
const DEFAULT_EMBED_TITLE = "Example embed";

export const manifest: Manifest = {
    id: "zam.example",
    name: "Example Plugin",
    version: "1.0.0",
    description:
        "A minimal, commented template: a slash command, a custom embed, and settings. Copy this to build your own plugin.",
    author: "Zam",
    entry: "builtin",
    capabilities: ["commands", "messages:read", "ui"],
    settings: [
        {
            key: "greeting",
            type: "text",
            label: "Greeting prefix",
            description: "Prepended to /example messages.",
            default: DEFAULT_GREETING,
        },
        {
            key: "embedTitle",
            type: "text",
            label: "Embed title",
            description: "Shown as the heading of the example.dev embed card.",
            default: DEFAULT_EMBED_TITLE,
        },
        {
            key: "showHost",
            type: "toggle",
            label: "Show host in embed",
            description: "Include the link's hostname in the embed card.",
            default: true,
        },
    ],
};

let disposables: Disposable[] = [];

export const plugin: PluginModule = {
    onload(zam) {
        // Seed + validate the schema so zam.settings.get returns coerced
        // defaults before the user ever opens the settings form.
        zam.settings.define(manifest.settings!);

        // (1) Slash command — text-transform flavor. The pure core lives in
        // ./example; the closure only reads the greeting setting (never
        // throws). Routing through the core send path keeps markdown/mentions/
        // thread-targeting intact and the sent event a standard m.text.
        disposables.push(
            zam.commands.register({
                name: "example",
                description:
                    "Send a message prefixed with your configured greeting",
                kind: "text-transform",
                argKind: "text",
                argHint: "[message]",
                transform: (arg) =>
                    formatExampleMessage(
                        zam.settings.get<string>("greeting", DEFAULT_GREETING),
                        arg,
                    ),
            }),
        );

        // (2) Custom embed — ADDITIVE. Matches a distinct demo host (example.dev,
        // not the sample plugin's example.com/.org/.net). No match → the normal
        // link preview still renders. Host-sanitizes via ctx.html.
        disposables.push(
            zam.messages.registerEmbed({
                match(url) {
                    try {
                        const h = new URL(url).hostname.replace(/^www\./, "");
                        return h === "example.dev";
                    } catch {
                        return false;
                    }
                },
                render(_el, ctx) {
                    ctx.html(
                        buildExampleEmbedHtml(ctx.url, {
                            title: zam.settings.get<string>(
                                "embedTitle",
                                DEFAULT_EMBED_TITLE,
                            ),
                            showHost: zam.settings.get<boolean>(
                                "showHost",
                                true,
                            ),
                        }),
                    );
                },
            }),
        );
    },
    onunload() {
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
