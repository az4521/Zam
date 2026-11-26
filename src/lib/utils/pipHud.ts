// The picture-in-picture window's controls (the HUD) hide after a spell with no
// pointer or key activity, and come back on the next one. Pure logic: the
// window supplies its own timers, so the countdown runs on the pop-out's clock.

/** How long the controls stay up without activity. There is no earlier value
 *  to match: the main call view has no idle hiding. */
export const PIP_HUD_IDLE_MS = 3000;

/** Event the desktop main process dispatches in the pop-out when the cursor
 *  moves over it (electron/main.cjs). The page cannot see that movement itself:
 *  the window is all drag region. */
export const PIP_ACTIVITY_EVENT = "zam-pip-activity";

/** Event the desktop main process dispatches in the pop-out when the window
 *  was maximised by a double-click on its drag region (electron/main.cjs). The
 *  page turns it into its own fullscreen toggle. */
export const PIP_TOGGLE_FULLSCREEN_EVENT = "zam-pip-toggle-fullscreen";

export interface HudClock {
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}

export interface PipHud {
    /** The controls are showing. Starts true. */
    readonly shown: boolean;
    /** Input happened: show the controls and restart the idle count. */
    activity(): void;
    /** Stop counting. The controls stay as they are. */
    dispose(): void;
}

export function createPipHud(
    clock: HudClock,
    onChange: (shown: boolean) => void,
    idleMs: number = PIP_HUD_IDLE_MS,
): PipHud {
    let shown = true;
    let timer: unknown = null;
    let disposed = false;

    const setShown = (next: boolean) => {
        if (shown === next) return;
        shown = next;
        onChange(next);
    };
    const arm = () => {
        if (timer !== null) clock.clearTimeout(timer);
        timer = clock.setTimeout(() => {
            timer = null;
            setShown(false);
        }, idleMs);
    };

    arm();
    return {
        get shown() {
            return shown;
        },
        activity() {
            if (disposed) return;
            setShown(true);
            arm();
        },
        dispose() {
            disposed = true;
            if (timer !== null) clock.clearTimeout(timer);
            timer = null;
        },
    };
}
