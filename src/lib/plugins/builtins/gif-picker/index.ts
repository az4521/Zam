// Built-in GIF picker plugin (migrated from core MessageInput, item 14).
// Reuses the existing GifPicker.svelte, mounted into a plugin popover. On
// select it inserts the GIF URL into the composer (URL-as-text rail) — parity
// with the old core behavior; it does NOT send m.image (see the plan's D1).
import { mount, unmount } from "svelte";
import GifPicker from "$lib/components/ui/GifPicker.svelte";
import type { Manifest } from "../../manifest";
import type { PluginModule, Disposable } from "../../types";

export const manifest: Manifest = {
    id: "zam.gif-picker",
    name: "GIF Picker",
    version: "1.0.0",
    description: "Search and insert GIFs (KLIPY) from the composer.",
    author: "Zam",
    entry: "builtin",
    capabilities: ["composer", "ui", "network"],
};

let disposables: Disposable[] = [];

export const plugin: PluginModule = {
    onload(zam) {
        disposables.push(
            zam.composer.addButton({
                id: "gif",
                label: "GIF",
                // Simple image glyph; btn.icon is a single SVG path `d`.
                icon: "M21 3H3v18h18V3zM5 5h14v9l-4-4-6 6-2-2-2 2V5z",
                onClick({ roomId, anchor }) {
                    let popover: Disposable | null = null;
                    popover = zam.ui.openPopover({
                        anchor,
                        render(el) {
                            const inst = mount(GifPicker, {
                                target: el,
                                props: {
                                    onSelect: (url: string) =>
                                        zam.composer.insertText({
                                            roomId,
                                            text: url,
                                        }),
                                    onClose: () => popover?.dispose(),
                                },
                            });
                            return () => {
                                unmount(inst);
                            };
                        },
                    });
                },
            }),
        );
    },
    onunload() {
        for (const d of disposables) d.dispose();
        disposables = [];
    },
};
