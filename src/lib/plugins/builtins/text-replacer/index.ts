// Built-in "text replacer" plugin (item 17, NEW — not a migration). Applies the
// user's configured string/regex substitutions to their OUTGOING message text at
// send time via zam.messages.transformOutgoing. Interop-safe: the sent text stays
// standard m.text; with no rules (or disabled) it is a pure no-op, so a recipient
// without the plugin is unaffected. Written against the `zam` host API only — no
// client.ts. Replacement logic is the pure, TDD'd applyReplacements engine.
import type { Manifest } from "../../manifest";
import type { PluginModule, Disposable } from "../../types";
import { applyReplacements, type ReplaceRule } from "./textReplace";

export const manifest: Manifest = {
    id: "zam.text-replacer",
    name: "Text replacer",
    version: "1.0.0",
    description:
        "Apply your own string or regex substitutions to outgoing message text.",
    author: "Zam",
    entry: "builtin",
    capabilities: ["messages:send"],
    settings: [
        {
            key: "rules",
            type: "list",
            label: "Replacement rules",
            description:
                "Applied to your outgoing message text in order. Recipients see standard text.",
            default: [],
            fields: [
                {
                    key: "match",
                    type: "text",
                    label: "Find",
                    placeholder: "text or pattern",
                },
                { key: "replacement", type: "text", label: "Replace with" },
                {
                    key: "isRegex",
                    type: "toggle",
                    label: "Regex",
                    default: false,
                },
                {
                    key: "caseInsensitive",
                    type: "toggle",
                    label: "Ignore case",
                    default: false,
                },
            ],
        },
    ],
};

let disposables: Disposable[] = [];

export const plugin: PluginModule = {
    onload(zam) {
        zam.settings.define(manifest.settings!);
        disposables.push(
            zam.messages.transformOutgoing((text) => {
                const rules = zam.settings.get<ReplaceRule[]>("rules", []);
                return applyReplacements(text, rules);
            }),
        );
    },
    onunload() {
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
