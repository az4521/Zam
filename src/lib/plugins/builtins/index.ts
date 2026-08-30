/**
 * Registry of every built-in plugin bundled into Zam. The loader (pluginBoot)
 * registers each at boot and enables the default-enabled ones.
 */
import type { Manifest } from "../manifest";
import type { PluginModule } from "../types";
import {
    manifest as slashFunManifest,
    plugin as slashFunPlugin,
} from "./slash-fun/index";
import {
    manifest as doubleTapReplyManifest,
    plugin as doubleTapReplyPlugin,
} from "./double-tap-reply/index";
import {
    manifest as textReplacerManifest,
    plugin as textReplacerPlugin,
} from "./text-replacer/index";

export interface BuiltinPlugin {
    manifest: Manifest;
    module: PluginModule;
    defaultEnabled: boolean;
}

export const BUILTIN_PLUGINS: BuiltinPlugin[] = [
    {
        manifest: slashFunManifest,
        module: slashFunPlugin,
        defaultEnabled: true,
    },
    {
        manifest: doubleTapReplyManifest,
        module: doubleTapReplyPlugin,
        defaultEnabled: true,
    },
    {
        manifest: textReplacerManifest,
        module: textReplacerPlugin,
        defaultEnabled: true,
    },
];
