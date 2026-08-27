/**
 * Registry of every built-in plugin bundled into Zam. The loader (pluginBoot)
 * registers each at boot and enables the default-enabled ones. Migration items
 * (fun slash commands, GIF/sticker pickers, double-tap, text-replacer) append
 * their built-ins here.
 */
import type { Manifest } from "../manifest";
import type { PluginModule } from "../types";
import {
    manifest as sampleManifest,
    plugin as samplePlugin,
} from "./sample/index";
import {
    manifest as slashFunManifest,
    plugin as slashFunPlugin,
} from "./slash-fun/index";
import {
    manifest as gifPickerManifest,
    plugin as gifPickerPlugin,
} from "./gif-picker/index";
import {
    manifest as stickerPickerManifest,
    plugin as stickerPickerPlugin,
} from "./sticker-picker/index";

export interface BuiltinPlugin {
    manifest: Manifest;
    module: PluginModule;
    defaultEnabled: boolean;
}

export const BUILTIN_PLUGINS: BuiltinPlugin[] = [
    { manifest: sampleManifest, module: samplePlugin, defaultEnabled: true },
    {
        manifest: slashFunManifest,
        module: slashFunPlugin,
        defaultEnabled: true,
    },
    {
        manifest: gifPickerManifest,
        module: gifPickerPlugin,
        defaultEnabled: true,
    },
    {
        manifest: stickerPickerManifest,
        module: stickerPickerPlugin,
        defaultEnabled: true,
    },
];
