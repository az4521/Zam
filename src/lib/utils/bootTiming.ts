/**
 * Startup timing marks: named steps from page load to the first sync, so a
 * slow step can be found. Marks are kept in memory for this page load only,
 * shown in Settings > Debug, readable as `window.__zamBoot`, and logged once.
 * No SDK imports: safe to call from anywhere in the boot chain.
 */

export interface BootMark {
    name: string;
    /** ms since navigation start (performance.now()). */
    t: number;
}

export interface BootStep extends BootMark {
    /** ms since the previous mark (since navigation start for the first). */
    dt: number;
}

/** How long after the shell commits before the timeline is logged anyway. */
export const BOOT_LOG_DELAY_MS = 15_000;

const PERF_PREFIX = "zam-boot:";

const recorded: BootMark[] = [];
let logTimer: ReturnType<typeof setTimeout> | null = null;
let logged = false;

function nowMs(): number {
    if (typeof performance !== "undefined" && performance.now)
        return performance.now();
    return Date.now();
}

/** Record a named step. `at` overrides the clock (tests). */
export function bootMark(name: string, at: number = nowMs()): void {
    recorded.push({ name, t: at });
    try {
        if (typeof performance !== "undefined" && "mark" in performance)
            performance.mark(PERF_PREFIX + name);
    } catch {
        // Old WebViews may lack the User Timing API; the in-memory mark stays.
    }
}

/** Add a DevTools measure from an earlier mark to now. Optional. */
export function bootMeasure(name: string, startMark: string): void {
    try {
        if (typeof performance !== "undefined" && "measure" in performance)
            performance.measure(PERF_PREFIX + name, PERF_PREFIX + startMark);
    } catch {
        // Missing start mark or no User Timing API: nothing to measure.
    }
}

/** Pure: attach the time since the previous mark to each mark, in order. */
export function timelineFrom(marks: readonly BootMark[]): BootStep[] {
    let prev = 0;
    return marks.map((m) => {
        const step = { name: m.name, t: m.t, dt: m.t - prev };
        prev = m.t;
        return step;
    });
}

/** The marks recorded so far, in order, with per-step deltas. */
export function bootTimeline(): BootStep[] {
    return timelineFrom(recorded.slice());
}

function formatTimeline(steps: readonly BootStep[]): string {
    const lines = steps.map(
        (s) =>
            `[boot] ${s.name} +${s.dt.toFixed(1)}ms (at ${s.t.toFixed(1)}ms)`,
    );
    const total = steps.length ? steps[steps.length - 1].t : 0;
    lines.push(`[boot] total ${total.toFixed(1)}ms (${steps.length} marks)`);
    return lines.join("\n");
}

/** Log the timeline once per page load. Later calls do nothing. */
export function logBootTimeline(): void {
    if (logged) return;
    logged = true;
    if (logTimer !== null) {
        clearTimeout(logTimer);
        logTimer = null;
    }
    const steps = bootTimeline();
    if (steps.length === 0) return;
    console.info(formatTimeline(steps));
}

/**
 * Arm the fallback log for when the first sync is slow: fires after
 * BOOT_LOG_DELAY_MS unless logBootTimeline() already ran.
 */
export function scheduleBootLog(): void {
    if (logged || logTimer !== null) return;
    logTimer = setTimeout(() => {
        logTimer = null;
        logBootTimeline();
    }, BOOT_LOG_DELAY_MS);
}

if (typeof window !== "undefined") {
    try {
        Object.defineProperty(window, "__zamBoot", {
            configurable: true,
            get: bootTimeline,
        });
    } catch {
        // A frozen or locked-down window: the Debug panel still shows marks.
    }
}
