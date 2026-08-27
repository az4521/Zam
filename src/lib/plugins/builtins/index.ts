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

export interface BuiltinPlugin {
    manifest: Manifest;
    module: PluginModule;
    defaultEnabled: boolean;
}

export const BUILTIN_PLUGINS: BuiltinPlugin[] = [
    { manifest: sampleManifest, module: samplePlugin, defaultEnabled: true },
];
