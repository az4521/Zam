// Display names for keybind actions and categories (Settings > Keybinds and
// the Ctrl+/ list).
import { t, type MessageKey } from "$lib/i18n";
import type { KeybindAction, KeybindCategory } from "./keybinds";

export function keybindLabel(id: KeybindAction): string {
    return t(`keybinds.action.${id}` as MessageKey);
}

export function keybindCategoryLabel(c: KeybindCategory): string {
    return t(`keybinds.category.${c}` as MessageKey);
}
