// The one modal widget (MSC2790) open over the app. The opening WidgetFrame
// holds its handle; WidgetModalDialog renders it while the "widget-modal" slot
// is ours. Dismissal (Escape, backdrop, back, the slot being taken) settles as
// `m.exited`, the same as the modal's own close button. Closing the opener
// closes its modal.

import type {
    IModalWidgetOpenRequestData,
    IModalWidgetReturnData,
    MountedWidget,
} from "$lib/matrix/widgetHost";
import { isUnsafeWidgetUrl, type RoomWidget } from "$lib/utils/widgets";
import { openModal, clearModalIfOwner } from "./interface.svelte";

export interface OpenWidgetModal {
    /** The "widget-modal" slot occupancy this modal holds. */
    token: number;
    roomId: string;
    /** The widget that opened this modal. */
    opener: RoomWidget;
    openerHandle: MountedWidget;
    data: IModalWidgetOpenRequestData;
}

let current = $state.raw<OpenWidgetModal | null>(null);
let disabled = $state.raw<Record<string, boolean>>({});

/** Read-only view for components. Reads are reactive. */
export const widgetModal = {
    get current(): OpenWidgetModal | null {
        return current;
    },
    /** Button id to disabled flag, as the modal widget last set them. */
    get buttonDisabled(): Record<string, boolean> {
        return disabled;
    },
};

/**
 * Open a modal widget for `opener`. Returns false when a modal is already open
 * or the requested url is unsafe; the widget is then told so.
 */
export function openWidgetModal(req: {
    roomId: string;
    opener: RoomWidget;
    openerHandle: MountedWidget;
    data: IModalWidgetOpenRequestData;
}): boolean {
    if (current) return false;
    if (!req.data.url || isUnsafeWidgetUrl(req.data.url, location.origin)) {
        return false;
    }
    const entry: OpenWidgetModal = { token: 0, ...req };
    entry.token = openModal("widget-modal", () =>
        finish(entry, { "m.exited": true }),
    );
    current = entry;
    disabled = {};
    return true;
}

function finish(entry: OpenWidgetModal, data: IModalWidgetReturnData): void {
    if (current !== entry) return;
    current = null;
    disabled = {};
    clearModalIfOwner(entry.token);
    entry.openerHandle.notifyModalClosed(data);
}

/** Close the open modal and tell its opener how it was closed. */
export function closeWidgetModal(data: IModalWidgetReturnData): void {
    if (current) finish(current, data);
}

/** Close the modal `openerHandle` opened, if any. Called when that opener goes away. */
export function closeWidgetModalFor(openerHandle: MountedWidget): void {
    if (current?.openerHandle === openerHandle) {
        finish(current, { "m.exited": true });
    }
}

/** The modal widget set one of its buttons enabled or disabled. */
export function setWidgetModalButtonEnabled(
    id: string,
    enabled: boolean,
): void {
    if (!current) return;
    disabled = { ...disabled, [id]: !enabled };
}
