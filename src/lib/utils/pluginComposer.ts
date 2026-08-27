/**
 * Pure adapters turning plugin-registry composer contributions into the view
 * models MessageInput's toolbar and ComposerActionsMenu merge with their core
 * items. No SDK/DOM imports — types only — so the merge logic is unit-testable
 * in isolation (the components own the reactive `pluginRegistry.tick` read and
 * the markup). Mirrors utils/slashCommands.ts::pluginCommandToSlash (item 7).
 */
import type { RegistryEntry } from "$lib/plugins/registry";
import type { ComposerAction, ComposerButton } from "$lib/plugins/types";

/** Stable, collision-proof key for a plugin's contribution (two plugins may
 *  reuse a contribution id; the plugin id disambiguates). */
export function pluginContribKey(pluginId: string, id: string): string {
    return `plugin:${pluginId}:${id}`;
}

export interface ComposerActionMenuItem {
    key: string;
    label: string;
    icon?: string;
    run(): void | Promise<void>;
}

export function pluginActionToMenuItem(
    action: ComposerAction,
    pluginId: string,
    roomId: string,
): ComposerActionMenuItem {
    return {
        key: pluginContribKey(pluginId, action.id),
        label: action.label,
        icon: action.icon,
        run: () => action.onSelect({ roomId }),
    };
}

export function mergeComposerActions<T>(
    core: T[],
    entries: RegistryEntry<ComposerAction>[],
    roomId: string,
): (T | ComposerActionMenuItem)[] {
    return [
        ...core,
        ...entries.map((e) =>
            pluginActionToMenuItem(e.value, e.pluginId, roomId),
        ),
    ];
}

export interface ComposerButtonView {
    key: string;
    label: string;
    icon?: string;
    onClick(anchor: HTMLElement): void | Promise<void>;
}

export function pluginButtonToView(
    btn: ComposerButton,
    pluginId: string,
    roomId: string,
): ComposerButtonView {
    return {
        key: pluginContribKey(pluginId, btn.id),
        label: btn.label,
        icon: btn.icon,
        onClick: (anchor: HTMLElement) => btn.onClick({ roomId, anchor }),
    };
}

export function pluginComposerButtons(
    entries: RegistryEntry<ComposerButton>[],
    roomId: string,
): ComposerButtonView[] {
    return entries.map((e) => pluginButtonToView(e.value, e.pluginId, roomId));
}
