// Built-in sticker picker plugin (migrated from core MessageInput, item 15).
// Reuses the existing StickerPicker.svelte, mounted into a plugin popover. On
// select it sends a standard m.sticker via zam.matrix.sendSticker — the
// compose side only; m.sticker RENDERING stays core (interop rule, spec §2).
// Preserves thread targeting: threadRootId from the composer-button ctx routes
// the send to the active thread.
import { mount, unmount } from "svelte";
import StickerPicker from "$lib/components/ui/StickerPicker.svelte";
import type { Manifest } from "../../manifest";
import type { PluginModule, Disposable } from "../../types";

export const manifest: Manifest = {
    id: "zam.sticker-picker",
    name: "Sticker Picker",
    version: "1.0.0",
    description: "Pick and send stickers from your packs in the composer.",
    author: "Zam",
    entry: "builtin",
    capabilities: ["composer", "ui", "messages:send"],
};

let disposables: Disposable[] = [];

export const plugin: PluginModule = {
    onload(zam) {
        disposables.push(
            zam.composer.addButton({
                id: "sticker",
                label: "Sticker",
                // lucide "Sticker" glyph as a single SVG path `d`.
                icon: "M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9l7-7V5a2 2 0 0 0-2-2h-3.5zM14 21v-5a2 2 0 0 1 2-2h5",
                onClick({ roomId, anchor, threadRootId }) {
                    let popover: Disposable | null = null;
                    popover = zam.ui.openPopover({
                        anchor,
                        render(el) {
                            const inst = mount(StickerPicker, {
                                target: el,
                                props: {
                                    roomId,
                                    onSelect: (sticker) =>
                                        zam.matrix.sendSticker(
                                            roomId,
                                            sticker,
                                            threadRootId
                                                ? { rootEventId: threadRootId }
                                                : undefined,
                                        ),
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
