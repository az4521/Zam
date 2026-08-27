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
    capabilities: ["commands", "composer", "ui", "messages:read"],
    settings: [
        {
            key: "greeting",
            type: "text",
            label: "Greeting",
            default: "Hello from the sample plugin!",
        },
        {
            key: "phrases",
            type: "list",
            label: "Extra phrases",
            description: "Repeatable rows to exercise the list field type.",
            fields: [
                { key: "text", type: "text", label: "Phrase" },
                { key: "loud", type: "toggle", label: "Loud", default: false },
            ],
            default: [],
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

        disposables.push(
            zam.composer.addButton({
                id: "sample-popover",
                label: "Sample popover",
                icon: "M4 4h16v12H5.17L4 17.17V4zm2 3v2h12V7H6zm0 4v2h8v-2H6z",
                onClick({ anchor }) {
                    zam.ui.openPopover({
                        anchor,
                        render(el) {
                            const box = document.createElement("div");
                            box.className = "p-3 text-sm w-56";
                            box.setAttribute("data-testid", "sample-popover");
                            box.textContent = zam.settings.get<string>(
                                "greeting",
                                "Hello from the sample plugin!",
                            );
                            el.appendChild(box);
                            return () => box.remove();
                        },
                    });
                },
            }),
        );

        disposables.push(
            zam.composer.addAction({
                id: "sample-action",
                label: "Sample action",
                icon: "M12 2 15 9l7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z",
                onSelect() {
                    zam.ui.notify({
                        title: "Sample plugin",
                        body: "Composer action fired.",
                    });
                },
            }),
        );

        disposables.push(
            zam.messages.addAction({
                id: "sample-msg-action",
                label: "Sample message action",
                icon: "M12 2 15 9l7 .5-5.5 4.5L18 22l-6-4-6 4 1.5-8L2 9.5 9 9z",
                onSelect({ eventId }) {
                    zam.ui.notify({
                        title: "Sample plugin",
                        body: `Message action on ${eventId}`,
                    });
                },
            }),
        );

        disposables.push(
            zam.messages.decorate(() => ({
                badge: "sample",
                tooltip: "Added by the sample plugin",
            })),
        );
    },
    onunload() {
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
