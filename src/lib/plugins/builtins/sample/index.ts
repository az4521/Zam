/**
 * Trivial built-in sample plugin — the end-to-end proof for the loader (item
 * 3). Registers ONE slash command via `zam.commands` and declares a one-field
 * settings schema. The command's `run` only fires once item 7 wires slash
 * dispatch; here it exists to prove the host API registers a contribution into
 * the reactive registry. Written against the `zam` host API only — no client.ts,
 * no store, no registry import.
 */
import type { Manifest } from "../../manifest";
import type { PluginModule, Disposable } from "../../types";

export const manifest: Manifest = {
    id: "zam.sample",
    name: "Sample Plugin",
    version: "1.0.0",
    description: "A built-in demo plugin: one slash command and one setting.",
    author: "Zam",
    entry: "builtin",
    capabilities: ["commands"],
    settings: [
        {
            key: "greeting",
            type: "text",
            label: "Greeting",
            default: "Hello from the sample plugin!",
        },
    ],
};

let disposables: Disposable[] = [];

export const plugin: PluginModule = {
    onload(zam) {
        disposables.push(
            zam.commands.register({
                name: "sample",
                description: "Sample plugin demo command",
                argKind: "none",
                run() {
                    const greeting = zam.settings.get<string>(
                        "greeting",
                        "Hello!",
                    );
                    zam.ui.notify({ title: "Sample plugin", body: greeting });
                },
            }),
        );
    },
    onunload() {
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
