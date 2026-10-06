// Built-in "link preview rewriter" plugin. Applies the user's string/regex
// substitutions to the URL a link preview is REQUESTED for, via
// zam.messages.transformPreviewUrl, so a site the homeserver cannot fetch can
// be previewed through a mirror (oginstagram.com → instagram.crafty.moe). The
// message, and the link it shows and opens, are untouched. With no rules it is
// a no-op. Same rule engine as the text replacer.
import { t } from "$lib/i18n";
import type { Manifest } from "../../manifest";
import type { PluginModule, Disposable } from "../../types";
import {
    applyReplacements,
    type ReplaceRule,
} from "../text-replacer/textReplace";

export const manifest: Manifest = {
    id: "zam.preview-rewriter",
    name: t("previewRewriter.name"),
    version: "1.0.0",
    description: t("previewRewriter.description"),
    author: "Zam",
    entry: "builtin",
    capabilities: ["messages:read"],
    settings: [
        {
            key: "rules",
            type: "list",
            label: t("previewRewriter.rules"),
            description: t("previewRewriter.rulesDescription"),
            default: [],
            fields: [
                {
                    key: "match",
                    type: "text",
                    label: t("textReplacer.find"),
                    placeholder: "oginstagram.com",
                },
                {
                    key: "replacement",
                    type: "text",
                    label: t("textReplacer.replaceWith"),
                    placeholder: "instagram.example.org",
                },
                {
                    key: "isRegex",
                    type: "toggle",
                    label: t("textReplacer.regex"),
                    default: false,
                },
                {
                    key: "caseInsensitive",
                    type: "toggle",
                    label: t("textReplacer.ignoreCase"),
                    default: true,
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
            zam.messages.transformPreviewUrl((url) =>
                applyReplacements(
                    url,
                    zam.settings.get<ReplaceRule[]>("rules", []),
                ),
            ),
        );
    },
    onunload() {
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
