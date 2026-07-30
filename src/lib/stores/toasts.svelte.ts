// Global, auto-expiring error toasts — the app's generic surface for failures
// that would otherwise only reach the console (e.g. a clicked matrix.to link
// whose join fails: without feedback the click looks like nothing happened).
// Rendered by ErrorToasts.svelte in the app shell.

/** Optional single action rendered inside the toast (e.g. "Retry"). */
export interface ToastAction {
    label: string;
    run: () => void;
}

export interface Toast {
    id: number;
    message: string;
    action?: ToastAction;
}

const TOAST_TTL_MS = 8000;

let nextId = 0;

class ToastsState {
    toasts = $state<Toast[]>([]);
}

export const toastsState = new ToastsState();

export function showErrorToast(message: string, action?: ToastAction): void {
    const id = nextId++;
    toastsState.toasts = [...toastsState.toasts, { id, message, action }];
    setTimeout(() => dismissToast(id), TOAST_TTL_MS);
}

export function dismissToast(id: number): void {
    toastsState.toasts = toastsState.toasts.filter((t) => t.id !== id);
}
