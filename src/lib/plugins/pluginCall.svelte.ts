/**
 * What plugins add to the call screen (zam.call.addControl / addPanel /
 * addTileDecoration), as CallView reads it. Panels are open or closed
 * per plugin; `uiTick` is bumped by zam.call.refreshUi so controls re-read
 * their `active`. Reactive through pluginRegistry.tick and uiTick.
 */
import { pluginRegistry } from "../stores/plugins.svelte";

const state = $state<{ open: string[]; uiTick: number }>({
    open: [],
    uiTick: 0,
});

const key = (pluginId: string, id: string): string => `${pluginId}:${id}`;

export function openCallPanel(pluginId: string, id: string): void {
    const k = key(pluginId, id);
    if (!state.open.includes(k)) state.open.push(k);
}

/** Close one panel of the plugin, or all of them without an id. */
export function closeCallPanel(pluginId: string, id?: string): void {
    const prefix = id === undefined ? `${pluginId}:` : key(pluginId, id);
    state.open = state.open.filter((k) =>
        id === undefined ? !k.startsWith(prefix) : k !== prefix,
    );
}

export function refreshCallUi(): void {
    state.uiTick++;
}

export interface CallControlItem {
    key: string;
    label: string;
    icon?: string;
    active: boolean;
    click(anchor: HTMLElement): void;
}

export function callControlItems(roomId: string): CallControlItem[] {
    void pluginRegistry.tick;
    void state.uiTick;
    return pluginRegistry.callControls.map((e) => ({
        key: `${e.pluginId}:${e.entryId}`,
        label: e.value.label,
        icon: e.value.icon,
        active: safe(() => e.value.active?.() ?? false, false),
        click: (anchor) => {
            try {
                const r = e.value.onClick({ roomId, anchor });
                if (r) void r.catch(report(e.pluginId));
            } catch (err) {
                report(e.pluginId)(err);
            }
        },
    }));
}

export interface CallPanelItem {
    key: string;
    title: string;
    render(el: HTMLElement): void | (() => void);
}

/** The open panels, in the order they were opened. */
export function callPanelItems(roomId: string): CallPanelItem[] {
    void pluginRegistry.tick;
    const items: CallPanelItem[] = [];
    for (const k of state.open) {
        const e = pluginRegistry.callPanels.find(
            (p) => key(p.pluginId, p.value.id) === k,
        );
        if (e)
            items.push({
                key: k,
                title: e.value.title,
                render: (el) => e.value.render(el, { roomId }),
            });
    }
    return items;
}

export interface CallDecorationItem {
    key: string;
    render(el: HTMLElement): void | (() => void);
}

export function callTileDecorationItems(
    roomId: string,
    userId: string,
): CallDecorationItem[] {
    void pluginRegistry.tick;
    return pluginRegistry.callTileDecorations.map((e) => ({
        key: `${e.pluginId}:${e.entryId}`,
        render: (el) => e.value.render(el, { roomId, userId }),
    }));
}

function safe<T>(fn: () => T, fallback: T): T {
    try {
        return fn();
    } catch (e) {
        console.error("[plugin] call control threw", e);
        return fallback;
    }
}

const report = (pluginId: string) => (e: unknown) =>
    console.error(`[plugin ${pluginId}] call control threw`, e);
