/**
 * Pure registry data structure for plugin extension points. Holds per-kind
 * arrays of {pluginId, entryId, value} entries, plus a mutation `tick` a
 * reactive store bumps to force re-derivation. Entry ids are strictly
 * monotonic so a stale Disposable can never nuke a newer entry. No SDK/DOM/
 * localStorage imports — fully unit-testable. Mutates in place (splice/push)
 * so a Svelte $state proxy wrapping this object stays reactive; `tick` is the
 * single dependency a $derived can read.
 */
import type {
    Disposable,
    PluginCommand,
    ComposerButton,
    ComposerAction,
    MessageActionItem,
    MessageDecorator,
    MessageEmbed,
    HeaderButton,
    ShortcutRegistration,
    PanelRegistration,
    OutgoingTextTransform,
    OutgoingContentTransform,
    DoubleTapHandler,
    EventSubscription,
} from "./types";

export interface RegistryEntry<T> {
    pluginId: string;
    entryId: number;
    value: T;
}

export interface PluginRegistryData {
    commands: RegistryEntry<PluginCommand>[];
    composerButtons: RegistryEntry<ComposerButton>[];
    composerActions: RegistryEntry<ComposerAction>[];
    messageActions: RegistryEntry<MessageActionItem>[];
    decorators: RegistryEntry<MessageDecorator>[];
    embeds: RegistryEntry<MessageEmbed>[];
    headerButtons: RegistryEntry<HeaderButton>[];
    shortcuts: RegistryEntry<ShortcutRegistration>[];
    panels: RegistryEntry<PanelRegistration>[];
    outgoingTextTransforms: RegistryEntry<OutgoingTextTransform>[];
    outgoingContentTransforms: RegistryEntry<OutgoingContentTransform>[];
    doubleTapHandlers: RegistryEntry<DoubleTapHandler>[];
    eventSubs: RegistryEntry<EventSubscription>[];
    tick: number;
    nextEntryId: number;
}

export type ExtensionKind = Exclude<
    keyof PluginRegistryData,
    "tick" | "nextEntryId"
>;

export const EXTENSION_KINDS: ExtensionKind[] = [
    "commands",
    "composerButtons",
    "composerActions",
    "messageActions",
    "decorators",
    "embeds",
    "headerButtons",
    "shortcuts",
    "panels",
    "outgoingTextTransforms",
    "outgoingContentTransforms",
    "doubleTapHandlers",
    "eventSubs",
];

export function createRegistryData(): PluginRegistryData {
    return {
        commands: [],
        composerButtons: [],
        composerActions: [],
        messageActions: [],
        decorators: [],
        embeds: [],
        headerButtons: [],
        shortcuts: [],
        panels: [],
        outgoingTextTransforms: [],
        outgoingContentTransforms: [],
        doubleTapHandlers: [],
        eventSubs: [],
        tick: 0,
        nextEntryId: 1,
    };
}

/** Read a kind's array with an opaque element type (kinds hold different
 *  value types; callers pass the right `value` for `kind`). */
function arrOf(
    data: PluginRegistryData,
    kind: ExtensionKind,
): RegistryEntry<unknown>[] {
    return data[kind] as unknown as RegistryEntry<unknown>[];
}

/** Register a value under a plugin. Returns a Disposable that removes exactly
 *  this entry (idempotent). */
export function addEntry<K extends ExtensionKind>(
    data: PluginRegistryData,
    kind: K,
    pluginId: string,
    value: PluginRegistryData[K][number]["value"],
): Disposable {
    const entryId = data.nextEntryId++;
    arrOf(data, kind).push({ pluginId, entryId, value });
    data.tick++;
    return {
        dispose() {
            removeEntry(data, kind, entryId);
        },
    };
}

/** Remove one entry by id. Returns whether it existed. No-op (and no tick
 *  bump) if already gone — makes double-dispose safe. */
export function removeEntry(
    data: PluginRegistryData,
    kind: ExtensionKind,
    entryId: number,
): boolean {
    const arr = arrOf(data, kind);
    const idx = arr.findIndex((e) => e.entryId === entryId);
    if (idx === -1) return false;
    arr.splice(idx, 1);
    data.tick++;
    return true;
}

/** Remove every entry belonging to a plugin, across all kinds. */
export function removePluginEntries(
    data: PluginRegistryData,
    pluginId: string,
): void {
    let changed = false;
    for (const kind of EXTENSION_KINDS) {
        const arr = arrOf(data, kind);
        for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i].pluginId === pluginId) {
                arr.splice(i, 1);
                changed = true;
            }
        }
    }
    if (changed) data.tick++;
}

export function valuesFor<T>(entries: RegistryEntry<T>[]): T[] {
    return entries.map((e) => e.value);
}

/** `[...core, ...plugin values]` — the merge every wired extension point uses. */
export function mergeCore<T>(core: T[], entries: RegistryEntry<T>[]): T[] {
    return [...core, ...entries.map((e) => e.value)];
}

/** Count entries, optionally for one plugin. */
export function countEntries(
    data: PluginRegistryData,
    pluginId?: string,
): number {
    let n = 0;
    for (const kind of EXTENSION_KINDS) {
        for (const e of arrOf(data, kind)) {
            if (pluginId === undefined || e.pluginId === pluginId) n++;
        }
    }
    return n;
}
