// Global, auto-expiring error toasts — the app's generic surface for failures
// that would otherwise only reach the console (e.g. a clicked matrix.to link
// whose join fails: without feedback the click looks like nothing happened).
// Rendered by ErrorToasts.svelte in the app shell.

/** Optional single action rendered inside the toast (e.g. "Retry"). */
export interface ToastAction {
    label: string;
    run: () => void;
}

/** Visual tone. `danger` is the red error style; `accent` is a neutral,
 *  non-error prompt (e.g. an available update) so it doesn't read as a fault. */
export type ToastTone = "danger" | "accent";

export interface Toast {
    id: number;
    message: string;
    action?: ToastAction;
    tone: ToastTone;
    /** Runs when the user dismisses it (close button or action), not when it
     *  is retired silently or times out. */
    onDismiss?: () => void;
}

const TOAST_TTL_MS = 8000;

let nextId = 0;

class ToastsState {
    toasts = $state<Toast[]>([]);
}

export const toastsState = new ToastsState();

/** Show a toast with an explicit tone (and optional action). A `sticky` one
 *  stays until dismissed, for an action the user shouldn't miss. Returns its
 *  id, for dismissToast. */
export function showToast(
    message: string,
    opts?: {
        action?: ToastAction;
        tone?: ToastTone;
        sticky?: boolean;
        onDismiss?: () => void;
    },
): number {
    const id = nextId++;
    toastsState.toasts = [
        ...toastsState.toasts,
        {
            id,
            message,
            action: opts?.action,
            tone: opts?.tone ?? "danger",
            onDismiss: opts?.onDismiss,
        },
    ];
    if (!opts?.sticky) setTimeout(() => dismissToast(id), TOAST_TTL_MS);
    return id;
}

/** Show a red error toast — the app's generic failure surface. */
export function showErrorToast(message: string, action?: ToastAction): void {
    showToast(message, { action, tone: "danger" });
}

export function dismissToast(id: number): void {
    const toast = toastsState.toasts.find((t) => t.id === id);
    retireToast(id);
    toast?.onDismiss?.();
}

/** Remove a toast without running its onDismiss (the reason it is gone no
 *  longer applies, e.g. the prompt was answered some other way). */
export function retireToast(id: number): void {
    toastsState.toasts = toastsState.toasts.filter((t) => t.id !== id);
}
